"use client"

import { cn } from "@/lib/utils"
import type { Message } from "./chat-shell"
import { Copy, CopyCheck, User } from "lucide-react"
import { MarkdownRenderer } from "./markdown-renderer"
import Image from "next/image"
import { useState } from "react"

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

// Format time for display
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
        "flex max-w-[92%] gap-3 sm:max-w-[84%]",
        isUser
          ? "ml-auto flex-row-reverse"
          : "mr-auto items-end",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900",
          !isUser && isStreaming && "sticky bottom-4 self-end transition-all duration-300",
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="w-4 h-4 text-stone-800" />
        ) : (
          <Image src="/images/ai-logo.jpg" alt="LUCIFER AI assistant logo" width={32} height={32} className="h-full w-full object-cover" />
        )}
      </div>

      {/* Message content */}
      <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
        {/* Role label (optional, shown on larger screens) */}
        <span className="mb-1 mt-1 hidden text-xs text-stone-400 sm:block">{isUser ? "You" : "Assistant"}</span>

        {/* Bubble */}
        <div
          className={cn(
            "overflow-hidden rounded-2xl",
            isUser
              ? "rounded-br-md border border-cyan-200/15 bg-cyan-300/10 text-slate-100"
              : "rounded-bl-md border border-slate-800/80 bg-slate-950/45 text-slate-200",
          )}
        >
          {!isUser && message.content.trim() && (
            <div className="flex justify-end p-2 pb-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-slate-800"
                aria-label="Copy assistant message"
              >
                {copied ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          <div
            className={cn(isUser ? "px-4 py-3" : "py-1")}
          >
            {isUser ? (
              <div className="flex flex-col gap-2">
                {message.imageData && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
                    <Image
                      src={message.imageData || "/placeholder.svg"}
                      alt="Uploaded image"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            ) : (
              <MarkdownRenderer content={message.content || " "} isStreaming={isStreaming} />
            )}
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-stone-400 mt-1">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  )
}
