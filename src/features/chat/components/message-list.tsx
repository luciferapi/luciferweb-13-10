"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { AlertCircle, ArrowUpRight, BookOpen, Bug, Code2, RefreshCw, Sparkles } from "lucide-react"

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

const starterPrompts = [
  {
    title: "Fix a tricky bug",
    prompt: "Help me debug a coding issue",
    detail: "Find the root cause and a clear fix.",
    icon: Bug,
  },
  {
    title: "Build an idea",
    prompt: "Help me plan a web app",
    detail: "Shape the idea into a practical plan.",
    icon: Code2,
  },
  {
    title: "Learn something",
    prompt: "Explain a technical idea simply",
    detail: "Make a complex topic easy to grasp.",
    icon: BookOpen,
  },
  {
    title: "Explore AI",
    prompt: "Give me a useful AI project idea",
    detail: "Find a small experiment worth building.",
    icon: Sparkles,
  },
]

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
        className="absolute inset-0 flex items-center justify-center xl:left-[var(--navigation-width)]"
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
      className={`absolute inset-0 z-[1] overflow-y-auto px-4 sm:px-6 xl:left-[var(--navigation-width)] ${hasConversation ? "pb-56 pt-40 sm:pt-44 xl:pt-32" : "pb-44 pt-36 sm:pt-40 xl:pt-28"}`}
      role="log"
      aria-label="Lucifer AI chat messages"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 && !error && !isStreaming && (
        <div ref={emptyStateRef} className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <div data-intro-item className="mb-5 grid size-16 place-items-center overflow-hidden rounded-[1.4rem] border border-cyan-100/15 bg-slate-900/70 shadow-[0_16px_48px_rgba(8,145,178,0.16)] sm:mb-6">
            <img src="/images/ai-logo.jpg" alt="LUCIFER AI assistant logo" className="size-full object-cover" />
          </div>
          <p data-intro-item className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-100/10 bg-cyan-200/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.19em] text-cyan-100/80 sm:text-[11px]">
            <Sparkles aria-hidden="true" className="size-3.5 text-cyan-300" />
            Your AI workspace
          </p>
          <h1 data-intro-item className="max-w-3xl text-balance font-heading text-4xl font-bold leading-[1.02] tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">
            Think clearly. <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300 bg-clip-text text-transparent">Build boldly.</span>
          </h1>
          <p data-intro-item className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:mt-4 sm:text-base sm:leading-7">
            Bring a question, a bug, or a half-formed idea. Leave with a useful next step.
          </p>

          <div className="mt-7 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:mt-9 lg:grid-cols-4">
            {starterPrompts.map(({ title, prompt, detail, icon: Icon }) => (
              <button
                key={title}
                type="button"
                data-intro-item
                onClick={() => onSendPrompt(prompt)}
                className="group flex min-h-[7.25rem] flex-col justify-between rounded-2xl border border-white/[0.075] bg-slate-950/40 p-4 text-left shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-1 hover:border-cyan-100/25 hover:bg-slate-900/75 hover:shadow-[0_18px_40px_rgba(8,145,178,0.1)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl border border-cyan-100/10 bg-cyan-200/[0.06] text-cyan-200 transition group-hover:border-cyan-100/20 group-hover:bg-cyan-200/10">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                </span>
                <span className="mt-4 block">
                  <span className="block text-sm font-semibold text-slate-100">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span>
                </span>
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
