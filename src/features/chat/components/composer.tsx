"use client"

import type React from "react"

import { useState, useRef, useCallback, type KeyboardEvent, useEffect } from "react"
import gsap from "gsap"
import Image from "next/image"
import { ArrowUp, Mic, MicOff, Paperclip, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AudioWaveform } from "./audio-waveform"

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

interface ComposerProps {
  onSend: (content: string, imageData?: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function Composer({ onSend, onStop, isStreaming, disabled }: ComposerProps) {
  const [value, setValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionController | null>(null)
  const baseTextRef = useRef("")
  const finalTranscriptsRef = useRef("")

  useEffect(() => {
    const composer = composerRef.current
    if (!composer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const context = gsap.context(() => {
      gsap.fromTo(
        composer,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          delay: 0.12,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        },
      )
    }, composer)

    return () => context.revert()
  }, [])

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

  const toggleRecording = useCallback(() => {
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
  }, [isRecording, value, mediaStream])

  const handleSend = useCallback(() => {
    if ((!value.trim() && !uploadedImage) || isStreaming || disabled) return

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
  }, [value, uploadedImage, isStreaming, disabled, onSend, isRecording])

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
      const file = e.target.files?.[0]
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setUploadedImage(event.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
      e.target.value = ""
    },
    [],
  )

  const removeImage = useCallback(() => {
    setUploadedImage(null)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-10 px-3 sm:bottom-5 sm:px-6 xl:left-0 xl:right-[var(--navigation-width)]">
      <div ref={composerRef} className="pointer-events-auto relative mx-auto w-full max-w-4xl">
        <div
          className={cn(
            "relative z-10 flex flex-col gap-2 rounded-[1.75rem] border border-zinc-600/80 bg-zinc-900/95 p-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.48),0_0_0_1px_rgba(163,230,53,0.06)] backdrop-blur-xl transition-colors duration-200 sm:p-3",
            "focus-within:border-lime-300/55 focus-within:ring-2 focus-within:ring-lime-300/15",
          )}
        >
          {uploadedImage && (
            <div className="relative ml-1 mt-1 size-14 overflow-hidden rounded-xl border border-white/10">
              <Image src={uploadedImage} alt="Image attached to message" width={56} height={56} unoptimized className="size-full object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/75 text-white transition hover:bg-black"
                aria-label="Remove attached image"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload image"
          />

          <div className="flex items-end gap-2">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || disabled}
              size="icon"
              variant="outline"
              className="size-10 shrink-0 rounded-full border-zinc-700 bg-zinc-800 text-lime-200 shadow-sm hover:border-lime-300/50 hover:bg-zinc-700 hover:text-lime-100"
              aria-label="Attach image"
              title="Attach image"
            >
              <Paperclip className="size-[18px]" aria-hidden="true" />
            </Button>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                handleInput()
              }}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening…" : "Message Lucifer AI"}
              disabled={isStreaming || disabled}
              rows={1}
              className={cn(
                "min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-zinc-100 placeholder:text-zinc-400",
                "focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                "max-h-40 overflow-y-auto",
              )}
              aria-label="Message input"
            />

            {isRecording && (
              <div className="hidden w-20 shrink-0 sm:block">
                <AudioWaveform isRecording={isRecording} stream={mediaStream} />
              </div>
            )}

            <Button
              type="button"
              onClick={toggleRecording}
              disabled={isStreaming || disabled}
              size="icon"
              variant="ghost"
              className={cn(
                "size-10 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 text-lime-200 shadow-sm transition hover:border-lime-300/50 hover:bg-zinc-700 hover:text-lime-100",
                isRecording && "bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200",
              )}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff className="size-[18px]" aria-hidden="true" /> : <Mic className="size-[18px]" aria-hidden="true" />}
            </Button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-lime-400/30 bg-zinc-800 text-lime-300 transition hover:bg-lime-400/10"
                aria-label="Stop generating"
                title="Stop generating"
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={(!value.trim() && !uploadedImage) || disabled}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-lime-400 text-zinc-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                aria-label="Send message"
                title="Send message"
              >
                <ArrowUp className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="hidden items-center justify-between px-3 pb-0.5 text-[11px] text-zinc-400 sm:flex">
            <span>AI can make mistakes. Verify important details.</span>
            <span><kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-300">Enter</kbd> to send <span className="px-1 text-zinc-600">·</span> <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-300">Shift + Enter</kbd> for a new line</span>
          </div>
        </div>
      </div>
    </div>
  )
}
