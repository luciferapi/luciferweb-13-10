import { NextResponse } from "next/server"
import { z } from "zod"
import { getSignedInUser } from "@/lib/auth-session"
import { isSupportedWithdrawalIfsc } from "@/lib/withdrawal-method-banks"
import {
  getWithdrawalMethod,
  saveWithdrawalMethod,
  WithdrawalMethodAlreadyExistsError,
} from "@/lib/withdrawal-method-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const accountHolderSchema = z.string()
  .transform((value) => value.trim().replace(/ +/g, " "))
  .pipe(
    z.string()
      .min(2)
      .max(100)
      .regex(/^[\p{L} ]+$/u, "Account holder name can contain letters and spaces only."),
  )
const ifscSchema = z.string()
  .trim()
  .toUpperCase()
  .refine(
    isSupportedWithdrawalIfsc,
    "Enter a valid IFSC code for one of the supported banks.",
  )
const upiSchema = z.object({
  method: z.literal("upi"),
  accountHolder: accountHolderSchema,
  upiId: z.string().trim().max(255).regex(
    /^[A-Za-z0-9._-]{2,128}@[A-Za-z][A-Za-z0-9.-]{1,63}$/,
    "Enter a valid UPI ID.",
  ),
})
const bankSchema = z.object({
  method: z.literal("bank"),
  accountHolder: accountHolderSchema,
  accountNumber: z.string().trim().regex(/^\d{8,18}$/, "Enter an account number with 8 to 18 digits."),
  confirmAccountNumber: z.string().trim(),
  ifscCode: ifscSchema,
})
const payoutMethodSchema = z.discriminatedUnion("method", [upiSchema, bankSchema]).superRefine(
  (details, context) => {
    if (
      details.method === "bank" &&
      details.accountNumber !== details.confirmAccountNumber
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Account numbers do not match.",
        path: ["confirmAccountNumber"],
      })
    }
  },
)

async function requireUser() {
  const user = await getSignedInUser()
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Sign in to manage withdrawal methods." }, { status: 401 }),
    }
  }
  return { user, response: null }
}

export async function GET() {
  try {
    const { user, response } = await requireUser()
    if (response || !user) return response

    const withdrawalMethod = await getWithdrawalMethod(user.id)
    return NextResponse.json(
      { withdrawalMethod },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load the saved withdrawal method.", error)
    const message = error instanceof Error && error.message.includes("PAYOUT_DATA_ENCRYPTION_KEY")
      ? "Withdrawal details are not enabled because secure storage is not configured."
      : "Could not load your withdrawal method right now."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const parsed = payoutMethodSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue?.message ?? "Check your payout details and try again." },
      { status: 400 },
    )
  }

  try {
    const { user, response } = await requireUser()
    if (response || !user) return response

    if (parsed.data.method === "bank") {
      await saveWithdrawalMethod(user.id, {
        method: "bank",
        accountHolder: parsed.data.accountHolder,
        accountNumber: parsed.data.accountNumber,
        ifscCode: parsed.data.ifscCode,
      })
    } else {
      await saveWithdrawalMethod(user.id, parsed.data)
    }
    const withdrawalMethod = await getWithdrawalMethod(user.id)

    return NextResponse.json(
      { withdrawalMethod },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    if (error instanceof WithdrawalMethodAlreadyExistsError) {
      return NextResponse.json(
        {
          error: "A withdrawal method is already saved. Contact customer support to request a change.",
          supportUrl: "/contact",
        },
        { status: 409 },
      )
    }
    console.error("Could not save the withdrawal method.", error)
    const message = error instanceof Error && error.message.includes("PAYOUT_DATA_ENCRYPTION_KEY")
      ? "Withdrawal details cannot be saved until secure storage is configured."
      : "Could not save your withdrawal method right now."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { response } = await requireUser()
    if (response) return response

    return NextResponse.json(
      {
        error: "Withdrawal methods cannot be removed from Settings. Contact customer support to request a change.",
        supportUrl: "/contact",
      },
      { status: 405, headers: { Allow: "GET, PUT" } },
    )
  } catch (error) {
    console.error("Could not validate the withdrawal-method change request.", error)
    return NextResponse.json(
      { error: "Could not process your request right now." },
      { status: 500 },
    )
  }
}
