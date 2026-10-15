export type ProjectRequestReviewStatus = "pending" | "accepted" | "rejected"

export type OwnerProjectRequest = {
  id: number
  requestRef: string
  userName: string
  userEmail: string
  projectName: string
  description: string
  contactEmail: string | null
  whatsappNumber: string | null
  telegramId: string | null
  preferredLanguage: string | null
  desiredDuration: string | null
  paymentAmountPaise: number
  paymentStatus: string
  reviewStatus: ProjectRequestReviewStatus
  ownerMessage: string | null
  reviewedAt: string | null
  createdAt: string
}

function isProjectRequest(value: unknown): value is OwnerProjectRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Record<string, unknown>
  return Number.isSafeInteger(request.id) &&
    typeof request.requestRef === "string" &&
    typeof request.userName === "string" &&
    typeof request.userEmail === "string" &&
    typeof request.projectName === "string" &&
    typeof request.description === "string" &&
    (typeof request.contactEmail === "string" || request.contactEmail === null) &&
    (typeof request.whatsappNumber === "string" || request.whatsappNumber === null) &&
    (typeof request.telegramId === "string" || request.telegramId === null) &&
    (typeof request.preferredLanguage === "string" || request.preferredLanguage === null) &&
    (typeof request.desiredDuration === "string" || request.desiredDuration === null) &&
    Number.isSafeInteger(request.paymentAmountPaise) &&
    typeof request.paymentStatus === "string" &&
    (request.reviewStatus === "pending" || request.reviewStatus === "accepted" || request.reviewStatus === "rejected") &&
    (typeof request.ownerMessage === "string" || request.ownerMessage === null) &&
    (typeof request.reviewedAt === "string" || request.reviewedAt === null) &&
    typeof request.createdAt === "string"
}

export function parseOwnerProjectRequests(value: unknown): OwnerProjectRequest[] {
  if (typeof value !== "object" || value === null || !("requests" in value) || !Array.isArray(value.requests)) {
    throw new Error("The project request response was invalid.")
  }

  if (!value.requests.every(isProjectRequest)) {
    throw new Error("The project request response was invalid.")
  }

  return value.requests
}
