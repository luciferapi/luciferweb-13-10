"use client"

import type React from "react"

import { useState, useRef, useCallback, type KeyboardEvent, useEffect } from "react"
import { Square, Mic, MicOff, Brain, Paperclip, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { AudioWaveform } from "./audio-waveform"

export type AIModel =
  | "google/gemini-2.5-flash"
  | "openai/gpt-4o"
  | "openai/gpt-4.1"
  | "anthropic/claude-sonnet-4"
  | "anthropic/claude-sonnet-4.5"
  | "meta-llama/llama-3.3-70b-instruct"

type SpeechRecognitionResult = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionResultEvent = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResult>
}

type SpeechRecognitionErrorEvent = {
  error: string
}

type SpeechRecognitionController = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionController

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export const AI_MODELS: { id: AIModel; name: string; icon: string }[] = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5", icon: "/images/google.webp" },
  { id: "openai/gpt-4o", name: "GPT-4o", icon: "/images/gpt.png" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", icon: "/images/gpt.png" },
  { id: "anthropic/claude-sonnet-4", name: "Claude 4", icon: "/images/claude.svg" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude 4.5", icon: "/images/claude.svg" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", icon: "/images/llama.png" },
]

interface ComposerProps {
  onSend: (content: string, imageData?: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  selectedModel: AIModel
  onModelChange: (model: AIModel) => void
}

export function Composer({ onSend, onStop, isStreaming, disabled, selectedModel, onModelChange }: ComposerProps) {
  const [value, setValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [showImageBounce, setShowImageBounce] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionController | null>(null)
  const baseTextRef = useRef("")
  const finalTranscriptsRef = useRef("")

  function handleInput() {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = "en-US"

        recognitionRef.current.onresult = (event: SpeechRecognitionResultEvent) => {
          let newFinalText = ""

          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const transcript = event.results[i][0].transcript
              newFinalText += transcript + " "
            }
          }

          if (newFinalText) {
            finalTranscriptsRef.current += newFinalText
            setValue(baseTextRef.current + finalTranscriptsRef.current)
            window.setTimeout(handleInput, 0)
          }
        }

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("[v0] Speech recognition error:", event.error)
          setIsRecording(false)
        }

        recognitionRef.current.onend = () => {
          setIsRecording(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const playClickSound = useCallback(() => {
    const audio = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/click-FM4Xaa1FJj237591TiZw4yL1fIxdOw.mp3")
    audio.volume = 0.5
    audio.play().catch(() => {})
  }, [])

  const playRecordSound = useCallback(() => {
    const audio = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/record-CNHOyjcpri6lx5C2sGXncDtFVDwspO.mp3")
    audio.volume = 0.5
    audio.play().catch(() => {})
  }, [])

  const toggleRecording = useCallback(() => {
    playClickSound()

    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser")
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop())
        setMediaStream(null)
      }
    } else {
      playRecordSound()
      baseTextRef.current = value
      finalTranscriptsRef.current = ""
      recognitionRef.current.start()
      setIsRecording(true)

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          setMediaStream(stream)
        })
        .catch((err) => {
          console.error("[v0] Error getting microphone stream:", err)
        })
    }
  }, [isRecording, value, playClickSound, playRecordSound, mediaStream])

  const handleSend = useCallback(() => {
    if ((!value.trim() && !uploadedImage) || isStreaming || disabled) return
    playClickSound()

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
    onSend(value || "Describe this image", uploadedImage || undefined)
    setValue("")
    setUploadedImage(null)
    baseTextRef.current = ""
    finalTranscriptsRef.current = ""
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [value, uploadedImage, isStreaming, disabled, onSend, isRecording, playClickSound])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      playClickSound()

      const file = e.target.files?.[0]
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setUploadedImage(event.target?.result as string)
          setShowImageBounce(true)
          setTimeout(() => setShowImageBounce(false), 400)
        }
        reader.readAsDataURL(file)
      }
      e.target.value = ""
    },
    [playClickSound],
  )

  const removeImage = useCallback(() => {
    setUploadedImage(null)
  }, [])

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0]

  return (
    <div className={cn("fixed bottom-4 left-0 right-0 px-4 pointer-events-none z-10", "composer-intro")}>
      <div className="relative max-w-2xl mx-auto pointer-events-auto">
        <div
          className={cn(
            "flex flex-col gap-3 border border-slate-700/80 bg-slate-950/90 p-4 transition-all duration-200 relative overflow-hidden rounded-3xl backdrop-blur-xl",
            "focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/10",
          )}
          style={{
            boxShadow:
              "0 18px 60px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div className="flex gap-2 items-center">
            {uploadedImage && (
              <div className={cn("relative shrink-0", showImageBounce && "image-bounce")}>
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700">
                  <img src={uploadedImage} alt="Uploaded image" className="h-full w-full object-cover" />
                </div>
                <button
                  onClick={removeImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-800 hover:bg-stone-900 text-white rounded-full flex items-center justify-center transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                handleInput()
              }}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening..." : "Type a message... (Shift+Enter for new line)"}
              disabled={isStreaming || disabled}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500",
                "focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                "max-h-[56px] overflow-y-auto",
              )}
              aria-label="Message input"
            />

            {isRecording && (
              <div className="shrink-0 w-24">
                <AudioWaveform isRecording={isRecording} stream={mediaStream} />
              </div>
            )}

            {isStreaming ? (
              <button
                onClick={() => {
                  playClickSound()
                  onStop()
                }}
                className="flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-50"
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={(!value.trim() && !uploadedImage) || disabled}
                className={cn(
                  "flex items-center gap-2 rounded-full bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50",
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload image"
            />

            <div className="relative">
              <Button
                onClick={toggleRecording}
                disabled={isStreaming || disabled}
                size="icon"
                className={cn(
                  "h-9 w-9 shrink-0 transition-all rounded-full relative z-10",
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 text-white animate-bounce-subtle"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200",
                )}
                aria-label={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            </div>

            <Button
              onClick={() => {
                playClickSound()
                fileInputRef.current?.click()
              }}
              disabled={isStreaming || disabled}
              size="icon"
              className="h-9 w-9 shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full"
              aria-label="Attach image"
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className="bg-slate-800" asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isStreaming || disabled}
                  className="h-9 w-9 shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full"
                  aria-label="Select AI model"
                  onClick={playClickSound}
                >
                  <Brain className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="w-48 max-h-64 overflow-y-auto px-2 py-2 rounded-2xl z-[9999] border-slate-700 bg-slate-900 text-slate-100"
                >
                  {AI_MODELS.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => {
                        playClickSound()
                        onModelChange(model.id)
                      }}
                      className={cn(
                        "flex items-center cursor-pointer gap-3 rounded-lg",
                        selectedModel === model.id && "bg-slate-800 text-cyan-200",
                      )}
                    >
                      <span className="flex size-5 items-center justify-center rounded-sm bg-slate-800 text-[10px] font-bold text-slate-300" aria-hidden="true">
                        {model.name.slice(0, 1)}
                      </span>
                      <span className="text-sm">{model.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>

            <span className="text-xs font-medium tracking-wide text-slate-400">{currentModel.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
