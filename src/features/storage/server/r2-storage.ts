import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const notFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "$metadata" in error &&
  typeof error.$metadata === "object" &&
  error.$metadata !== null &&
  "httpStatusCode" in error.$metadata &&
  error.$metadata.httpStatusCode === 404

function normalizePublicStorageUrl(publicUrl: string | null, bucket: string | null, accountId: string | null) {
  if (!publicUrl) {
    if (!bucket || !accountId) return null
    return `https://${bucket}.${accountId}.r2.cloudflarestorage.com`
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(publicUrl)
  } catch {
    throw new Error("Set CLOUDFLARE_R2_PUBLIC_URL to an HTTPS R2 public domain.")
  }

  const normalizedPublicUrl = publicUrl.replace(/\/+$/, "")
  const hostname = parsedUrl.hostname.toLowerCase()

  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new Error("CLOUDFLARE_R2_PUBLIC_URL must be an HTTPS R2 custom domain or enabled r2.dev URL.")
  }

  if (bucket && accountId) {
    const accountHostname = `${accountId}.r2.cloudflarestorage.com`
    const bucketHostname = `${bucket}.${accountId}.r2.cloudflarestorage.com`
    const legacyS3Hostname = `s3.${accountId}.r2.cloudflarestorage.com`

    if (hostname === accountHostname || hostname === legacyS3Hostname) {
      return `https://${bucketHostname}`
    }
  }

  if (hostname.endsWith(".r2.cloudflarestorage.com")) {
    const bucketSuffix = hostname.replace(/\.r2\.cloudflarestorage\.com$/, "")
    if (bucket && bucketSuffix !== bucket) {
      return normalizedPublicUrl
    }
    return normalizedPublicUrl
  }

  if (!hostname.endsWith(".r2.dev") && !hostname.includes(".")) {
    throw new Error("CLOUDFLARE_R2_PUBLIC_URL must be a public R2 custom domain, r2.dev URL, or bucket hostname.")
  }

  return normalizedPublicUrl
}

export function getCloudflareR2Config() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT ?? process.env.R2_ENDPOINT ?? null
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID ?? null
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID ?? null
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY ?? null
  const bucket = process.env.CLOUDFLARE_R2_BUCKET ?? process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? null
  const publicUrlRaw = process.env.CLOUDFLARE_R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? null
  const privateBucket = process.env.CLOUDFLARE_R2_PRIVATE_BUCKET ?? (publicUrlRaw ? null : bucket)

  if (![endpoint, accountId, accessKeyId, secretAccessKey, bucket, publicUrlRaw, privateBucket].some(Boolean)) return null
  if (!accessKeyId || !secretAccessKey || !bucket || (!endpoint && !accountId)) {
    throw new Error("Cloudflare R2 is partially configured. Set the account ID or endpoint, access key, secret key, and bucket.")
  }

  const resolvedEndpoint = endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`
  const publicUrl = normalizePublicStorageUrl(publicUrlRaw, bucket, accountId)

  if (publicUrl && privateBucket && privateBucket === bucket) {
    throw new Error("CLOUDFLARE_R2_PRIVATE_BUCKET must be a separate bucket from CLOUDFLARE_R2_BUCKET.")
  }

  return {
    bucket,
    endpoint: resolvedEndpoint,
    publicUrl,
    privateBucket,
    credentials: { accessKeyId, secretAccessKey },
  }
}

function createR2Client(config: NonNullable<ReturnType<typeof getCloudflareR2Config>>) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: config.credentials,
    forcePathStyle: true,
  })
}

export function buildPublicStorageUrl(objectKey: string) {
  const config = getCloudflareR2Config()
  if (!config?.publicUrl) return null

  const safeObjectKey = objectKey.replace(/^\/+/, "")
  return new URL(safeObjectKey, `${config.publicUrl}/`).toString()
}

export async function uploadToCloudflareR2(
  objectKey: string,
  body: Buffer,
  contentType: string,
  { isPublic = true, required = false }: { isPublic?: boolean; required?: boolean } = {},
) {
  const config = getCloudflareR2Config()
  if (!config) {
    if (required) throw new Error("Configure Cloudflare R2 before uploading owner-managed files.")
    return null
  }
  if (isPublic && !config.publicUrl) {
    throw new Error("Set CLOUDFLARE_R2_PUBLIC_URL to a public R2 custom domain or r2.dev URL for public media.")
  }
  const bucket = isPublic ? config.bucket : config.privateBucket
  if (!bucket) throw new Error("Set CLOUDFLARE_R2_PRIVATE_BUCKET to a separate, non-public bucket for private source ZIPs.")

  await createR2Client(config).send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey.replace(/^\/+/, ""),
    Body: body,
    ContentType: contentType,
    CacheControl: isPublic ? "public, max-age=31536000" : "private, no-store",
  }))

  return { url: isPublic ? buildPublicStorageUrl(objectKey) : null }
}

export async function getCloudflareR2ObjectSize(objectKey: string) {
  const config = getCloudflareR2Config()
  if (!config) return null
  if (!config.privateBucket) {
    throw new Error("Set CLOUDFLARE_R2_PRIVATE_BUCKET to a separate, non-public bucket for private source ZIPs.")
  }

  try {
    const result = await createR2Client(config).send(new HeadObjectCommand({
      Bucket: config.privateBucket,
      Key: objectKey.replace(/^\/+/, ""),
    }))
    return result.ContentLength ?? null
  } catch (error) {
    if (notFound(error)) return null
    throw error
  }
}

export async function downloadFromCloudflareR2(objectKey: string) {
  const config = getCloudflareR2Config()
  if (!config) return null
  if (!config.privateBucket) {
    throw new Error("Set CLOUDFLARE_R2_PRIVATE_BUCKET to a separate, non-public bucket for private source ZIPs.")
  }

  try {
    const result = await createR2Client(config).send(new GetObjectCommand({
      Bucket: config.privateBucket,
      Key: objectKey.replace(/^\/+/, ""),
    }))
    if (!result.Body) throw new Error("Cloudflare R2 returned an empty object body.")
    return Buffer.from(await result.Body.transformToByteArray())
  } catch (error) {
    if (notFound(error)) return null
    throw error
  }
}
