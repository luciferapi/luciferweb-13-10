"use client"

import { useState } from "react"
import Image from "next/image"
import { Copy, CopyCheck, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Message } from "./chat-shell"
import { MarkdownRenderer } from "./markdown-renderer"

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (isUser || !message.content.trim()) return

    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard access can fail in some browsers; ignore silently.
    }
  }

  return (
    <div
      data-chat-message-content
      className={cn(
        "group flex w-full flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      {isUser ? (
        <div className="min-h-11 min-w-16 max-w-[88%] rounded-2xl rounded-br-md border border-lime-300/25 bg-gradient-to-br from-lime-300/[0.16] to-lime-400/[0.07] px-4 py-2.5 text-zinc-50 shadow-[0_8px_24px_rgba(0,0,0,0.15)] sm:max-w-[80%]">
          <div className="flex flex-col gap-2">
            {message.imageData && (
              <div className="size-24 overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={message.imageData}
                  alt="Image attached to message"
                  width={96}
                  height={96}
                  unoptimized
                  className="size-full object-cover"
                />
              </div>
            )}
            <p className="whitespace-pre-wrap break-words text-[15px] leading-6">
              {message.content}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full min-w-0 text-zinc-100">
          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-200/90">
            <Sparkles aria-hidden="true" className="size-3.5" /> Lucifer AI
          </div>
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-950/35 px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:px-5">
            <MarkdownRenderer content={message.content || " "} isStreaming={isStreaming} />
          </div>
        </div>
      )}

      {!isUser && message.content.trim() && (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-zinc-400 transition hover:bg-lime-400/[0.08] hover:text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          aria-label="Copy assistant message"
          title={copied ? "Copied" : "Copy response"}
        >
          {copied ? (
            <CopyCheck aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  )
}
