"use client"

import type { RefObject } from "react"

export function SocialAuthButtons({
  initialError,
}: {
  nextPath: string
  initialError?: string
  mode: "sign-in" | "create-account"
  formRef: RefObject<HTMLFormElement | null>
  referralCode: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        <span>Social sign-in</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-foreground">Social logins coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">Use email sign-in for now.</p>
      </div>
      {initialError ? <p role="alert" className="text-center text-sm text-rose-600 dark:text-rose-300">{initialError}</p> : null}
    </div>
  )
}
