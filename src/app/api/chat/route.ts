import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { readLimitedJson } from "@/lib/server/read-limited-json"

const OPENROUTER_URL = process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1/chat/completions"
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

function normalizeMessages(messages: unknown) {
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

    const apiKey = process.env.OPENROUTER_API_KEY_2 ?? process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key is not configured." }, { status: 500 })
    }

    const userName = user.name.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100)

    const userContext = userName
      ? ` The signed-in user's name is ${JSON.stringify(userName)}. Address them by name naturally when appropriate, but do not force their name into every reply.`
      : ""

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://luciferapi.com",
        "X-OpenRouter-Title": "LUCIFER AI",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content:
              `You are LUCIFER AI, a concise technical assistant for K Praveenkumar. Answer the user's latest question directly. Do not introduce yourself, repeat your capabilities, add meta commentary, or include notes about what you can or cannot execute unless the user asks. Help with Python, AI, APIs, Next.js, automation, debugging, and creative experiments. Be practical and honest. Never claim to have performed actions you cannot perform.${userContext}`,
          },
          ...messages,
        ],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(45_000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "The OpenRouter request failed." }, { status: 502 })
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> }
    const content = data.choices?.[0]?.message?.content
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("")
        : ""

    const usesUiMessageStream = Array.isArray(body.messages) && body.messages.some((message) => Array.isArray(message.parts))

    if (request.headers.get("accept")?.includes("text/plain") || new URL(request.url).searchParams.get("format") === "text" || !usesUiMessageStream) {
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const textId = "openrouter-text"

        try {
          writer.write({ type: "text-start", id: textId })
          writer.write({ type: "text-delta", id: textId, delta: text })
          writer.write({ type: "text-end", id: textId })
        } catch (error) {
          console.error("Failed to write the chat response stream.", error)
        }
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch {
    return NextResponse.json({ error: "The OpenRouter request failed." }, { status: 500 })
  }
}
