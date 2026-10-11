export type RazorpaySuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayFailure = { error?: { description?: string } }

export type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpaySuccess) => void | Promise<void>
  modal: { ondismiss: () => void }
  theme: { color: string }
}

export type RazorpayInstance = {
  open: () => void
  on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

export {}
