"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowDown, Loader2, Send, Sparkles } from "lucide-react"
import { useState } from "react"

function getDisplayText(text: string) {
  if (!text.includes("data:")) return text

  const deltas: string[] = []
  const dataPattern = /data:\s*(\{[\s\S]*?\})(?=\s*data:|\s*\[DONE\]|$)/g
  let match: RegExpExecArray | null

  while ((match = dataPattern.exec(text)) !== null) {
    try {
      const payload = JSON.parse(match[1]) as { delta?: string }
      if (typeof payload.delta === "string") deltas.push(payload.delta)
    } catch {
      // Ignore malformed protocol frames.
    }
  }

  if (deltas.length > 0) return deltas.join("")

  return text
    .split("\\n")
    .filter((line) => !/^\\s*(data:|\\[DONE\\])/i.test(line))
    .join("\\n")
    .trim()
}

export function AiChatSection() {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })
  const isLoading = status === "submitted" || status === "streaming"

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input.trim() || isLoading) return
    await sendMessage({ text: input.trim() })
    setInput("")
  }

  return (
    <section id="ai-chat" className="relative overflow-hidden bg-[#0d0d12] px-6 py-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.1),transparent_28%),radial-gradient(circle_at_85%_80%,rgba(217,70,239,0.12),transparent_32%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div><p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">{"// talk to luciferai"}</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Ask. Explore. Build.</h2><p className="mt-4 max-w-xl text-white/55">Click the girl, land here, and start a conversation about your next idea.</p></div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 font-mono text-xs text-cyan-200"><Sparkles className="h-4 w-4" /> LUCIFER AI online</div>
        </div>
        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-black/30 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="border-b border-white/10 bg-white/[0.03] p-7 lg:border-b-0 lg:border-r"><div className="flex items-center gap-3"><div className="h-12 w-12 overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/15"><img src="/images/ai-logo.jpg" alt="LUCIFER AI logo" className="h-full w-full object-cover" /></div><div><p className="font-semibold">LUCIFER AI assistant</p><p className="font-mono text-xs text-white/35">developer mode / ready</p></div></div><div className="mt-10 space-y-3 text-sm text-white/55"><p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">Try asking:</p>{["How do I build my first API?", "Explain a Python idea simply", "Help me plan an AI project"].map((prompt) => <button key={prompt} type="button" onClick={() => setInput(prompt)} className="block w-full rounded-2xl border border-white/10 px-4 py-3 text-left transition hover:border-cyan-300/40 hover:text-cyan-200">{prompt}<ArrowDown className="mt-1 h-3 w-3 opacity-40" /></button>)}</div></div>
          <div className="flex min-h-[480px] flex-col"><div className="flex-1 space-y-5 overflow-y-auto p-6">{messages.length === 0 ? <div className="flex h-full min-h-72 flex-col items-center justify-center text-center"><div className="mb-4 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 p-4"><Sparkles className="h-7 w-7 text-fuchsia-300" /></div><p className="font-semibold">Your next build starts here.</p><p className="mt-2 max-w-sm text-sm text-white/40">Ask LUCIFER AI anything about code, AI, APIs, or your next experiment.</p></div> : messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-fuchsia-400/15 text-fuchsia-100" : "bg-white/[0.06] text-white/75"}`}>{message.parts?.map((part, index) => part.type === "text" ? <span key={`${message.id}-${index}`}>{getDisplayText(part.text)}</span> : null)}</div></div>)}</div><form onSubmit={submitMessage} className="border-t border-white/10 p-4"><div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-cyan-300/40"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask LUCIFER AI something..." className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30" aria-label="Message LUCIFER AI" /><button type="submit" disabled={!input.trim() || isLoading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-cyan-200 disabled:opacity-40" aria-label="Send message">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div></form></div>
        </div>
      </div>
    </section>
  )
}
