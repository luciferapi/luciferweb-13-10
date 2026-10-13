import { realpath, stat } from "node:fs/promises"
import path from "node:path"

const imageTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

export async function getOwnerBannerImage(filename: string) {
  if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) return null

  try {
    const directory = await realpath(path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "owner-banners", "images"))
    const filePath = await realpath(path.join(directory, filename))
    const relativePath = path.relative(directory, filePath)
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null

    const fileStats = await stat(filePath)
    const contentType = imageTypes[path.extname(filename).toLowerCase()]
    if (!contentType || !fileStats.isFile() || fileStats.size === 0 || fileStats.size > 5 * 1024 * 1024) return null

    return { filePath, size: fileStats.size, contentType }
  } catch {
    return null
  }
}
