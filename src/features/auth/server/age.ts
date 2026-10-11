export function getLatestEligibleBirthDate(now = new Date()): string {
  const year = now.getUTCFullYear() - 15
  const month = now.getUTCMonth()
  const day = Math.min(
    now.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  )
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}
