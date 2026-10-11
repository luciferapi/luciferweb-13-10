"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertCircle, Building2, Check, ChevronDown, LoaderCircle, Smartphone } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supportedWithdrawalBanks } from "@/features/wallet/server/withdrawal-method-banks"

type MethodType = "upi" | "bank"
type RequestState = "loading" | "ready" | "signed-out" | "error"

type SavedWithdrawalMethod = {
  method: MethodType
  accountHolder: string
  destination: string
  updatedAt: string
}

type BranchDetails = {
  ifsc: string
  bank: string
  branch: string
  city: string
  district: string
  state: string
  address: string
}

type BranchLookupState =
  | { status: "loading" }
  | { status: "success"; branch: BranchDetails }
  | { status: "error"; message: string }

type WithdrawalReview =
  | { method: "upi"; accountHolder: string; upiId: string }
  | {
      method: "bank"
      accountHolder: string
      accountNumber: string
      branch: BranchDetails
    }

function getErrorMessage(result: unknown, fallback: string) {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error
  }
  return fallback
}

export function WithdrawalMethodSettings() {
  const [requestState, setRequestState] = useState<RequestState>("loading")
  const [method, setMethod] = useState<MethodType>("upi")
  const [accountHolder, setAccountHolder] = useState("")
  const [upiId, setUpiId] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("")
  const [bankCode, setBankCode] = useState<string>(supportedWithdrawalBanks[0].code)
  const [bankPickerOpen, setBankPickerOpen] = useState(false)
  const [ifscCode, setIfscCode] = useState("")
  const [branchLookup, setBranchLookup] = useState<BranchLookupState | null>(null)
  const [savedMethod, setSavedMethod] = useState<SavedWithdrawalMethod | null>(null)
  const [saving, setSaving] = useState(false)
  const [reviewDetails, setReviewDetails] = useState<WithdrawalReview | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadMethod = useCallback(async (signal?: AbortSignal) => {
    setRequestState("loading")
    setError("")

    try {
      const response = await fetch("/api/wallet/withdrawal-method", {
        cache: "no-store",
        signal,
      })
      const result: unknown = await response.json().catch(() => null)

      if (response.status === 401) {
        setSavedMethod(null)
        setRequestState("signed-out")
        return
      }
      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Could not load your saved method."))
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("withdrawalMethod" in result)
      ) {
        throw new Error("The saved method response was invalid.")
      }

      const value = result.withdrawalMethod
      if (value !== null) {
        if (
          typeof value !== "object" ||
          !("method" in value) ||
          (value.method !== "upi" && value.method !== "bank") ||
          !("accountHolder" in value) ||
          typeof value.accountHolder !== "string" ||
          !("destination" in value) ||
          typeof value.destination !== "string" ||
          !("updatedAt" in value) ||
          typeof value.updatedAt !== "string"
        ) {
          throw new Error("The saved method response was invalid.")
        }
        setSavedMethod({
          method: value.method,
          accountHolder: value.accountHolder,
          destination: value.destination,
          updatedAt: value.updatedAt,
        })
        setMethod(value.method)
      } else {
        setSavedMethod(null)
      }
      setRequestState("ready")
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return
      setError(loadError instanceof Error ? loadError.message : "Could not load your saved method.")
      setRequestState("error")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadMethod(controller.signal)
    return () => controller.abort()
  }, [loadMethod])

  useEffect(() => {
    const normalizedIfsc = ifscCode.trim().toUpperCase()
    if (
      normalizedIfsc.length !== 11 ||
      !new RegExp(`^${bankCode}0[A-Z0-9]{6}$`).test(normalizedIfsc)
    ) {
      setBranchLookup(null)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setBranchLookup({ status: "loading" })
      void (async () => {
        try {
          const response = await fetch(
            `/api/wallet/withdrawal-method/ifsc?ifscCode=${encodeURIComponent(normalizedIfsc)}`,
            { cache: "no-store", signal: controller.signal },
          )
          const result: unknown = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(getErrorMessage(result, "Could not look up this branch."))
          }
          if (
            typeof result !== "object" ||
            result === null ||
            !("branch" in result) ||
            typeof result.branch !== "object" ||
            result.branch === null ||
            !("ifsc" in result.branch) ||
            result.branch.ifsc !== normalizedIfsc ||
            !("bank" in result.branch) ||
            typeof result.branch.bank !== "string" ||
            !("branch" in result.branch) ||
            typeof result.branch.branch !== "string" ||
            !("city" in result.branch) ||
            typeof result.branch.city !== "string" ||
            !("district" in result.branch) ||
            typeof result.branch.district !== "string" ||
            !("state" in result.branch) ||
            typeof result.branch.state !== "string" ||
            !("address" in result.branch) ||
            typeof result.branch.address !== "string"
          ) {
            throw new Error("The branch lookup response was invalid.")
          }

          setBranchLookup({
            status: "success",
            branch: {
              ifsc: result.branch.ifsc,
              bank: result.branch.bank,
              branch: result.branch.branch,
              city: result.branch.city,
              district: result.branch.district,
              state: result.branch.state,
              address: result.branch.address,
            },
          })
        } catch (lookupError) {
          if (controller.signal.aborted) return
          setBranchLookup({
            status: "error",
            message: lookupError instanceof Error
              ? lookupError.message
              : "Could not look up this branch.",
          })
        }
      })()
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [bankCode, ifscCode])

  function requestSaveConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return

    if (method === "bank") {
      if (accountNumber !== confirmAccountNumber) {
        setError("Account numbers do not match.")
        return
      }
      const normalizedIfsc = ifscCode.trim().toUpperCase()
      if (branchLookup?.status !== "success" || branchLookup.branch.ifsc !== normalizedIfsc) {
        setError("Wait for the IFSC branch lookup to complete before reviewing your details.")
        return
      }
      setReviewDetails({
        method,
        accountHolder: accountHolder.trim(),
        accountNumber,
        branch: branchLookup.branch,
      })
    } else {
      setReviewDetails({ method, accountHolder: accountHolder.trim(), upiId: upiId.trim() })
    }

    setError("")
    setNotice("")
  }

  async function saveMethod(review: WithdrawalReview) {
    setSaving(true)
    setError("")
    setNotice("")

    const payload = review.method === "upi"
      ? review
      : {
          method: review.method,
          accountHolder: review.accountHolder,
          accountNumber: review.accountNumber,
          confirmAccountNumber: review.accountNumber,
          ifscCode: review.branch.ifsc,
        }

    try {
      const response = await fetch("/api/wallet/withdrawal-method", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result: unknown = await response.json().catch(() => null)
      if (response.status === 401) {
        setRequestState("signed-out")
        return
      }
      if (response.status === 409) {
        const conflictMessage = getErrorMessage(
          result,
          "A withdrawal method is already saved. Contact customer support to request a change.",
        )
        await loadMethod()
        setNotice(conflictMessage)
        return
      }
      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Could not save your method. Check the details and try again."))
      }

      setAccountHolder("")
      setUpiId("")
      setAccountNumber("")
      setConfirmAccountNumber("")
      setIfscCode("")
      setReviewDetails(null)
      await loadMethod()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your method.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      id="withdrawal-method-settings"
      aria-labelledby="withdrawal-method-heading"
      data-settings-section
      className="scroll-mt-8 rounded-2xl border border-border bg-card/70 p-5 sm:p-7"
    >
      <div className="border-b border-border pb-5">
        <h2 id="withdrawal-method-heading" className="text-xl font-semibold tracking-tight">
          Withdrawal method
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Save one UPI ID or bank account for future withdrawals. Wallet withdrawals are not available yet, and saving details will not send money.
        </p>
      </div>

      {requestState === "loading" ? (
        <div
          aria-label="Loading withdrawal method"
          className="mt-5 h-24 animate-pulse rounded-xl bg-muted"
        />
      ) : requestState === "signed-out" ? (
        <div className="mt-5 rounded-xl border border-border bg-background/50 p-4">
          <p className="text-sm text-muted-foreground">Sign in to add or manage a withdrawal method.</p>
          <Link
            href="/sign-in?next=%2Fsettings"
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-lime px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
        </div>
      ) : requestState === "error" ? (
        <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-destructive">
            <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadMethod()}
            className="mt-3 min-h-10 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {savedMethod ? (
            <div className="mt-5 rounded-xl border border-lime/30 bg-lime/[0.06] p-4">
              <div className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-charcoal">
                  {savedMethod.method === "upi"
                    ? <Smartphone aria-hidden="true" size={20} />
                    : <Building2 aria-hidden="true" size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {savedMethod.method === "upi" ? "UPI" : "Bank account"} saved
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {savedMethod.accountHolder} · {savedMethod.destination}
                  </p>
                </div>
              </div>
              <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
                This method cannot be changed from Settings. To request a change,{" "}
                <Link
                  href="mailto:lucifer@luciferapi.com"
                  className="font-semibold text-foreground underline decoration-lime underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                >
                  contact customer support
                </Link>
                .
              </p>
            </div>
          ) : null}

          {!savedMethod ?           <form
            onChange={() => {
              if (reviewDetails) setReviewDetails(null)
            }}
            onSubmit={requestSaveConfirmation}
            className="mt-5 space-y-5"
          >
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-medium text-foreground">
                {savedMethod ? "Replace with" : "Choose a method"}
              </legend>
              <button
                type="button"
                aria-pressed={method === "upi"}
                onClick={() => {
                  setMethod("upi")
                  setError("")
                  setReviewDetails(null)
                }}
                className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                  method === "upi"
                    ? "border-lime/60 bg-lime/10 text-foreground"
                    : "border-border bg-background/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Smartphone aria-hidden="true" size={18} />
                UPI
                {method === "upi" ? <Check aria-hidden="true" className="ml-auto text-foreground" size={17} /> : null}
              </button>
              <button
                type="button"
                aria-pressed={method === "bank"}
                onClick={() => {
                  setMethod("bank")
                  setError("")
                  setReviewDetails(null)
                }}
                className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                  method === "bank"
                    ? "border-lime/60 bg-lime/10 text-foreground"
                    : "border-border bg-background/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Building2 aria-hidden="true" size={18} />
                Bank transfer
                {method === "bank" ? <Check aria-hidden="true" className="ml-auto text-foreground" size={17} /> : null}
              </button>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid content-start gap-2 text-sm font-medium text-foreground">
                Account holder name
                <input
                  autoComplete="name"
                  maxLength={100}
                  minLength={2}
                  name="accountHolder"
                  onChange={(event) => {
                    setAccountHolder(event.target.value.replace(/[^\p{L} ]/gu, "").replace(/ {2,}/g, " "))
                  }}
                  onBlur={() => setAccountHolder((value) => value.trim())}
                  required
                  value={accountHolder}
                  aria-describedby="account-holder-hint"
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-lime focus:ring-2 focus:ring-lime/30"
                  placeholder="Name on your account"
                />
                <span id="account-holder-hint" className="text-xs font-normal leading-5 text-muted-foreground">
                  Use letters and spaces only.
                </span>
              </label>

              {method === "upi" ? (
                <label className="grid content-start gap-2 text-sm font-medium text-foreground">
                  UPI ID
                  <input
                    autoComplete="off"
                    inputMode="email"
                    maxLength={255}
                    name="upiId"
                    onChange={(event) => setUpiId(event.target.value)}
                    required
                    value={upiId}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-lime focus:ring-2 focus:ring-lime/30"
                    placeholder="name@bank"
                  />
                </label>
              ) : (
                <>
                  <label className="grid content-start gap-2 text-sm font-medium text-foreground">
                    Account number
                    <input
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={18}
                      minLength={8}
                      name="accountNumber"
                      onChange={(event) => setAccountNumber(event.target.value)}
                      pattern="[0-9]{8,18}"
                      required
                      value={accountNumber}
                      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-lime focus:ring-2 focus:ring-lime/30"
                      placeholder="8 to 18 digits"
                    />
                  </label>
                  <label className="grid content-start gap-2 text-sm font-medium text-foreground">
                    Confirm account number
                    <input
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={18}
                      name="confirmAccountNumber"
                      onChange={(event) => setConfirmAccountNumber(event.target.value)}
                      pattern="[0-9]{8,18}"
                      required
                      value={confirmAccountNumber}
                      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-lime focus:ring-2 focus:ring-lime/30"
                      placeholder="Enter account number again"
                    />
                  </label>
                  <div className="grid content-start gap-2 text-sm font-medium text-foreground">
                    <span id="withdrawal-bank-label">Bank</span>
                    <Popover open={bankPickerOpen} onOpenChange={setBankPickerOpen}>
                      <PopoverTrigger
                        render={
                          <button
                          aria-expanded={bankPickerOpen}
                          aria-labelledby="withdrawal-bank-label"
                          aria-required="true"
                          className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm font-normal text-foreground outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/30"
                          role="combobox"
                          type="button"
                          >
                          <span className="truncate">
                            {supportedWithdrawalBanks.find((bank) => bank.code === bankCode)?.name}
                          </span>
                          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        }
                      />
                      <PopoverContent
                        align="start"
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                      >
                        <Command>
                          <CommandInput aria-label="Search banks" placeholder="Search banks..." />
                          <CommandList>
                            <CommandEmpty>No supported bank found.</CommandEmpty>
                            {supportedWithdrawalBanks.map((bank) => (
                              <CommandItem
                                key={bank.code}
                                value={`${bank.name} ${bank.code}`}
                                onSelect={() => {
                                  if (bank.code !== bankCode) {
                                    setBankCode(bank.code)
                                    setIfscCode("")
                                  }
                                  setBankPickerOpen(false)
                                }}
                              >
                                <Check
                                  aria-hidden="true"
                                  className={`size-4 ${bank.code === bankCode ? "opacity-100" : "opacity-0"}`}
                                />
                                {bank.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <label className="grid content-start gap-2 text-sm font-medium text-foreground">
                    IFSC code
                    <input
                      autoComplete="off"
                      maxLength={11}
                      minLength={11}
                      name="ifscCode"
                      onChange={(event) => setIfscCode(event.target.value.toUpperCase())}
                      pattern={`${bankCode}0[A-Za-z0-9]{6}`}
                      required
                      value={ifscCode}
                      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm uppercase text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-lime focus:ring-2 focus:ring-lime/30"
                      placeholder={`${bankCode}0XXXXXX`}
                    />
                    <span className="text-xs font-normal leading-5 text-muted-foreground">
                      Choose a supported bank. Its IFSC must start with {bankCode}0.
                    </span>
                    {branchLookup?.status === "loading" ? (
                      <span aria-live="polite" className="text-xs font-normal text-muted-foreground">
                        Looking up branch...
                      </span>
                    ) : null}
                    {branchLookup?.status === "success" ? (
                      <span aria-live="polite" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-normal leading-5 text-foreground">
                        <span className="block font-medium">
                          {branchLookup.branch.branch}
                          {branchLookup.branch.city ? `, ${branchLookup.branch.city}` : ""}
                          {branchLookup.branch.state ? `, ${branchLookup.branch.state}` : ""}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {branchLookup.branch.bank}
                          {branchLookup.branch.address ? `: ${branchLookup.branch.address}` : ""}
                        </span>
                      </span>
                    ) : null}
                    {branchLookup?.status === "error" ? (
                      <span aria-live="polite" className="text-xs font-normal text-destructive">
                        {branchLookup.message}
                      </span>
                    ) : null}
                  </label>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime px-5 py-2.5 text-sm font-semibold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              Save withdrawal method
            </button>
            <Dialog
              open={Boolean(reviewDetails)}
              onOpenChange={(open) => {
                if (!open && !saving) setReviewDetails(null)
              }}
            >
              {reviewDetails ? (
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Review your details</DialogTitle>
                    <DialogDescription>
                      Check the information carefully before saving. This method cannot be changed from Settings.
                    </DialogDescription>
                  </DialogHeader>
                  <dl className="grid gap-3 rounded-lg border border-border bg-background/70 p-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Account holder</dt>
                      <dd className="mt-1 break-words font-medium text-foreground">{reviewDetails.accountHolder}</dd>
                    </div>
                    {reviewDetails.method === "upi" ? (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">UPI ID</dt>
                        <dd className="mt-1 break-all font-medium text-foreground">{reviewDetails.upiId}</dd>
                      </div>
                    ) : (
                      <>
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground">Bank account number</dt>
                          <dd className="mt-1 break-all font-medium text-foreground">{reviewDetails.accountNumber}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground">Bank and IFSC</dt>
                          <dd className="mt-1 break-words font-medium text-foreground">
                            {reviewDetails.branch.bank} · {reviewDetails.branch.ifsc}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-medium text-muted-foreground">Branch</dt>
                          <dd className="mt-1 break-words font-medium text-foreground">
                            {reviewDetails.branch.branch}
                            {reviewDetails.branch.city ? `, ${reviewDetails.branch.city}` : ""}
                            {reviewDetails.branch.state ? `, ${reviewDetails.branch.state}` : ""}
                          </dd>
                          {reviewDetails.branch.address ? (
                            <dd className="mt-1 break-words text-muted-foreground">{reviewDetails.branch.address}</dd>
                          ) : null}
                        </div>
                      </>
                    )}
                  </dl>
                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => void saveMethod(reviewDetails)}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                    >
                      {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : null}
                      {saving ? "Saving..." : "Confirm and save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDetails(null)}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime disabled:cursor-wait disabled:opacity-60"
                    >
                      Go back
                    </button>
                  </DialogFooter>
                </DialogContent>
              ) : null}
            </Dialog>
          </form>
          : null}
          {error ? (
            <p role="alert" className="mt-4 text-sm leading-6 text-destructive">{error}</p>
          ) : null}
          {notice ? (
            <p role="status" className="mt-4 border-l-2 border-lime pl-3 text-sm leading-6 text-foreground">
              {notice}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
