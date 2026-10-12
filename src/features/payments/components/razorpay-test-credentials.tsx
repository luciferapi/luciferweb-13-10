import { CreditCard, Smartphone } from "lucide-react"

export function RazorpayTestCredentials() {
  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
      <summary className="cursor-pointer font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
        Show test credentials
      </summary>
      <div className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2">
        <div className="flex gap-2">
          <CreditCard aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p><span className="font-semibold">Test card</span><br />4100 2800 0000 1007<br />CVV: 123 · Expiry: 12/26</p>
        </div>
        <div className="flex gap-2">
          <Smartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p><span className="font-semibold">Test UPI</span><br />test@razorpay</p>
        </div>
      </div>
    </details>
  )
}
