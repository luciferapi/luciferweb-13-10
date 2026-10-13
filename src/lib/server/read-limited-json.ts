export type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 }

export async function readLimitedJson(
  request: Request,
  maxBytes: number,
): Promise<LimitedJsonResult> {
  const contentLength = request.headers.get("content-length")
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, status: 413 }
  }

  if (!request.body) return { ok: false, status: 400 }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      return { ok: false, status: 413 }
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { ok: false, status: 400 }
  }
}
