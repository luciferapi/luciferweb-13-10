import type { Metadata } from "next"

const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "LUCIFER AI: web development, AI, and automation",
}

export function createSocialMetadata(title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      siteName: "LUCIFER AI",
      locale: "en_US",
      title,
      description,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage.url],
    },
  }
}
