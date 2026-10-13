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
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(projectCode)) return null

  for (const directoryName of ["storage/project-catalog/images", "projects"]) {
    try {
      const directory = await realpath(path.join(/*turbopackIgnore: true*/ process.cwd(), directoryName))
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
      continue
    }
  }

  return null
}
