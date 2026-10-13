import type { Metadata } from "next"
import { createSocialMetadata } from "@/lib/social-metadata"

export const metadata: Metadata = {
  title: "Our Project Process | LUCIFER AI",
  description: "See how LUCIFER AI takes a digital project from an initial brief through planning, development, feedback, and delivery.",
  ...createSocialMetadata(
    "Our Project Process | LUCIFER AI",
    "See how LUCIFER AI takes a digital project from an initial brief through planning, development, feedback, and delivery.",
  ),
}

export default function ProcessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
