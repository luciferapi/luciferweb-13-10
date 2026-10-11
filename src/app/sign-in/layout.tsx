import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In or Create an Account | LUCIFER AI",
  description: "Sign in to your LUCIFER AI account or create an account to access projects, AI tools, and your workspace.",
  robots: { index: false, follow: false },
}

export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
