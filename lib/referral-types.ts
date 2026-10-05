export type ReferralStatus = "pending" | "active" | "rejected"

export type RewardRule = {
  type: "fixed" | "percentage"
  amount: number
  currency: string
}

export type ReferralProgram = {
  referrerReward: RewardRule
  refereeReward: RewardRule
  conditions: {
    minPurchaseAmount: number | null
    validUntil: string | null
    maxReferrals: number | null
  }
}

export type ReferralEntry = {
  id: string
  name: string
  status: ReferralStatus
  depth: number
  createdAt: string
}

export function isReferralEntry(value: unknown): value is ReferralEntry {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "name" in value && typeof value.name === "string" &&
    "status" in value && (value.status === "pending" || value.status === "active" || value.status === "rejected") &&
    "depth" in value && typeof value.depth === "number" &&
    "createdAt" in value && typeof value.createdAt === "string"
}

export function isReferralProgram(value: unknown): value is ReferralProgram {
  if (typeof value !== "object" || value === null || !("referrerReward" in value) || !("refereeReward" in value) || !("conditions" in value)) return false
  const validReward = (reward: unknown) => typeof reward === "object" && reward !== null &&
    "type" in reward && (reward.type === "fixed" || reward.type === "percentage") &&
    "amount" in reward && typeof reward.amount === "number" &&
    "currency" in reward && typeof reward.currency === "string"
  const conditions = value.conditions
  return validReward(value.referrerReward) && validReward(value.refereeReward) &&
    typeof conditions === "object" && conditions !== null &&
    "minPurchaseAmount" in conditions && (typeof conditions.minPurchaseAmount === "number" || conditions.minPurchaseAmount === null) &&
    "validUntil" in conditions && (typeof conditions.validUntil === "string" || conditions.validUntil === null) &&
    "maxReferrals" in conditions && (typeof conditions.maxReferrals === "number" || conditions.maxReferrals === null)
}
