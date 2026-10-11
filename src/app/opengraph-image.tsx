import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const alt = "LUCIFER AI: web development, AI, and automation"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "images", "luciferai-brand-logo.jpg"))
  const logoSource = `data:image/jpeg;base64,${logo.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          gap: 58,
          padding: 68,
          color: "#f4f4f5",
          background: "linear-gradient(135deg, #09090b 0%, #111827 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <img
          src={logoSource}
          alt="LUCIFER AI brand mark"
          width={400}
          height={400}
          style={{ objectFit: "cover", borderRadius: 28 }}
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ color: "#67e8f9", fontSize: 22, fontWeight: 700, letterSpacing: 5 }}>
            LUCIFER AI
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 54, fontWeight: 700, lineHeight: 1.12 }}>
            Web development.
          </div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.12 }}>
            AI. Automation.
          </div>
          <div style={{ display: "flex", marginTop: 24, color: "#a1a1aa", fontSize: 24 }}>
            Ideas shaped into useful digital products.
          </div>
          <div style={{ display: "flex", marginTop: 42, color: "#67e8f9", fontSize: 20 }}>
            luciferapi.com
          </div>
        </div>
      </div>
    ),
    size,
  )
}
