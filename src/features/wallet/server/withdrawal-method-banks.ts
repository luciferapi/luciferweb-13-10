export const supportedWithdrawalBanks = [
  { code: "SBIN", name: "State Bank of India (SBI)" },
  { code: "PUNB", name: "Punjab National Bank (PNB)" },
  { code: "BARB", name: "Bank of Baroda (BoB)" },
  { code: "CNRB", name: "Canara Bank" },
  { code: "UBIN", name: "Union Bank of India" },
  { code: "BKID", name: "Bank of India" },
  { code: "IDIB", name: "Indian Bank" },
  { code: "CBIN", name: "Central Bank of India" },
  { code: "IOBA", name: "Indian Overseas Bank" },
  { code: "UCBA", name: "UCO Bank" },
  { code: "MAHB", name: "Bank of Maharashtra" },
  { code: "PSIB", name: "Punjab & Sind Bank" },
  { code: "AIRP", name: "Airtel Payments Bank" },
  { code: "JIOP", name: "Jio Payments Bank" },
] as const

const supportedIfscPattern = new RegExp(
  `^(?:${supportedWithdrawalBanks.map(({ code }) => code).join("|")})0[A-Z0-9]{6}$`,
)

export function isSupportedWithdrawalIfsc(ifscCode: string): boolean {
  return supportedIfscPattern.test(ifscCode.trim().toUpperCase())
}
