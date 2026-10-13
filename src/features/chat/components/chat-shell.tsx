"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { MessageSquareDashed, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Composer, AI_MODELS, type AIModel } from "./composer"
import { MessageList } from "./message-list"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: Date
  imageData?: string
}

const STORAGE_KEY = "chat-messages"
const MODEL_STORAGE_KEY = "chat-selected-model"

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

const [selectedModel, setSelectedModel] = useState<AIModel>(
    "openai/gpt-4o",
  )

const requestRef = useRef<AbortController | null>(null)

useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY)

if (stored) {
        setMessages(restoreMessages(stored))
      }

const model = AI_MODELS.find((item) => item.id === savedModel)

if (model) {
        setSelectedModel(model.id)
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

const handleModelChange = useCallback((model: AIModel) => {
    setSelectedModel(model)

try {
      localStorage.setItem(MODEL_STORAGE_KEY, model)
    } catch {
      // Saving the preference is optional.
    }
  }, [])

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
            model: selectedModel,
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
    [isLoaded, selectedModel],
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

  const activeModel = AI_MODELS.find((model) => model.id === selectedModel)?.name ?? "AI model"

  return (
      <main aria-label="AI chat workspace" className="ai-chat-section relative isolate h-dvh overflow-hidden">
        <header className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-20 border-b border-white/[0.07] bg-slate-950/55 backdrop-blur-2xl xl:left-[var(--navigation-width)] xl:top-0">
          <div className="pointer-events-auto mx-auto flex min-h-[4.5rem] max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-100/15 bg-slate-900 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
                <Image src="/images/ai-logo.jpg" alt="" width={40} height={40} className="size-full object-cover" priority />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">LUCIFER <span className="text-cyan-300">AI</span></p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs">A thoughtful space to build, learn, and solve</p>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-medium text-slate-300 sm:inline-flex">
                <Sparkles aria-hidden="true" className="size-3.5 text-cyan-300" />
                <span className="hidden md:inline">Model</span> {activeModel}
              </span>
              <span className="hidden text-[11px] text-slate-500 lg:inline">Saved on this device</span>
              {messages.length > 0 || error ? (
                <Button
                  type="button"
                  onClick={clearChat}
                  disabled={!isLoaded}
                  variant="ghost"
                  className="h-9 gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-slate-300 shadow-sm transition hover:border-cyan-200/30 hover:bg-cyan-200/10 hover:text-cyan-100"
                  aria-label="Start a new chat"
                >
                  <MessageSquareDashed aria-hidden="true" className="size-4" />
                  <span className="text-xs font-semibold">New chat</span>
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
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />
      </main>
    )
}
