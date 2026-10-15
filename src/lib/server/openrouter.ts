const DEFAULT_OPENROUTER_MODEL = "openrouter/auto"
const OPENROUTER_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || null
}

export function getOpenRouterModel(requestedModel?: string) {
  const requested = requestedModel?.trim()
  if (requested && OPENROUTER_MODEL_PATTERN.test(requested)) return requested

  const configured = process.env.OPENROUTER_MODEL?.trim()
  return configured && OPENROUTER_MODEL_PATTERN.test(configured)
    ? configured
    : DEFAULT_OPENROUTER_MODEL
}

export function getOpenRouterEndpoint() {
  const configuredUrl = process.env.OPENROUTER_URL?.trim() || "https://openrouter.ai/api/v1"
  const endpointUrl = new URL(configuredUrl)
  const configuredPath = endpointUrl.pathname.replace(/\/+$/, "")
  const versionedPath = /\/(?:api\/)?v1$/.test(configuredPath)
    ? configuredPath
    : `${configuredPath}/api/v1`

  endpointUrl.pathname = configuredPath.endsWith("/chat/completions")
    ? configuredPath
    : `${versionedPath}/chat/completions`

  return endpointUrl.toString()
}

export function getOpenRouterHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://luciferapi.com",
    "X-Title": "LUCIFER AI",
  }
}
