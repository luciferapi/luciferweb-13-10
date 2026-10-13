import type { Metadata } from "next"
import { createSocialMetadata } from "@/lib/social-metadata"

export const metadata: Metadata = {
  title: "About LUCIFER AI | Websites, Apps and Automation",
  description: "Learn about LUCIFER AI and its work across web development, UI/UX, APIs, AI experiments, and practical automation.",
  ...createSocialMetadata(
    "About LUCIFER AI | Websites, Apps and Automation",
    "Learn about LUCIFER AI and its work across web development, UI/UX, APIs, AI experiments, and practical automation.",
  ),
}

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
