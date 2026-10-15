"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { SquarePen } from "lucide-react"

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
const OLLAMA_MODEL_STORAGE_KEY = "ollama-custom-model"
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
  const [ollamaModel, setOllamaModel] = useState("llama3.2")
  const [selectedModule, setSelectedModule] = useState("auto")
  const [customModules, setCustomModules] = useState<CustomChatModule[]>([])

const requestRef = useRef<AbortController | null>(null)

useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const savedOllamaModel = localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY)
      const savedModule = localStorage.getItem(MODULE_STORAGE_KEY)
      const savedCustomModules = localStorage.getItem(CHAT_MODULES_STORAGE_KEY)

if (stored) {
        setMessages(restoreMessages(stored))
      }

      if (savedOllamaModel?.trim()) {
        setOllamaModel(savedOllamaModel.trim())
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
            model: `ollama/${ollamaModel}`,
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
    [customModules, isLoaded, ollamaModel, selectedModule],
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
              <p className="truncate text-sm font-bold tracking-[0.04em] text-white">LUCIFER <span className="text-lime-300">AI</span></p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <label className="relative">
                <span className="sr-only">Response mode</span>
                <select
                  value={activeModule.id}
                  onChange={(event) => {
                    const moduleId = event.target.value
                    setSelectedModule(moduleId)
                    try {
                      localStorage.setItem(MODULE_STORAGE_KEY, moduleId)
                    } catch {
                      // The selected mode still applies for this session.
                    }
                  }}
                  className="h-9 max-w-36 rounded-full border border-white/10 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 outline-none transition hover:border-lime-400/30 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-lime-400/60"
                  aria-label={`Response mode: ${activeModule.name}`}
                >
                  {availableModules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
                </select>
              </label>
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
