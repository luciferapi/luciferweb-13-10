interface AnalysisWordSpanProps {
  word: string
}

export function AnalysisWordSpan({ word }: AnalysisWordSpanProps) {
  return <span className="inline">{word}</span>
}
