export const CHAT_MODULES_STORAGE_KEY = "chat-custom-modules"

export type BuiltInModuleId = "auto" | "coding" | "research" | "writing" | "debugging" | "study" | "creative"

export type CustomChatModule = {
  id: string
  name: string
  description: string
  instructions: string
}

export type ChatModuleChoice = {
  id: BuiltInModuleId | string
  name: string
  description: string
  instructions?: string
  custom?: boolean
}

export const BUILT_IN_CHAT_MODULES: ChatModuleChoice[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Chooses the best module for each request.",
  },
  {
    id: "coding",
    name: "Coding",
    description: "Build and explain reliable software.",
    instructions: "Focus on practical, production-ready code. Explain assumptions, show complete snippets when useful, and call out testing and security concerns.",
  },
  {
    id: "research",
    name: "Research",
    description: "Break down questions and compare evidence.",
    instructions: "Structure the response with clear findings, caveats, competing explanations, and concrete next steps. Do not invent sources or facts.",
  },
  {
    id: "writing",
    name: "Writing",
    description: "Draft, edit, and improve communication.",
    instructions: "Write clearly for the intended audience. Preserve the user's meaning, improve structure and tone, and provide a polished draft before optional notes.",
  },
  {
    id: "debugging",
    name: "Debugging",
    description: "Find causes and propose focused fixes.",
    instructions: "Diagnose systematically. State the likely root cause, distinguish evidence from guesses, and give the smallest safe fix followed by verification steps.",
  },
  {
    id: "study",
    name: "Study Coach",
    description: "Teach concepts step by step.",
    instructions: "Teach at the user's level using simple explanations, examples, checks for understanding, and a short practice exercise when appropriate.",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Generate and refine ideas.",
    instructions: "Offer original, specific ideas with useful variations. Prefer concrete concepts, structures, examples, and constraints over generic brainstorming.",
  },
]

function latestUserText(messages: Array<{ role: string; content: string }>) {
  return messages.filter((message) => message.role === "user").at(-1)?.content.toLowerCase() ?? ""
}

export function chooseAutomaticModule(messages: Array<{ role: string; content: string }>) {
  const text = latestUserText(messages)
  const scores: Array<[BuiltInModuleId, number]> = [
    ["debugging", /(error|bug|broken|fix|exception|not working|fails|failure|stack trace)/i.test(text) ? 5 : 0],
    ["coding", /(code|coding|program|api|javascript|typescript|python|react|next\.js|sql|html|css|function|build an app)/i.test(text) ? 4 : 0],
    ["research", /(research|compare|evidence|study|sources|analy[sz]e|investigate| pros and cons)/i.test(text) ? 4 : 0],
    ["writing", /(write|rewrite|draft|email|essay|blog|resume|copy|grammar|proofread)/i.test(text) ? 4 : 0],
    ["study", /(learn|teach|explain|quiz|tutorial|understand|homework|exam)/i.test(text) ? 3 : 0],
    ["creative", /(idea|story|creative|brainstorm|design|name|slogan|imagine|concept)/i.test(text) ? 3 : 0],
  ]
  scores.sort((left, right) => right[1] - left[1])
  return scores[0][1] > 0 ? scores[0][0] : "coding"
}

export function findBuiltInModule(id: string) {
  return BUILT_IN_CHAT_MODULES.find((module) => module.id === id)
}
