import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import { LenisProvider } from "@/components/layout/lenis-provider"
import ClickSpark from "@/components/layout/click-spark"
import MagneticNav from "@/components/layout/magnetic-nav"
import { ButterflyBackground } from "@/components/layout/butterfly-background"
import { BackButton } from "@/components/layout/back-button"
import { CookieConsentManager } from "@/components/layout/cookie-consent-manager"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { MaintenanceGate } from "@/features/maintenance/components/maintenance-gate"
import { NetworkStatusGate } from "@/features/network/components/network-status-gate"
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register"
import "./globals.css"
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-space-grotesk",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://luciferapi.com"),
  referrer: "origin",
  title: "LUCIFER AI | Web Development, AI and Automation",
  description: "Discover LUCIFER AI: custom websites, web applications, APIs, AI experiments, and practical automation built by K Praveenkumar.",
  keywords: ["LUCIFER AI", "K Praveenkumar", "AI", "APIs", "web development", "Python"],
  generator: "v0.app",
  openGraph: {
    type: "website",
    siteName: "LUCIFER AI",
    title: "LUCIFER AI | Web Development, AI and Automation",
    description: "Discover LUCIFER AI: custom websites, web applications, APIs, AI experiments, and practical automation built by K Praveenkumar.",
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "LUCIFER AI: web development, AI, and automation",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LUCIFER AI | Web Development, AI and Automation",
    description: "Discover LUCIFER AI: custom websites, web applications, APIs, AI experiments, and practical automation built by K Praveenkumar.",
    images: ["/opengraph-image"],
  },
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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={cn("font-sans", inter.variable, spaceGrotesk.variable)}>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ClickSpark
            sparkColor="#AFFF00"
            sparkSize={12}
            sparkRadius={20}
            sparkCount={8}
            duration={400}
            easing="ease-out"
          >
            <ServiceWorkerRegister />
            <ButterflyBackground />
            <BackButton />
            <MagneticNav />
            <NetworkStatusGate>
              <MaintenanceGate>
                <LenisProvider>{children}</LenisProvider>
              </MaintenanceGate>
            </NetworkStatusGate>
          </ClickSpark>
          <CookieConsentManager />
        </ThemeProvider>
      </body>
    </html>
  )
}
