import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { LenisProvider } from "@/components/lenis-provider"
import ClickSpark from "@/components/click-spark"
import MagneticNav from "@/components/magnetic-nav"
import { ButterflyBackground } from "@/components/butterfly-background"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const _inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const _jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "LUCIFER AI | Learn. Build. Experiment. Create.",
  description: "LUCIFER AI by K Praveenkumar — coding, AI, APIs, web development, and creative technology experiments.",
  keywords: ["LUCIFER AI", "K Praveenkumar", "AI", "APIs", "web development", "Python"],
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: "#09090b",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${_inter.variable} ${_jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ClickSpark
            sparkColor="#67e8f9"
            sparkSize={12}
            sparkRadius={20}
            sparkCount={8}
            duration={400}
            easing="ease-out"
          >
            <ButterflyBackground />
            <MagneticNav />
            <LenisProvider>{children}</LenisProvider>
          </ClickSpark>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
