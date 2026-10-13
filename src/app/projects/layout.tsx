import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Project Library | LUCIFER AI",
  description: "Browse LUCIFER AI's published web, app, and digital project work.",
  robots: { index: false, follow: false },
}

export default function ProjectsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
