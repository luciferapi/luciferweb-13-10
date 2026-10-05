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
      className={cn(
        "flex max-w-[90%] md:max-w-[80%] gap-2",
        isUser
          ? "ml-auto flex-row-reverse user-message-enter"
          : "mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300 items-end",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden",
          isUser ? "bg-slate-800" : "bg-slate-800",
          !isUser && isStreaming && "sticky bottom-4 self-end transition-all duration-300",
        )}
        style={{
          boxShadow:
            "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px",
        }}
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
        <span className="text-xs text-stone-400 mb-1 hidden sm:block mt-2">{isUser ? "You" : "Assistant"}</span>

        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl border-none overflow-hidden",
            isUser
              ? "bg-violet-500/15 text-violet-100 border border-violet-300/20 rounded-br-md"
              : "bg-transparent text-slate-200 rounded-bl-md",
          )}
          style={{
            boxShadow: isUser
              ? "0 8px 28px rgba(0, 0, 0, 0.2)"
              : "none",
            willChange: isStreaming ? "height" : "auto",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {!isUser && message.content.trim() && (
            <div className="flex justify-end p-2 pb-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-slate-800"
                aria-label="Copy assistant message"
              >
                {copied ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          <div
            className={cn(isUser ? "px-4 py-3" : "py-1")}
            style={{
              transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
            }}
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
