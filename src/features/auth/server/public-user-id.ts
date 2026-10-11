import { randomInt } from "node:crypto"

const PUBLIC_UID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const PUBLIC_UID_RANDOM_LENGTH = 12

export function generatePublicUserId(): string {
  let suffix = ""
  for (let index = 0; index < PUBLIC_UID_RANDOM_LENGTH; index += 1) {
    suffix += PUBLIC_UID_ALPHABET[randomInt(PUBLIC_UID_ALPHABET.length)]
  }
  return `LU-${suffix}`
}
