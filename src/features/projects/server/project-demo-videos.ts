import { readdir, realpath, stat } from "node:fs/promises"
import path from "node:path"

const supportedVideoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"])

export function isProjectDemoVideoName(filename: string) {
  return filename.length <= 200 &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    filename === path.basename(filename) &&
    !filename.startsWith(".") &&
    supportedVideoExtensions.has(path.extname(filename).toLowerCase())
}

export async function listProjectDemoVideos(): Promise<string[]> {
  const directories = [
    path.join(process.cwd(), "storage", "project-catalog", "demo-videos"),
    path.join(process.cwd(), "projects"),
    path.join(process.cwd(), "source code demo videos"),
  ]
  const videos = new Set<string>()
  try {
    for (const directory of directories) {
      const entries = await readdir(/*turbopackIgnore: true*/ directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return []
        throw error
      })
      for (const entry of entries) {
        if (entry.isFile() && isProjectDemoVideoName(entry.name)) videos.add(entry.name)
      }
    }
    return [...videos].sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

export async function getProjectDemoVideo(filename: string) {
  if (!isProjectDemoVideoName(filename)) return null

  for (const directoryPath of [
    path.join("storage", "project-catalog", "demo-videos"),
    "projects",
    "source code demo videos",
  ]) {
    try {
      const directory = await realpath(path.join(/*turbopackIgnore: true*/ process.cwd(), directoryPath))
      const filePath = await realpath(path.join(directory, filename))
      const relativePath = path.relative(directory, filePath)
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) continue

      const fileStats = await stat(filePath)
      if (fileStats.isFile() && fileStats.size > 0) {
        return { filePath, size: fileStats.size, extension: path.extname(filename).toLowerCase() }
      }
    } catch {
      continue
    }
  }

  return null
}

export async function findProjectDemoVideo(projectCode: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(projectCode)) return null

  for (const extension of supportedVideoExtensions) {
    const filename = `${projectCode}${extension}`
    if (await getProjectDemoVideo(filename)) return filename
  }

  return null
}

export function getProjectDemoContentType(extension: string) {
  switch (extension) {
    case ".webm": return "video/webm"
    case ".mov": return "video/quicktime"
    case ".m4v": return "video/x-m4v"
    default: return "video/mp4"
  }
}
