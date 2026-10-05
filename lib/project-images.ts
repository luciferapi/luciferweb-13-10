import { realpath, stat } from "node:fs/promises"
import path from "node:path"

const imageTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

export async function getProjectImage(projectCode: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(projectCode)) return null

  try {
    const directory = await realpath(path.join(process.cwd(), "projects"))
    for (const extension of Object.keys(imageTypes)) {
      const filename = `${projectCode}${extension}`
      try {
        const filePath = await realpath(path.join(directory, filename))
        const relativePath = path.relative(directory, filePath)
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) continue

        const fileStats = await stat(filePath)
        if (fileStats.isFile() && fileStats.size > 0 && fileStats.size <= 5 * 1024 * 1024) {
          return {
            filename,
            filePath,
            size: fileStats.size,
            contentType: imageTypes[extension],
            url: `/api/project-image/${encodeURIComponent(filename)}`,
          }
        }
      } catch {
        continue
      }
    }
  } catch {
    return null
  }

  return null
}
