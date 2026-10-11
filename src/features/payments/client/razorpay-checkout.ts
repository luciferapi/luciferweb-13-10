type RazorpayConstructor = NonNullable<Window["Razorpay"]>

let checkoutScriptPromise: Promise<RazorpayConstructor> | null = null

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
