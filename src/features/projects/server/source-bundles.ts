import { readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"
import { downloadFromCloudflareR2, getCloudflareR2ObjectSize } from "@/features/storage/server/r2-storage"

export const MAX_SOURCE_BUNDLE_SIZE = 100 * 1024 * 1024
const sourceBundleKey = (projectId: string) => `source-bundles/${projectId}.zip`

export async function getProjectSourceBundlePath(projectId: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId)) return null

  for (const directoryName of [
    path.join("storage", "project-catalog", "source-bundles"),
    "projects",
    "source codes",
  ]) {
    try {
      const sourceDirectory = await realpath(path.join(/*turbopackIgnore: true*/ process.cwd(), directoryName))
      const bundlePath = await realpath(path.join(sourceDirectory, `${projectId}.zip`))
      const relativePath = path.relative(sourceDirectory, bundlePath)
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) continue

      const bundleStats = await stat(bundlePath)
      if (bundleStats.isFile() && bundleStats.size > 0 && bundleStats.size <= MAX_SOURCE_BUNDLE_SIZE) return bundlePath
    } catch {
      continue
    }
  }

  return null
}

export async function hasProjectSourceBundle(projectId: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId)) return false
  const size = await getCloudflareR2ObjectSize(sourceBundleKey(projectId))
  if (size !== null) return size > 0 && size <= MAX_SOURCE_BUNDLE_SIZE
  return Boolean(await getProjectSourceBundlePath(projectId))
}

export async function readProjectSourceBundle(projectId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId)) return null

  const size = await getCloudflareR2ObjectSize(sourceBundleKey(projectId))
  if (size !== null) {
    if (size <= 0 || size > MAX_SOURCE_BUNDLE_SIZE) return null

    const bundle = await downloadFromCloudflareR2(sourceBundleKey(projectId))
    if (!bundle || bundle.length === 0 || bundle.length > MAX_SOURCE_BUNDLE_SIZE) return null
    return bundle
  }

  const bundlePath = await getProjectSourceBundlePath(projectId)
  return bundlePath ? readFile(/*turbopackIgnore: true*/ bundlePath) : null
}