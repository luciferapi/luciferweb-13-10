export function TypingIndicator() {
  return (
    <div
      className="mr-auto flex items-center gap-1.5 px-1 py-3"
      role="status"
      aria-label="Lucifer AI is responding"
    >
      <span className="sr-only">Lucifer AI is responding</span>
      <span className="size-2 animate-bounce rounded-full bg-lime-300 [animation-delay:-0.3s]" />
      <span className="size-2 animate-bounce rounded-full bg-lime-300 [animation-delay:-0.15s]" />
      <span className="size-2 animate-bounce rounded-full bg-lime-300" />
    </div>
  )
}
