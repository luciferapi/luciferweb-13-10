export function validateUploadFile(
  file: File,
  allowedTypes: readonly string[],
  maxBytes: number,
  description: string,
): string | null {
  if (file.size === 0) return `Choose a non-empty ${description}.`
  if (file.size > maxBytes) {
    return `${description[0]?.toUpperCase()}${description.slice(1)} must be no larger than ${Math.floor(maxBytes / (1024 * 1024))} MB.`
  }
  if (!allowedTypes.includes(file.type)) {
    return `Choose a supported ${description} file type.`
  }
  return null
}
