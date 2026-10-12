import { z } from "zod"
import { getLatestEligibleBirthDate } from "@/features/auth/server/age"

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
const password = z.string().min(8).max(128)
export const dateOfBirthSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, "Enter a valid date of birth.").refine(
  (value) => value <= getLatestEligibleBirthDate(),
  "You must be at least 15 years old.",
)

export const registrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  dateOfBirth: dateOfBirthSchema.optional(),
  email,
  password,
  referralCode: z.string().trim().toUpperCase().max(32).optional(),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy to create an account." }),
  }),
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false),
})

export const socialSignupSchema = z.object({
  dateOfBirth: dateOfBirthSchema,
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy to create an account." }),
  }),
})

export const emailVerificationSchema = z.object({
  email,
  otp: z.string().regex(/^\d{6}$/),
})

export const loginCodeRequestSchema = z.object({ email })

export const passwordResetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),
  password,
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  telegramUsername: z.string().trim().transform((value) => value.replace(/^@/, "") || null)
    .refine((value) => value === null || /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value), "Enter a valid Telegram username.")
    .optional(),
  xUsername: z.string().trim().transform((value) => value.replace(/^@/, "") || null)
    .refine((value) => value === null || /^[A-Za-z0-9_]{1,15}$/.test(value), "Enter a valid X username.")
    .optional(),
}).refine((profile) => (
  profile.name !== undefined ||
  profile.dateOfBirth !== undefined ||
  profile.telegramUsername !== undefined ||
  profile.xUsername !== undefined
), {
  message: "Provide at least one profile field to update.",
})
