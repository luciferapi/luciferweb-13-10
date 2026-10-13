type RazorpayConstructor = NonNullable<Window["Razorpay"]>

let checkoutScriptPromise: Promise<RazorpayConstructor> | null = null

export async function getRazorpayKeyId(): Promise<string> {
  const response = await fetch("/api/payments/config", { cache: "no-store" })
  const body = await response.text()
  let result: unknown = null
  if (body.trim()) {
    try {
      result = JSON.parse(body) as unknown
    } catch {
      throw new Error("Checkout is unavailable because the payment configuration response is invalid.")
    }
  }
  if (!response.ok || typeof result !== "object" || result === null || !("key_id" in result) || typeof result.key_id !== "string") {
    const serverMessage = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "Razorpay is not configured on the server."
    throw new Error(`Checkout is unavailable. ${serverMessage}`)
  }
  return result.key_id
}

export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only be loaded in a browser."))
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (checkoutScriptPromise) return checkoutScriptPromise

  checkoutScriptPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay)
        return
      }
      checkoutScriptPromise = null
      script.remove()
      reject(new Error("Razorpay Checkout loaded without its payment interface."))
    }
    script.onerror = () => {
      checkoutScriptPromise = null
      script.remove()
      reject(new Error("Could not load Razorpay Checkout. Check your connection and try again."))
    }
    document.head.appendChild(script)
  })

  return checkoutScriptPromise
}
