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
    title: "Debug an issue",
    prompt: "Help me debug a coding issue",
    icon: Bug,
  },
  {
    title: "Plan a project",
    prompt: "Help me plan a web app",
    icon: Code2,
  },
  {
    title: "Explain a topic",
    prompt: "Explain a technical idea simply",
    icon: BookOpen,
  },
  {
    title: "Brainstorm ideas",
    prompt: "Give me a useful AI project idea",
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
      className={`absolute inset-0 z-[1] overflow-y-auto px-4 sm:px-6 xl:left-[var(--navigation-width)] ${hasConversation ? "pb-36 pt-36 sm:pt-40 xl:pt-24" : "pb-36 pt-36 sm:pt-40 xl:pt-28"}`}
      role="log"
      aria-label="Lucifer AI chat messages"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 && !error && !isStreaming && (
        <div ref={emptyStateRef} className="mx-auto flex min-h-[calc(100dvh-18rem)] w-full max-w-2xl flex-col items-center justify-center text-center xl:min-h-[calc(100dvh-16rem)]">
          <h1 data-intro-item className="text-balance text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
            What can I help with?
          </h1>
          <p data-intro-item className="mt-2 text-sm text-zinc-400 sm:text-base">
            Ask, create, plan, or work through a problem.
          </p>

          <div className="mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {starterPrompts.map(({ title, prompt, icon: Icon }) => (
              <button
                key={title}
                type="button"
                data-intro-item
                onClick={() => onSendPrompt(prompt)}
                className="group flex min-h-12 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-zinc-300 transition group-hover:bg-white/10 group-hover:text-white">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-zinc-200">{title}</span>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-zinc-500 transition group-hover:text-zinc-200" />
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
