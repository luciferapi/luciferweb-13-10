"use client"

import type { CSSProperties } from "react"

interface AnimatedOrbProps {
  className?: string
  variant?: "default" | "red"
  size?: number
}

export function AnimatedOrb({
  className = "",
  variant = "default",
  size = 32,
}: AnimatedOrbProps) {
  const isRed = variant === "red"

const colors = isRed
    ? ["#dc2626", "#f43f5e", "#be123c", "#fb7185", "#ef4444"]
    : ["#2563eb", "#7c3aed", "#0891b2", "#4f46e5", "#db2777"]

const proportions = [0.45, 0.35, 0.5, 0.25, 0.3]

const cloudStyle: CSSProperties = {
    filter: `blur(${Math.max(2, size * 0.08)}px)`,
  }

return (
    <div
      className={`lucifer-orb relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: isRed ? "#fee2e2" : "#c7d2fe",
        boxShadow: isRed
          ? "0 12px 36px rgba(220, 38, 38, 0.2)"
          : "0 12px 36px rgba(124, 58, 237, 0.22)",
      }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={cloudStyle}
      >
        {colors.map((color, index) => (
          <div
            key={index}
            className={`orb-circle-${index + 1} absolute rounded-full`}
            style={{
              width: size * proportions[index],
              height: size * proportions[index],
              backgroundColor: color,
              opacity: 0.95,
            }}
          />
        ))}
      </div>

<div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(150deg, rgba(255,255,255,0.22), transparent 65%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)",
        }}
      />
    </div>
  )
}
