import { createHash } from "node:crypto"
import { isIP } from "node:net"

export class SignupIpUnavailableError extends Error {
  constructor() {
    super("Could not determine the client IP address for signup.")
    this.name = "SignupIpUnavailableError"
  }
}

export function getSignupIpHash(request: Request): string {
  const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const address = [
    request.headers.get("cf-connecting-ip")?.trim(),
    request.headers.get("x-real-ip")?.trim(),
    forwardedAddress,
  ].find((value) => value && isIP(value) !== 0)

  if (!address) throw new SignupIpUnavailableError()
  const normalizedAddress = isIP(address) === 6
    ? new URL(`http://[${address}]/`).hostname.slice(1, -1)
    : address
  return createHash("sha256")
    .update(`luciferweb-signup-ip:${normalizedAddress.toLowerCase()}`)
    .digest("hex")
}
