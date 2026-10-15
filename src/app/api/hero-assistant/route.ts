import { NextResponse } from "next/server"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import {
  getOpenRouterApiKey,
  getOpenRouterEndpoint,
  getOpenRouterHeaders,
  getOpenRouterModel,
} from "@/lib/server/openrouter"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
      { status: body.status },
    )
  }

  if (
    typeof body.value !== "object" ||
    body.value === null ||
    !("prompt" in body.value) ||
    typeof body.value.prompt !== "string"
  ) {
    return NextResponse.json({ error: "Enter a question for the assistant." }, { status: 400 })
  }

  const prompt = body.value.prompt.trim()
  if (!prompt) {
    return NextResponse.json({ error: "Enter a question for the assistant." }, { status: 400 })
  }
  if (prompt.length > 500) {
    return NextResponse.json({ error: "Keep the question under 500 characters." }, { status: 400 })
  }

  const rateLimitResponse = await enforceRateLimit(request, "hero-assistant", {
    capacity: 8,
    refillSeconds: 10 * 60,
  })
  if (rateLimitResponse) return rateLimitResponse

  const apiKey = getOpenRouterApiKey()
  if (!apiKey) return NextResponse.json({ error: "The assistant is temporarily unavailable." }, { status: 503 })

  let response: Response
  try {
    response = await fetch(getOpenRouterEndpoint(), {
      method: "POST",
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model: getOpenRouterModel(),
        stream: false,
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content:
              "You are the LUCIFER AI hero assistant. Give concise, practical answers about creative AI systems, APIs, modern web development, and turning ideas into useful prototypes. Keep replies under 80 words and do not claim to access private data.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    console.error("Hero assistant request to OpenRouter failed.", error)
    return NextResponse.json({ error: "The assistant is temporarily unavailable." }, { status: 502 })
  }

  if (!response.ok) {
    console.error("OpenRouter returned HTTP", response.status, "for the hero assistant.")
    return NextResponse.json({ error: "The assistant is temporarily unavailable." }, { status: 502 })
  }

  try {
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== "string" || !text.trim()) {
      console.error("OpenRouter returned no assistant text for the hero assistant.")
      return NextResponse.json({ error: "The assistant is temporarily unavailable." }, { status: 502 })
    }
    return NextResponse.json({ text: text.trim() })
  } catch {
    console.error("OpenRouter returned an invalid JSON response for the hero assistant.")
    return NextResponse.json({ error: "The assistant is temporarily unavailable." }, { status: 502 })
  }
}
