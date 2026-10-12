import { verifyLoginOtp } from "@/features/auth/server/login-otp"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return verifyLoginOtp(request)
}
