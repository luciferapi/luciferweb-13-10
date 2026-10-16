"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Check, ChevronDown, Sparkles, SquarePen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Composer } from "./composer"
import { BUILT_IN_CHAT_MODULES, CHAT_MODULES_STORAGE_KEY, type CustomChatModule } from "../modules"
import { MessageList } from "./message-list"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: Date
  imageData?: string
}

const STORAGE_KEY = "chat-messages"
const MODULE_STORAGE_KEY = "chat-selected-module"

function extractStreamText(value: string) {
  if (!value.includes("data:") && !value.includes("text-delta")) return value

  const deltaMatches = [...value.matchAll(/(?:^|\n)data:\s*(\{.*?\})(?=\n|$)/g)]
  if (deltaMatches.length > 0) {
    const combined = deltaMatches
      .map((match) => {
        try {
          const parsed = JSON.parse(match[1]) as { delta?: string }
          return parsed.delta ?? ""
        } catch {
          return ""
        }
      })
      .join("")

    if (combined.trim()) return combined
  }

  return value
    .replace(/(?:^|\n)data:\s*/g, "")
    .replace(/\[DONE\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function generateId() {
  return crypto.randomUUID()
}

function restoreMessages(value: string): Message[] {
  const parsed: unknown = JSON.parse(value)

if (!Array.isArray(parsed)) return []

return parsed.flatMap((item): Message[] => {
    if (!item || typeof item !== "object") return []

const record = item as Record<string, unknown>

if (
      typeof record.id !== "string" ||
      typeof record.content !== "string" ||
      (record.role !== "user" && record.role !== "assistant")
    ) {
      return []
    }

const date =
      typeof record.createdAt === "string"
        ? new Date(record.createdAt)
        : new Date()

return [
      {
        id: record.id,
        role: record.role,
        content: record.content,
        createdAt: Number.isNaN(date.getTime()) ? new Date() : date,
        imageData:
          typeof record.imageData === "string"
            ? record.imageData
            : undefined,
      },
    ]
  })
}

export function ChatShell() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(true)
  const [selectedModule, setSelectedModule] = useState("auto")
  const [customModules, setCustomModules] = useState<CustomChatModule[]>([])

const requestRef = useRef<AbortController | null>(null)
  const moduleSwitcherRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!moduleSwitcherRef.current?.contains(event.target as Node)) {
        if (moduleSwitcherRef.current) moduleSwitcherRef.current.open = false
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && moduleSwitcherRef.current?.open) {
        moduleSwitcherRef.current.open = false
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const savedModule = localStorage.getItem(MODULE_STORAGE_KEY)
      const savedCustomModules = localStorage.getItem(CHAT_MODULES_STORAGE_KEY)

if (stored) {
        setMessages(restoreMessages(stored))
      }

      if (savedModule?.trim()) setSelectedModule(savedModule.trim())
      if (savedCustomModules) {
        const parsed = JSON.parse(savedCustomModules) as CustomChatModule[]
        if (Array.isArray(parsed)) setCustomModules(parsed)
      }
    } catch {
      // Storage can be unavailable or contain invalid data.
    } finally {
      setIsLoaded(true)
    }

return () => {
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [])

useEffect(() => {
    if (!isLoaded) return

try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Keep chatting even if browser storage is full.
    }
  }, [messages, isLoaded])

const sendWithHistory = useCallback(
    async (
      content: string,
      imageData: string | undefined,
      history: Message[],
    ) => {
      if (
        !isLoaded ||
        requestRef.current ||
        (!content.trim() && !imageData)
      ) {
        return
      }

const controller = new AbortController()
      requestRef.current = controller

const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim() || "Describe this image",
        imageData,
        createdAt: new Date(),
      }

const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
      }

const conversation = [...history, userMessage]

setError(null)
      setIsStreaming(true)
      setMessages([...conversation, assistantMessage])

let accumulated = ""

const updateAssistant = (content: string) => {
        if (requestRef.current !== controller) return

setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content }
              : message,
          ),
        )
      }

try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openrouter/auto",
            module: selectedModule === "auto"
              ? { id: "auto" }
              : [...BUILT_IN_CHAT_MODULES, ...customModules].find((module) => module.id === selectedModule) ?? { id: "auto" },
            messages: conversation.map((message) => ({
              role: message.role,
              content: message.content,
              imageData: message.imageData,
            })),
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          let message = `Request failed (${response.status}). Please try again.`

          try {
            const payload = (await response.clone().json()) as { error?: unknown }
            if (typeof payload.error === "string" && payload.error.trim()) {
              message = payload.error
            }
          } catch {
            // Keep the actionable status message when the server response is not JSON.
          }

          throw new Error(message)
        }

        if (!response.body) {
          throw new Error("The server returned no response body.")
        }

const reader = response.body.getReader()
        const decoder = new TextDecoder()

try {
          while (true) {
            const { done, value } = await reader.read()

if (done) break

const rawChunk = decoder.decode(value, { stream: true })
            accumulated += rawChunk
            updateAssistant(extractStreamText(accumulated))
          }

const finalChunk = decoder.decode()
          if (finalChunk) {
            accumulated += finalChunk
          }

const finalText = extractStreamText(accumulated)

if (!finalText.trim()) {
            throw new Error("The assistant returned an empty response.")
          }

updateAssistant(finalText)
        } finally {
          reader.releaseLock()
        }
      } catch (caught) {
        if (requestRef.current !== controller) return

if (controller.signal.aborted) {
          updateAssistant(accumulated || "[Response stopped]")
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : "Something went wrong. Please try again.",
          )

if (!accumulated) {
            setMessages((previous) =>
              previous.filter(
                (message) => message.id !== assistantMessage.id,
              ),
            )
          }
        }
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null
          setIsStreaming(false)
        }
      }
    },
    [customModules, isLoaded, selectedModule],
  )

const sendMessage = useCallback(
    (content: string, imageData?: string) => {
      void sendWithHistory(content, imageData, messages)
    },
    [messages, sendWithHistory],
  )

const retry = useCallback(() => {
    if (requestRef.current) return

let index = messages.length - 1

while (index >= 0 && messages[index].role !== "user") {
      index -= 1
    }

if (index < 0) return

const previousMessage = messages[index]

void sendWithHistory(
      previousMessage.content,
      previousMessage.imageData,
      messages.slice(0, index),
    )
  }, [messages, sendWithHistory])

const stopStreaming = useCallback(() => {
    requestRef.current?.abort()
  }, [])

const clearChat = useCallback(() => {
    const controller = requestRef.current
    requestRef.current = null
    controller?.abort()

setMessages([])
    setError(null)
    setIsStreaming(false)

try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // The in-memory conversation is still cleared.
    }
  }, [])

  const availableModules = [...BUILT_IN_CHAT_MODULES, ...customModules]
  const activeModule = availableModules.find((module) => module.id === selectedModule) ?? BUILT_IN_CHAT_MODULES[0]

  return (
      <main aria-label="AI chat workspace" className="ai-chat-section relative isolate h-dvh overflow-hidden">
        <header className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-20 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl xl:left-[var(--navigation-width)] xl:top-0">
          <div className="pointer-events-auto mx-auto flex min-h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                <Image src="/images/ai-logo.jpg" alt="" width={32} height={32} className="size-full object-cover" priority />
              </span>
              <p className="truncate text-sm font-bold tracking-[0.04em] text-white">LUCIFER <span className="text-lime-400">AI</span></p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <details ref={moduleSwitcherRef} className="group relative">
                <summary
                  aria-label={`Change chat module. Current module: ${activeModule.name}`}
                  title="Switch chat module"
                  className="flex h-10 w-[132px] cursor-pointer list-none items-center gap-2 rounded-xl border border-lime-300/30 bg-gradient-to-r from-lime-300/[0.12] to-zinc-900/90 px-2.5 text-left shadow-[0_4px_20px_rgba(163,230,53,0.08)] transition hover:border-lime-200/60 hover:from-lime-300/[0.17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60 sm:w-[190px] sm:gap-2.5 sm:px-3 [&::-webkit-details-marker]:hidden"
                >
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg border border-lime-200/20 bg-lime-300/10 text-lime-200">
                    <Sparkles className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold uppercase leading-3 tracking-[0.16em] text-lime-100/70">Module</span>
                    <span className="block truncate text-xs font-semibold leading-4 text-white sm:text-sm">{activeModule.name}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-lime-100/80 transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
                  <div className="px-3 pb-2 pt-2">
                    <p className="text-xs font-semibold text-white">Choose a module</p>
                    <p className="mt-1 text-[11px] text-zinc-400">Switch the assistant focus for this chat.</p>
                  </div>
                  <div className="max-h-[min(60vh,26rem)] space-y-1 overflow-y-auto">
                    {availableModules.map((module) => {
                      const isActive = module.id === selectedModule
                      return (
                        <button
                          key={module.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => {
                            setSelectedModule(module.id)
                            try {
                              localStorage.setItem(MODULE_STORAGE_KEY, module.id)
                            } catch {
                              // The selected mode still applies for this session.
                            }
                            if (moduleSwitcherRef.current) moduleSwitcherRef.current.open = false
                          }}
                          className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60 ${isActive ? "bg-lime-300/[0.12] text-white" : "text-zinc-200 hover:bg-zinc-800/90"}`}
                        >
                          <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${isActive ? "bg-lime-300/15 text-lime-200" : "bg-zinc-800 text-zinc-400"}`}>
                            <Sparkles aria-hidden="true" className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{module.name}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-zinc-400">{module.description}</span>
                          </span>
                          {isActive && <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-lime-200" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </details>
              {messages.length > 0 || error ? (
                <Button
                  type="button"
                  onClick={clearChat}
                  disabled={!isLoaded}
                  variant="ghost"
                  className="h-9 gap-2 rounded-full border border-transparent px-3 text-lime-300 transition hover:border-lime-400/20 hover:bg-lime-400/[0.06] hover:text-lime-200"
                  aria-label="Start a new chat"
                  title="New chat"
                >
                  <SquarePen aria-hidden="true" className="size-4" />
                  <span className="hidden text-xs font-medium sm:inline">New chat</span>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          onRetry={retry}
          isLoaded={isLoaded}
          onSendPrompt={sendMessage}
        />

        <Composer
          onSend={sendMessage}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          disabled={!isLoaded}
        />
      </main>
    )
}
