"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { getLatestEligibleBirthDate } from "@/features/auth/server/age"
import { Bot, Check, Copy, KeyRound, LogOut, Monitor, Moon, MoonStar, Sun } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ProfileUpdate = {
  name?: string
  dateOfBirth?: string
  telegramUsername?: string
  xUsername?: string
}

const themeOptions = [
  {
    value: "system",
    label: "Use device setting",
    description: "Match the appearance preference on your device.",
    Icon: Monitor,
    palette: ["#edf0f7", "#ffffff", "#6547d5"],
  },
  {
    value: "light",
    label: "Light",
    description: "Use a light background and dark text.",
    Icon: Sun,
    palette: ["#f0eff7", "#ffffff", "#6547d5"],
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use a dark background and light text.",
    Icon: Moon,
    palette: ["#17151f", "#292431", "#b195ff"],
  },
  {
    value: "dark-blue",
    label: "Dark blue",
    description: "Use a deep blue background with cool blue surfaces.",
    Icon: MoonStar,
    palette: ["#0b1929", "#142a41", "#62c9e9"],
  },
] as const

const OLLAMA_MODEL_STORAGE_KEY = "ollama-custom-model"

export function SettingsPanel() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [accountStatus, setAccountStatus] = useState<"loading" | "signed-in" | "signed-out" | "error">("loading")
  const [accountName, setAccountName] = useState("")
  const [accountEmail, setAccountEmail] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [nameEditUsed, setNameEditUsed] = useState(false)
  const [dateOfBirthEditUsed, setDateOfBirthEditUsed] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState("")
  const [xUsername, setXUsername] = useState("")
  const [publicUid, setPublicUid] = useState("")
  const [publicUidCopied, setPublicUidCopied] = useState(false)
  const [publicUidCopyError, setPublicUidCopyError] = useState("")
  const [nameDraft, setNameDraft] = useState("")
  const [dateOfBirthDraft, setDateOfBirthDraft] = useState("")
  const [telegramUsernameDraft, setTelegramUsernameDraft] = useState("")
  const [xUsernameDraft, setXUsernameDraft] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<ProfileUpdate | null>(null)
  const [profileError, setProfileError] = useState("")
  const [profileNotice, setProfileNotice] = useState("")
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState("")
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)
  const [passwordResetError, setPasswordResetError] = useState("")
  const [passwordResetNotice, setPasswordResetNotice] = useState("")
  const [ollamaModelDraft, setOllamaModelDraft] = useState("llama3.2")
  const [ollamaModelNotice, setOllamaModelNotice] = useState("")
  const [ollamaModelError, setOllamaModelError] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const savedModel = window.localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY)
    if (savedModel?.trim()) setOllamaModelDraft(savedModel.trim())
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (response.status === 401) {
          setAccountStatus("signed-out")
          return
        }
        if (!response.ok) {
          throw new Error("Could not check your account right now.")
        }

        const result: unknown = await response.json()
        if (
          typeof result !== "object" ||
          result === null ||
          !("user" in result) ||
          typeof result.user !== "object" ||
          result.user === null ||
          !("name" in result.user) ||
          typeof result.user.name !== "string" ||
          !("publicUid" in result.user) ||
          typeof result.user.publicUid !== "string" ||
          !("email" in result.user) ||
          (typeof result.user.email !== "string" && result.user.email !== null) ||
          !("dateOfBirth" in result.user) ||
          (typeof result.user.dateOfBirth !== "string" && result.user.dateOfBirth !== null) ||
          !("telegramUsername" in result.user) ||
          (typeof result.user.telegramUsername !== "string" && result.user.telegramUsername !== null) ||
          !("xUsername" in result.user) ||
          (typeof result.user.xUsername !== "string" && result.user.xUsername !== null) ||
          !("nameEditUsed" in result.user) ||
          typeof result.user.nameEditUsed !== "boolean" ||
          !("dateOfBirthEditUsed" in result.user) ||
          typeof result.user.dateOfBirthEditUsed !== "boolean"
        ) {
          throw new Error("The account response was invalid.")
        }

        setAccountName(result.user.name)
        setNameDraft(result.user.name)
        setAccountEmail(result.user.email ?? "")
        setDateOfBirth(result.user.dateOfBirth ?? "")
        setDateOfBirthDraft(result.user.dateOfBirth ?? "")
        setTelegramUsername(result.user.telegramUsername ?? "")
        setTelegramUsernameDraft(result.user.telegramUsername ?? "")
        setXUsername(result.user.xUsername ?? "")
        setXUsernameDraft(result.user.xUsername ?? "")
        setNameEditUsed(result.user.nameEditUsed)
        setDateOfBirthEditUsed(result.user.dateOfBirthEditUsed)
        setPublicUid(result.user.publicUid)
        setAccountStatus("signed-in")
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        console.error("Could not load the settings account.", error)
        setAccountStatus("error")
      }
    }

    void loadAccount()
    return () => controller.abort()
  }, [])

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = nameDraft.trim()
    if (!name || name.length > 100) {
      setProfileNotice("")
      setProfileError("Enter a display name using 1 to 100 non-space characters.")
      return
    }

    const profile: ProfileUpdate = {}
    if (name !== accountName) profile.name = name
    if (dateOfBirthDraft && dateOfBirthDraft !== dateOfBirth) {
      profile.dateOfBirth = dateOfBirthDraft
    }
    if (telegramUsernameDraft !== telegramUsername) profile.telegramUsername = telegramUsernameDraft
    if (xUsernameDraft !== xUsername) profile.xUsername = xUsernameDraft
    if (Object.keys(profile).length === 0) return

    if (profile.name !== undefined || profile.dateOfBirth !== undefined) {
      setPendingProfileUpdate(profile)
      return
    }
    await saveProfile(profile)
  }

  async function handlePublicUidCopy() {
    setPublicUidCopied(false)
    setPublicUidCopyError("")
    try {
      await navigator.clipboard.writeText(publicUid)
      setPublicUidCopied(true)
    } catch (error) {
      console.error("Could not copy the public UID.", error)
      setPublicUidCopyError("Could not copy the UID. Select it and copy manually.")
    }
  }

  async function saveProfile(profile: ProfileUpdate) {
    setSavingProfile(true)
    setProfileError("")
    setProfileNotice("")
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not update your profile. Please try again."
        throw new Error(message)
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("user" in result) ||
        typeof result.user !== "object" ||
        result.user === null ||
        !("name" in result.user) ||
        typeof result.user.name !== "string" ||
        !("dateOfBirth" in result.user) ||
        (typeof result.user.dateOfBirth !== "string" && result.user.dateOfBirth !== null) ||
        !("telegramUsername" in result.user) ||
        (typeof result.user.telegramUsername !== "string" && result.user.telegramUsername !== null) ||
        !("xUsername" in result.user) ||
        (typeof result.user.xUsername !== "string" && result.user.xUsername !== null) ||
        !("nameEditUsed" in result.user) ||
        typeof result.user.nameEditUsed !== "boolean" ||
        !("dateOfBirthEditUsed" in result.user) ||
        typeof result.user.dateOfBirthEditUsed !== "boolean"
      ) {
        throw new Error("The updated profile response was invalid.")
      }

      setAccountName(result.user.name)
      setNameDraft(result.user.name)
      setDateOfBirth(result.user.dateOfBirth ?? "")
      setDateOfBirthDraft(result.user.dateOfBirth ?? "")
      setTelegramUsername(result.user.telegramUsername ?? "")
      setTelegramUsernameDraft(result.user.telegramUsername ?? "")
      setXUsername(result.user.xUsername ?? "")
      setXUsernameDraft(result.user.xUsername ?? "")
      setNameEditUsed(result.user.nameEditUsed)
      setDateOfBirthEditUsed(result.user.dateOfBirthEditUsed)
      setProfileNotice("Your profile has been updated.")
      if (result.user.name !== accountName) {
        window.dispatchEvent(new CustomEvent("lucifer:profile-updated", {
          detail: { name: result.user.name },
        }))
      }
    } catch (error) {
      console.error("Could not update the settings profile.", error)
      setProfileError(error instanceof Error ? error.message : "Could not update your profile. Please try again.")
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordResetRequest() {
    if (!accountEmail) return
    setSendingPasswordReset(true)
    setPasswordResetError("")
    setPasswordResetNotice("")

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountEmail }),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not request a password reset. Please try again."
        throw new Error(message)
      }
      setPasswordResetNotice("Password reset instructions have been sent to your email.")
    } catch (error) {
      console.error("Could not request a password reset from settings.", error)
      setPasswordResetError(
        error instanceof Error ? error.message : "Could not request a password reset. Please try again.",
      )
    } finally {
      setSendingPasswordReset(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError("")

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) {
        throw new Error("Could not sign out right now. Please try again.")
      }

      setAccountStatus("signed-out")
      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Sign out failed.", error)
      setSignOutError(error instanceof Error ? error.message : "Could not sign out right now. Please try again.")
    } finally {
      setSigningOut(false)
    }
  }

  function handleOllamaModelSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const model = ollamaModelDraft.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(model)) {
      setOllamaModelError("Use 1–128 letters, numbers, dots, underscores, hyphens, or colons.")
      setOllamaModelNotice("")
      return
    }

    window.localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, model)
    setOllamaModelDraft(model)
    setOllamaModelError("")
    setOllamaModelNotice("Ollama model saved on this device.")
  }

  return (
    <div
      id="profile-settings"
      className="scroll-mt-8 rounded-2xl border border-border bg-card/70 p-5 sm:p-7"
    >
      {accountStatus === "signed-in" ? (
        <section
          aria-labelledby="profile-heading"
          data-settings-section
        >
          <div className="border-b border-border pb-5">
            <h2 id="profile-heading" className="text-xl font-semibold tracking-tight">
              Profile
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Manage your name, date of birth, and social usernames. Your email and public UID identify your profile.
            </p>
          </div>
          <form onSubmit={(event) => void handleProfileSave(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label htmlFor="settings-profile-name" className="grid content-start gap-2 text-sm font-medium text-foreground">
              Display name
              <input
                id="settings-profile-name"
                name="name"
                type="text"
                value={nameDraft}
                onChange={(event) => {
                  setNameDraft(event.target.value)
                  setProfileError("")
                  setProfileNotice("")
                }}
                maxLength={100}
                required
                disabled={nameEditUsed}
                aria-describedby={nameEditUsed ? "settings-profile-name-help" : undefined}
                autoComplete="name"
                className={`min-h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/30 ${nameEditUsed ? "cursor-not-allowed bg-muted/40" : "bg-background"}`}
              />
              {nameEditUsed ? (
                <span id="settings-profile-name-help" className="text-xs font-normal text-muted-foreground">
                  Your one-time name change has been used. Contact support for corrections.
                </span>
              ) : null}
            </label>
            <label htmlFor="settings-profile-date-of-birth" className="grid content-start gap-2 text-sm font-medium text-foreground">
              Date of birth
              <input
                id="settings-profile-date-of-birth"
                name="dateOfBirth"
                type="date"
                value={dateOfBirthDraft}
                onChange={(event) => {
                  setDateOfBirthDraft(event.target.value)
                  setProfileError("")
                  setProfileNotice("")
                }}
                max={getLatestEligibleBirthDate()}
                required={Boolean(dateOfBirth)}
                disabled={dateOfBirthEditUsed}
                autoComplete="bday"
                aria-describedby="settings-profile-date-of-birth-help"
                className={`min-h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/30 ${dateOfBirthEditUsed ? "cursor-not-allowed bg-muted/40" : "bg-background"}`}
              />
              <span id="settings-profile-date-of-birth-help" className="text-xs font-normal text-muted-foreground">
                {dateOfBirthEditUsed
                  ? "Your one-time date of birth change has been used."
                  : "You must be at least 15 years old."}
              </span>
            </label>
            <label htmlFor="settings-profile-telegram-username" className="grid content-start gap-2 text-sm font-medium text-foreground">
              Telegram username
              <input
                id="settings-profile-telegram-username"
                name="telegramUsername"
                type="text"
                value={telegramUsernameDraft}
                onChange={(event) => {
                  setTelegramUsernameDraft(event.target.value)
                  setProfileError("")
                  setProfileNotice("")
                }}
                maxLength={33}
                autoComplete="username"
                pattern="@?[A-Za-z][A-Za-z0-9_]{4,31}"
                title="Enter a Telegram username with 5 to 32 letters, numbers, or underscores. An initial @ is optional."
                aria-describedby="settings-profile-telegram-help"
                placeholder="@username"
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/30"
              />
              <span id="settings-profile-telegram-help" className="text-xs font-normal text-muted-foreground">
                Optional. Use your Telegram username, not your phone number.
              </span>
            </label>
            <label htmlFor="settings-profile-x-username" className="grid content-start gap-2 text-sm font-medium text-foreground">
              X username
              <input
                id="settings-profile-x-username"
                name="xUsername"
                type="text"
                value={xUsernameDraft}
                onChange={(event) => {
                  setXUsernameDraft(event.target.value)
                  setProfileError("")
                  setProfileNotice("")
                }}
                maxLength={16}
                autoComplete="username"
                pattern="@?[A-Za-z0-9_]{1,15}"
                title="Enter an X username with 1 to 15 letters, numbers, or underscores. An initial @ is optional."
                aria-describedby="settings-profile-x-help"
                placeholder="@username"
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/30"
              />
              <span id="settings-profile-x-help" className="text-xs font-normal text-muted-foreground">
                Optional. Enter your X username.
              </span>
            </label>
            <div className="grid content-start gap-2 text-sm font-medium text-foreground">
              Email
              <div className="flex min-h-11 items-center break-all rounded-xl border border-border bg-muted/40 px-3 text-sm font-normal text-muted-foreground">
                {accountEmail || "No email address"}
              </div>
            </div>
            <div className="grid content-start gap-2 text-sm font-medium text-foreground">
              Public UID
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 text-foreground">
                <span className="select-all break-all font-mono text-sm font-semibold tracking-wide">
                  {publicUid}
                </span>
                <button
                  type="button"
                  onClick={() => void handlePublicUidCopy()}
                  disabled={!publicUid}
                  aria-label={publicUidCopied ? "Public UID copied" : "Copy public UID"}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publicUidCopied ? (
                    <>
                      <Check aria-hidden="true" className="size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="size-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              {publicUidCopyError ? (
                <span role="alert" className="text-xs font-normal text-destructive">
                  {publicUidCopyError}
                </span>
              ) : publicUidCopied ? (
                <span role="status" className="text-xs font-normal text-muted-foreground">
                  Public UID copied to clipboard.
                </span>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={
                  savingProfile ||
                  !nameDraft.trim() ||
                  (nameEditUsed && nameDraft.trim() !== accountName) ||
                  (dateOfBirthEditUsed && dateOfBirthDraft !== dateOfBirth) ||
                  (
                    nameDraft.trim() === accountName &&
                    dateOfBirthDraft === dateOfBirth &&
                    telegramUsernameDraft === telegramUsername &&
                    xUsernameDraft === xUsername
                  )
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
              {profileError ? <p role="alert" className="text-sm text-destructive">{profileError}</p> : null}
              {profileNotice ? <p role="status" className="text-sm text-foreground">{profileNotice}</p> : null}
            </div>
          </form>
        </section>
      ) : accountStatus === "loading" ? (
        <section
          aria-label="Loading profile"
          className="h-32 animate-pulse rounded-xl bg-muted"
        />
      ) : null}
      <Dialog
        open={pendingProfileUpdate !== null}
        onOpenChange={(open) => {
          if (!open && !savingProfile) setPendingProfileUpdate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm profile changes</DialogTitle>
            <DialogDescription>
              Your display name and date of birth can each be changed only once. After you confirm, the changed value cannot be edited again in Settings.
            </DialogDescription>
          </DialogHeader>
          {pendingProfileUpdate ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
              <p className="font-semibold">You are changing:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                {pendingProfileUpdate.name !== undefined ? <li>Display name</li> : null}
                {pendingProfileUpdate.dateOfBirth !== undefined ? <li>Date of birth</li> : null}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Contact customer support if a correction is needed later.
              </p>
            </div>
          ) : null}
          {profileError ? <p role="alert" className="text-sm text-destructive">{profileError}</p> : null}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPendingProfileUpdate(null)}
              disabled={savingProfile}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime disabled:opacity-50"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!pendingProfileUpdate) return
                const profile = pendingProfileUpdate
                setPendingProfileUpdate(null)
                void saveProfile(profile)
              }}
              disabled={savingProfile || pendingProfileUpdate === null}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
            >
              {savingProfile ? "Saving..." : "Confirm change"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <section
        aria-labelledby="theme-heading"
        data-settings-section
        className="mt-6 border-t border-border pt-6"
      >
        <div className="border-b border-border pb-5">
          <h2 id="theme-heading" className="text-xl font-semibold tracking-tight">
            Theme
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your choice is saved automatically on this device.
          </p>
        </div>

        <fieldset className="mt-5 grid gap-3">
          <legend className="sr-only">Choose a theme</legend>
          {themeOptions.map(({ value, label, description, Icon, palette }) => {
            const selected = mounted && theme === value

            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(value)}
                className={`flex min-h-20 w-full items-center gap-3 rounded-xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime active:scale-[0.99] sm:gap-4 ${
                  selected
                    ? "border-primary/60 bg-primary/10 shadow-sm"
                    : "border-border bg-card/60 hover:border-primary/35 hover:bg-card"
                }`}
              >
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="hidden h-9 w-14 shrink-0 items-center gap-1 rounded-lg border border-border/70 p-1 sm:flex"
                  style={{ backgroundColor: palette[0] }}
                >
                  <span className="h-full flex-1 rounded-sm" style={{ backgroundColor: palette[1] }} />
                  <span className="h-full w-2 rounded-sm" style={{ backgroundColor: palette[2] }} />
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                    selected ? "border-primary bg-primary" : "border-muted-foreground/50"
                  }`}
                >
                  {selected ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
                </span>
              </button>
            )
          })}
        </fieldset>
      </section>

      <section
        id="ai-settings"
        aria-labelledby="ai-settings-heading"
        data-settings-section
        className="mt-6 scroll-mt-8 rounded-2xl border border-border bg-card/70 p-5 sm:p-7"
      >
        <div className="border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Bot aria-hidden="true" size={19} />
            </span>
            <div>
              <h2 id="ai-settings-heading" className="text-xl font-semibold tracking-tight">
                AI preferences
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Choose the Ollama model used by the local AI option in Chat.
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={handleOllamaModelSave} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label htmlFor="settings-ollama-model" className="grid gap-2 text-sm font-medium text-foreground">
            Ollama model name
            <input
              id="settings-ollama-model"
              name="ollamaModel"
              type="text"
              value={ollamaModelDraft}
              onChange={(event) => {
                setOllamaModelDraft(event.target.value)
                setOllamaModelError("")
                setOllamaModelNotice("")
              }}
              maxLength={128}
              spellCheck={false}
              autoComplete="off"
              placeholder="llama3.2"
              aria-describedby="settings-ollama-model-help"
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-lime focus:ring-2 focus:ring-lime/30"
            />
            <span id="settings-ollama-model-help" className="text-xs font-normal text-muted-foreground">
              Example: <code className="rounded bg-muted px-1 py-0.5">llama3.2</code>, <code className="rounded bg-muted px-1 py-0.5">qwen2.5:7b</code>, or <code className="rounded bg-muted px-1 py-0.5">mistral</code>.
            </span>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Save model
          </button>
        </form>
        {ollamaModelError ? <p role="alert" className="mt-3 text-sm text-destructive">{ollamaModelError}</p> : null}
        {ollamaModelNotice ? <p role="status" className="mt-3 text-sm text-foreground">{ollamaModelNotice}</p> : null}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          This preference is stored only in this browser. Make sure the same model is available on your Ollama server.
        </p>
      </section>

      <section
        id="account-settings"
        aria-labelledby="account-heading"
        data-settings-section
        className="scroll-mt-8 rounded-2xl border border-border bg-card/70 p-5 sm:p-7"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 id="account-heading" className="text-xl font-semibold tracking-tight">
              Account
            </h2>
            {accountStatus === "loading" ? (
              <div
                aria-label="Loading account"
                className="mt-3 h-10 max-w-xs animate-pulse rounded-lg bg-muted"
              />
            ) : accountStatus === "signed-in" ? (
              <p className="mt-2 truncate text-sm leading-6 text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{accountName}</span>
                {accountEmail ? ` · ${accountEmail}` : ""}
              </p>
            ) : accountStatus === "signed-out" ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                You are not signed in.
              </p>
            ) : (
              <p role="alert" className="mt-2 text-sm leading-6 text-destructive">
                Could not load your account. Refresh the page to try again.
              </p>
            )}
          </div>

          {accountStatus === "signed-in" ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut aria-hidden="true" size={16} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          ) : null}
        </div>
        {accountStatus === "signed-in" ? (
          <div className="mt-5 border-t border-border pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Password</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Request a secure password reset link{accountEmail ? ` for ${accountEmail}` : ""}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handlePasswordResetRequest()}
                disabled={sendingPasswordReset || !accountEmail}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-lime/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound aria-hidden="true" size={16} />
                {sendingPasswordReset ? "Sending..." : "Forgot password?"}
              </button>
            </div>
            {!accountEmail ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Password reset requires an email address on your account.
              </p>
            ) : null}
            {passwordResetError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">{passwordResetError}</p>
            ) : null}
            {passwordResetNotice ? (
              <p role="status" className="mt-3 text-sm text-foreground">{passwordResetNotice}</p>
            ) : null}
          </div>
        ) : null}
        {signOutError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {signOutError}
          </p>
        ) : null}
      </section>
    </div>
  )
}
