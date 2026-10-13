import { gateway, streamText, type ModelMessage } from "ai"
import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { readLimitedJson } from "@/lib/server/read-limited-json"

const DEFAULT_MODEL = "openai/gpt-4o"
const ALLOWED_MODELS = new Set([
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

export async function POST(request: Request) {
  try {
    const user = await getSignedInUser()
    if (!user) {
      return NextResponse.json({ error: "Sign in required to access the AI chat API." }, { status: 401 })
    }

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
      identifiers: [user.id],
    })
    if (rateLimitResponse) return rateLimitResponse

    const userName = user.name.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100)
    const userContext = userName
      ? ` The signed-in user's name is ${JSON.stringify(userName)}. Address them by name naturally when appropriate, but do not force their name into every reply.`
      : ""

    const system =
      `You are LUCIFER AI, a concise technical assistant for K Praveenkumar. Answer the user's latest question directly. Do not introduce yourself, repeat your capabilities, add meta commentary, or include notes about what you can or cannot execute unless the user asks. Help with Python, AI, APIs, Next.js, automation, debugging, and creative experiments. Be practical and honest. Never claim to have performed actions you cannot perform.${userContext}`

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
