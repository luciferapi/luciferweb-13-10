import "server-only"
import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"
import https from "node:https"

const upstreamBaseUrl = new URL("https://luciferapi.com/")
const blockedIpv4Addresses = new BlockList()

for (const subnet of [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
]) blockedIpv4Addresses.addSubnet(subnet.split("/")[0], Number(subnet.split("/")[1]), "ipv4")

const blockedIpv6Addresses = new BlockList()

for (const subnet of [
  "::/128",
  "::1/128",
  "::ffff:0:0/96",
  "64:ff9b::/96",
  "100::/64",
  "2001::/23",
  "2001:db8::/32",
  "2002::/16",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
]) blockedIpv6Addresses.addSubnet(subnet.split("/")[0], Number(subnet.split("/")[1]), "ipv6")

function isPublicAddress(address: string, family: number): boolean {
  if (family === 4) return !blockedIpv4Addresses.check(address, "ipv4")
  if (family !== 6 || !/^[23]/i.test(address)) return false
  return !blockedIpv6Addresses.check(address, "ipv6")
}

export function getApiEndpointUrl(endpointPath: string): URL {
  let url: URL
  try {
    url = /^[a-z][a-z\d+.-]*:/i.test(endpointPath)
      ? new URL(endpointPath)
      : new URL(endpointPath, upstreamBaseUrl)
  } catch {
    throw new Error("Enter a valid endpoint URL.")
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.origin === "null" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local") ||
    url.hostname === "localhost" ||
    isIP(url.hostname)
  ) {
    throw new Error("Use an HTTPS URL on a public hostname without credentials or a fragment.")
  }

  return url
}

async function resolvePublicAddress(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  const publicAddress = addresses.find((entry) => isPublicAddress(entry.address, entry.family))
  if (!publicAddress) throw new Error("The endpoint hostname does not resolve to a public IP address.")
  return publicAddress
}

export async function requestApiEndpoint(endpointPath: string) {
  const url = getApiEndpointUrl(endpointPath)
  const address = await resolvePublicAddress(url.hostname)
  const hostname = url.hostname
  const port = Number(url.port || "443")
  const hostHeader = port === 443 ? hostname : `${hostname}:${port}`
  const requestPath = `${url.pathname}${url.search}`

  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: address.address,
      family: address.family,
      port,
      method: "GET",
      path: requestPath,
      servername: hostname,
      headers: { Accept: "application/json", Host: hostHeader },
      timeout: 10_000,
    }, (response) => {
      const chunks: Buffer[] = []
      let size = 0
      const maxResponseBytes = 2 * 1024 * 1024

      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.length
        if (size > maxResponseBytes) {
          request.destroy(new Error("The endpoint response is larger than 2 MB."))
          return
        }
        chunks.push(buffer)
      })
      response.on("end", () => resolve({
        status: response.statusCode ?? 502,
        text: Buffer.concat(chunks).toString("utf8"),
      }))
      response.on("error", reject)
    })

    request.on("timeout", () => request.destroy(new Error("The endpoint request timed out.")))
    request.on("error", reject)
    request.end()
  })
}
