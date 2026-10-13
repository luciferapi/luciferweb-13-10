import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 38,
          background: "#09090b",
        }}
      >
        <svg width="108" height="108" viewBox="0 0 64 64" fill="none">
          <path
            d="M23 14v36h27"
            stroke="#67e8f9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
          />
        </svg>
      </div>
    ),
    size,
  )
}
