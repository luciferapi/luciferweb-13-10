import type { ModelMessage } from "ai"
import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { chooseAutomaticModule, findBuiltInModule } from "@/features/chat/modules"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { readLimitedJson } from "@/lib/server/read-limited-json"

const DEFAULT_OLLAMA_MODEL = "llama3.2"
const DEFAULT_OPENROUTER_MODEL = "openrouter/auto"
const OPENROUTER_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function getDefaultOpenRouterModel() {
  const configured = process.env.OPENROUTER_MODEL?.trim()
  return configured && OPENROUTER_MODEL_PATTERN.test(configured)
    ? configured
    : DEFAULT_OPENROUTER_MODEL
}

function getDefaultModelId() {
  if (process.env.OPENROUTER_API_KEY?.trim()) return getDefaultOpenRouterModel()
  return `ollama/${process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL}`
}

function normalizeModelId(model?: string) {
  if (!model) return getDefaultModelId()

  const trimmed = model.trim()
  const normalized = trimmed.startsWith("~") ? trimmed.slice(1) : trimmed

  if (normalized.startsWith("ollama/")) {
    const ollamaModel = normalized.slice("ollama/".length).trim()
    if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(ollamaModel)) {
      return process.env.OPENROUTER_API_KEY?.trim()
        ? getDefaultOpenRouterModel()
        : `ollama/${ollamaModel}`
    }
  }

  if (process.env.OPENROUTER_API_KEY?.trim() && OPENROUTER_MODEL_PATTERN.test(normalized)) {
    return normalized
  }

  return getDefaultModelId()
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

function getModulePrompt(body: Record<string, unknown>, messages: ModelMessage[]) {
  const classifierMessages = messages.map((message) => ({
    role: message.role,
    content: typeof message.content === "string" ? message.content : "",
  }))
  const requestedModule = body.module
  if (!requestedModule || typeof requestedModule !== "object") {
    return findBuiltInModule(chooseAutomaticModule(classifierMessages))
  }

  const moduleRecord = requestedModule as Record<string, unknown>
  const moduleId = typeof moduleRecord.id === "string" ? moduleRecord.id.trim() : "auto"
  if (moduleId === "auto") return findBuiltInModule(chooseAutomaticModule(classifierMessages))

  const builtIn = findBuiltInModule(moduleId)
  if (builtIn && builtIn.id !== "auto") return builtIn

  const instructions = typeof moduleRecord.instructions === "string" ? moduleRecord.instructions.trim().slice(0, 4000) : ""
  const name = typeof moduleRecord.name === "string" ? moduleRecord.name.trim().slice(0, 80) : "Custom module"
  if (!instructions) return findBuiltInModule(chooseAutomaticModule(classifierMessages))
  return { id: moduleId, name: name || "Custom module", description: "User-configured module", instructions }
}

function isOllamaModel(modelId: string) {
  return modelId.startsWith("ollama/")
}

function parseOpenRouterStreamLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed.startsWith("data:")) return ""

  const data = trimmed.slice("data:".length).trim()
  if (!data || data === "[DONE]") return ""

  const payload = JSON.parse(data) as {
    choices?: Array<{ delta?: { content?: unknown } }>
    error?: string | { message?: string }
  }
  if (payload.error) {
    const detail = typeof payload.error === "string" ? payload.error : payload.error.message
    throw new Error(detail || "OpenRouter returned an error.")
  }

  const content = payload.choices?.[0]?.delta?.content
  return typeof content === "string" ? content : ""
}

async function streamOpenRouterResponse(system: string, messages: ModelMessage[], modelId: string) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.")

  const configuredUrl = process.env.OPENROUTER_URL?.trim() || "https://openrouter.ai/api/v1"
  const endpointUrl = new URL(configuredUrl)
  const configuredPath = endpointUrl.pathname.replace(/\/+$/, "")
  const versionedPath = /\/(?:api\/)?v1$/.test(configuredPath)
    ? configuredPath
    : `${configuredPath}/api/v1`
  endpointUrl.pathname = configuredPath.endsWith("/chat/completions")
    ? configuredPath
    : `${versionedPath}/chat/completions`
  const response = await fetch(endpointUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://luciferapi.com",
      "X-Title": "LUCIFER AI",
    },
    body: JSON.stringify({
      model: modelId,
      stream: true,
      max_tokens: 1200,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "")
    throw new Error(`OpenRouter request failed (${response.status}): ${detail.slice(0, 300)}`)
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
            const text = parseOpenRouterStreamLine(line)
            if (text) controller.enqueue(encoder.encode(text))
          }
          if (done) break
        }
        if (pending.trim()) {
          const text = parseOpenRouterStreamLine(pending)
          if (text) controller.enqueue(encoder.encode(text))
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

async function streamOllamaResponse(system: string, messages: ModelMessage[], modelId: string) {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").trim().replace(/\/$/, "")
  const model = modelId.slice("ollama/".length) || (process.env.OLLAMA_MODEL ?? "llama3.2").trim()
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
    const activeModule = getModulePrompt(body as Record<string, unknown>, messages)
    const moduleContext = activeModule?.instructions
      ? ` Active module: ${activeModule.name}. Module guidance: ${activeModule.instructions}`
      : ""
    const systemWithModule = `${system}${moduleContext}`

    if (isOllamaModel(modelId)) {
      return await streamOllamaResponse(systemWithModule, messages, modelId)
    }
    return await streamOpenRouterResponse(systemWithModule, messages, modelId)
  } catch (error) {
    console.error("[chat] Provider request failed", error)
    return NextResponse.json(
      { error: "LUCIFER AI could not complete that response. Please try again." },
      { status: 502 },
    )
  }
}
