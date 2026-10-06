"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { AlertCircle, ArrowUpRight, RefreshCw } from "lucide-react"

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
  onSendPrompt: (prompt: string) => void
}

export function MessageList({
  messages,
  isStreaming,
  error,
  onRetry,
  isLoaded,
  onSendPrompt,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const emptyStateRef = useRef<HTMLDivElement>(null)
  const shouldFollowRef = useRef(true)
  const previousCountRef = useRef(0)
  const lastAnimatedMessageRef = useRef<string | null>(null)

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

    if (shouldFollowRef.current && messages.length > 0) {
      container.scrollTop = container.scrollHeight
    }

    previousCountRef.current = messages.length
  }, [messages, error, isLoaded])

  useEffect(() => {
    const emptyState = emptyStateRef.current
    if (!emptyState || messages.length > 0 || !isLoaded) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const context = gsap.context(() => {
      gsap.fromTo(
        emptyState.querySelectorAll<HTMLElement>("[data-intro-item]"),
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        },
      )
    }, emptyState)

    return () => context.revert()
  }, [isLoaded, messages.length])

  useEffect(() => {
    if (!isLoaded || !messages.length) return
    const lastMessage = messages[messages.length - 1]
    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.id === lastAnimatedMessageRef.current
    ) {
      return
    }

    const messageElement = containerRef.current?.querySelector<HTMLElement>(
      `[data-chat-message="${CSS.escape(lastMessage.id)}"]`,
    )
    if (!messageElement || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lastAnimatedMessageRef.current = lastMessage.id
      return
    }

    lastAnimatedMessageRef.current = lastMessage.id
    const context = gsap.context(() => {
      gsap.fromTo(
        messageElement,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "transform,opacity,visibility" },
      )
    }, containerRef)

    return () => context.revert()
  }, [isLoaded, messages])

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
  const hasConversation = messages.length > 0 || Boolean(error)

  if (!isLoaded) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        role="status"
        aria-label="Loading Lucifer AI"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <AnimatedOrb size={28} />
          <span className="text-sm text-slate-300">Preparing your chat</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`absolute inset-0 overflow-y-auto px-4 sm:px-6 ${hasConversation ? "pb-56 pt-40" : "pb-32 pt-20 sm:pt-28"}`}
      role="log"
      aria-label="Lucifer AI chat messages"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 && !error && !isStreaming && (
        <div ref={emptyStateRef} className="mx-auto mt-0 flex w-full max-w-3xl flex-col items-center text-center sm:mt-[clamp(1rem,5vh,3rem)]">
          <div data-intro-item className="mb-3 overflow-hidden rounded-2xl border border-cyan-200/20 bg-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.3)] sm:mb-5">
            <img src="/images/ai-logo.jpg" alt="LUCIFER AI assistant logo" className="h-12 w-12 object-cover sm:h-16 sm:w-16" />
          </div>

          <h1 data-intro-item className="max-w-2xl text-balance text-2xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            What are we building today?
          </h1>
          <p data-intro-item className="mt-2 max-w-lg text-sm leading-5 text-slate-400 sm:mt-3 sm:text-base sm:leading-6">
            Ask a question, share an idea, or choose a starting point.
          </p>

          <div className="mt-4 grid w-full grid-cols-1 gap-2 text-left sm:mt-8 sm:grid-cols-3 sm:gap-3">
            {[
              "Debug a coding issue",
              "Explain a technical idea",
              "Plan a web app",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                data-intro-item
                onClick={() => onSendPrompt(prompt)}
                className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm font-medium leading-5 text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-slate-900 hover:text-white active:translate-y-0 sm:min-h-20 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3"
              >
                <span>{prompt}</span>
                <ArrowUpRight aria-hidden="true" size={16} className="shrink-0 text-slate-500 transition group-hover:text-cyan-200" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl space-y-5">
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
            <div key={message.id} data-chat-message={message.id}>
              <MessageBubble
                message={message}
                isStreaming={
                  isStreaming &&
                  message.role === "assistant" &&
                  message.id === lastMessage?.id
                }
              />
            </div>
          ))}

        {showTyping && <TypingIndicator />}

        {error && (
          <div
            className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-950/40 p-4"
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
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
