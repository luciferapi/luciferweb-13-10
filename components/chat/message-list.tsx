"use client"

import { useEffect, useRef } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AnimatedOrb } from "./animated-orb"
import { MessageBubble } from "./message-bubble"
import { TypingIndicator } from "./typing-indicator"
import type { Message } from "./chat-shell"

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
  error: string | null
  onRetry: () => void
  isLoaded: boolean
}

export function MessageList({
  messages,
  isStreaming,
  error,
  onRetry,
  isLoaded,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldFollowRef = useRef(true)
  const previousCountRef = useRef(0)

useEffect(() => {
    const container = containerRef.current
    if (!container) return

const lastMessage = messages[messages.length - 1]

if (
      messages.length > previousCountRef.current &&
      (lastMessage?.role === "user" ||
        (lastMessage?.role === "assistant" &&
          lastMessage.content === ""))
    ) {
      shouldFollowRef.current = true
    }

if (shouldFollowRef.current) {
      container.scrollTop = container.scrollHeight
    }

previousCountRef.current = messages.length
  }, [messages, error, isLoaded])

const handleScroll = () => {
    const container = containerRef.current
    if (!container) return

const distance =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight

shouldFollowRef.current = distance < 100
  }

const lastMessage = messages[messages.length - 1]

const showTyping =
    isStreaming &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      lastMessage.content === "")

if (!isLoaded) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        role="status"
        aria-label="Loading Lucifer AI"
      >
        <AnimatedOrb size={64} />
      </div>
    )
  }

return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="absolute inset-0 overflow-y-auto px-6 pb-48 pt-16"
      role="log"
      aria-label="Lucifer AI chat messages"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 && !error && !isStreaming && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="orb-intro mb-4 overflow-hidden rounded-full border border-slate-700 bg-slate-800 shadow-lg shadow-black/30">
            <img src="/images/ai-logo.jpg" alt="LUCIFER AI assistant logo" className="h-32 w-32 object-cover" />
          </div>

<p className="lucifer-title text-blur-intro text-lg font-medium">
            Hi, my name is Lucifer AI
          </p>

<p className="lucifer-subtitle text-blur-intro-delay mt-1 text-sm">
            Send a message to begin chatting with the AI assistant
          </p>
        </div>
      )}

<div className="space-y-4">
        {messages
          .filter(
            (message) =>
              !(
                isStreaming &&
                message.id === lastMessage?.id &&
                message.role === "assistant" &&
                message.content === ""
              ),
          )
          .map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={
                isStreaming &&
                message.role === "assistant" &&
                message.id === lastMessage?.id
              }
            />
          ))}

{showTyping && <TypingIndicator />}

{error && (
          <div
            className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-950/40 p-4"
            role="alert"
          >
            <AlertCircle
              className="h-5 w-5 shrink-0 text-red-400"
              aria-hidden="true"
            />

<div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-200">
                Unable to complete the response
              </p>
              <p className="mt-1 break-words text-xs text-red-300">
                {error}
              </p>
            </div>

<Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              disabled={isStreaming}
              className="shrink-0 text-red-300 hover:bg-red-900/50"
            >
              <RefreshCw
                className="mr-1 h-4 w-4"
                aria-hidden="true"
              />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
