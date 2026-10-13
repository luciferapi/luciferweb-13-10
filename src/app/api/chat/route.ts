import { gateway, streamText, type ModelMessage } from "ai"
import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { readLimitedJson } from "@/lib/server/read-limited-json"

const DEFAULT_MODEL = "openai/gpt-4o"
const ALLOWED_MODELS = new Set([
  "ollama/llama3.2",
  "google/gemini-2.5-flash",
  "openai/gpt-4o",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-sonnet-4.5",
  "meta-llama/llama-3.3-70b-instruct",
  "x-ai/grok-4",
])

function normalizeModelId(model?: string) {
  if (!model) return DEFAULT_MODEL

  const trimmed = model.trim()
  const normalized = trimmed.startsWith("~") ? trimmed.slice(1) : trimmed

  if (trimmed === "google/gemini-2.0-flash-001" || trimmed === "google/gemini-3.8-flash") {
    return "google/gemini-2.5-flash"
  }

  if (normalized === "google/gemini-2.0-flash-001" || normalized === "google/gemini-3.8-flash") {
    return "google/gemini-2.5-flash"
  }

  if (ALLOWED_MODELS.has(trimmed) || ALLOWED_MODELS.has(normalized)) {
    return normalized
  }

  return DEFAULT_MODEL
}

function normalizeMessages(messages: unknown): ModelMessage[] {
  if (!Array.isArray(messages)) return []

  return messages.flatMap((message) => {
    if (!message || typeof message !== "object") return []

    const record = message as Record<string, unknown>
    const role = record.role
    const parts = Array.isArray(record.parts) ? record.parts : []

    const partText = parts
      .flatMap((part) => {
        if (typeof part !== "object" || part === null || !("type" in part) || part.type !== "text") return []
        return [{
          text: "text" in part && typeof part.text === "string" ? part.text : "",
        }]
      })
      .map((part) => part.text)
      .join("")

    const content = typeof record.content === "string" ? record.content : partText

    if (typeof role !== "string") return []
    if (!content.trim()) return []

    if (role === "user" || role === "assistant") {
      return [{ role, content: content.trim() }]
    }

    return []
  })
}

function isOllamaModel(modelId: string) {
  return modelId === "ollama/llama3.2"
}

async function streamOllamaResponse(system: string, messages: ModelMessage[]) {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").trim().replace(/\/$/, "")
  const model = (process.env.OLLAMA_MODEL ?? "llama3.2").trim()
  if (!model) throw new Error("OLLAMA_MODEL is not configured.")

  const headers: HeadersInit = { "Content-Type": "application/json" }
  const apiKey = process.env.OLLAMA_API_KEY?.trim()
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
      options: { num_predict: 1200 },
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Ollama request failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let pending = ""
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          pending += decoder.decode(value ?? new Uint8Array(), { stream: !done })
          const lines = pending.split("\n")
          pending = done ? "" : (lines.pop() ?? "")
          for (const line of lines) {
            if (!line.trim()) continue
            const payload = JSON.parse(line) as { message?: { content?: string }; error?: string }
            if (payload.error) throw new Error(payload.error)
            const text = payload.message?.content
            if (typeof text === "string" && text) controller.enqueue(encoder.encode(text))
          }
          if (done) break
        }
        if (pending.trim()) {
          const payload = JSON.parse(pending) as { message?: { content?: string }; error?: string }
          if (payload.error) throw new Error(payload.error)
          const text = payload.message?.content
          if (typeof text === "string" && text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

export async function POST(request: Request) {
  try {
    const user = await getSignedInUser()

    const bodyResult = await readLimitedJson(request, 64 * 1024)
    if (!bodyResult.ok) {
      return NextResponse.json(
        { error: bodyResult.status === 413 ? "The conversation is too large." : "Send a valid JSON request body." },
        { status: bodyResult.status },
      )
    }
    const body = bodyResult.value
    if (
      typeof body !== "object" ||
      body === null ||
      !("messages" in body) ||
      !Array.isArray(body.messages) ||
      body.messages.length > 40
    ) {
      return NextResponse.json({ error: "Invalid conversation." }, { status: 400 })
    }

    const requestedModel = "model" in body ? body.model : undefined
    if (requestedModel !== undefined && typeof requestedModel !== "string") {
      return NextResponse.json({ error: "Invalid conversation." }, { status: 400 })
    }

    const modelId = normalizeModelId(requestedModel)
    const messages = normalizeMessages(body.messages)
    const conversationLength = messages.reduce((total, message) => total + message.content.length, 0)
    if (
      messages.length === 0 ||
      !messages.some((message) => message.role === "user") ||
      conversationLength > 24000
    ) {
      return NextResponse.json({ error: "Invalid conversation." }, { status: 400 })
    }

    const rateLimitResponse = await enforceRateLimit(request, "ai-chat", {
      capacity: 15,
      refillSeconds: 15 * 60,
      identifiers: user ? [user.id] : [],
    })
    if (rateLimitResponse) return rateLimitResponse

    const userName = user?.name.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100) ?? ""
    const userContext = userName
      ? ` The signed-in user's name is ${JSON.stringify(userName)}. Address them by name naturally when appropriate, but do not force their name into every reply.`
      : ""

    const system =
      `You are LUCIFER AI, a concise technical assistant for K Praveenkumar. Answer the user's latest question directly. Do not introduce yourself, repeat your capabilities, add meta commentary, or include notes about what you can or cannot execute unless the user asks. Help with Python, AI, APIs, Next.js, automation, debugging, and creative experiments. Be practical and honest. Never claim to have performed actions you cannot perform.${userContext}`

    if (isOllamaModel(modelId)) {
      return await streamOllamaResponse(system, messages)
    }

    const result = streamText({
      model: gateway(modelId),
      system,
      messages,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(45_000),
    })

    const usesUiMessageStream = Array.isArray(body.messages) && body.messages.some((message) => Array.isArray(message.parts))

    if (request.headers.get("accept")?.includes("text/plain") || new URL(request.url).searchParams.get("format") === "text" || !usesUiMessageStream) {
      return result.toTextStreamResponse()
    }

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[chat] AI Gateway request failed", error)
    return NextResponse.json(
      { error: "LUCIFER AI could not complete that response. Please try again." },
      { status: 502 },
    )
  }
}
