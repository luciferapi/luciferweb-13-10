import type { Metadata } from "next"
import { createSocialMetadata } from "@/lib/social-metadata"

export const metadata: Metadata = {
  title: "Project Steps and Delivery | LUCIFER AI",
  description: "Understand the steps for working with LUCIFER AI, from sharing a project brief to planning, building, and reviewing the result.",
  ...createSocialMetadata(
    "Project Steps and Delivery | LUCIFER AI",
    "Understand the steps for working with LUCIFER AI, from sharing a project brief to planning, building, and reviewing the result.",
  ),
}

export default function ContactProcessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
