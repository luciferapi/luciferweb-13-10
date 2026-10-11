export function parsePriceToPaise(price: string): number | null {
  const normalizedPrice = price.trim().replace(/^₹\s*/, "").replace(/,/g, "")
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedPrice)) return null

  const amountPaise = Math.round(Number(normalizedPrice) * 100)
  return Number.isSafeInteger(amountPaise) && amountPaise >= 100 ? amountPaise : null
}

export function formatPriceInr(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amountPaise / 100)
}