"use client"

/*
  hooks/useVoiceInput.ts

  MediaRecorder → Groq Whisper pipeline.

  Flow:
    1. User clicks mic → MediaRecorder starts capturing audio
    2. User clicks again (or silence timer fires) → recording stops
    3. Audio blob sent to /voice/transcribe
    4. Transcript returned → onTranscript() called → message sent

  Why MediaRecorder instead of Web Speech API?
    Web Speech API sends audio to Google and fails with "network" errors
    in many environments. MediaRecorder is a native browser API that
    works everywhere and keeps audio on your own backend.
*/

import { useState, useRef, useCallback, useEffect } from "react"

export type VoiceState = "idle" | "listening" | "processing" | "unsupported"

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  silenceTimeoutMs?: number
}

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : "http://localhost:8000"

export function useVoiceInput({
  onTranscript,
  silenceTimeoutMs = 8000, // 8s max recording before auto-stop
}: UseVoiceInputOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Check MediaRecorder support on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setVoiceState("unsupported")
    }
    return () => {
      stopStream()
      silenceTimerRef.current && clearTimeout(silenceTimerRef.current)
    }
  }, [])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const sendAudioToWhisper = useCallback(
    async (blob: Blob) => {
      setVoiceState("processing")
      try {
        const formData = new FormData()
        formData.append("file", blob, "audio.webm")

        const res = await fetch(`${API_BASE}/voice/transcribe`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          console.error("[Voice] Transcription failed:", await res.text())
          setVoiceState("idle")
          return
        }

        const data = await res.json()
        const transcript = data.transcript?.trim()

        if (transcript) {
          onTranscript(transcript)
        } else {
          console.warn("[Voice] Empty transcript returned")
        }
      } catch (err) {
        console.error("[Voice] Network error:", err)
      } finally {
        setVoiceState("idle")
      }
    },
    [onTranscript],
  )

  const startListening = useCallback(async () => {
    if (voiceState !== "idle") return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      // Pick best supported format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg"

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stopStream()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        if (blob.size > 0) {
          await sendAudioToWhisper(blob)
        } else {
          setVoiceState("idle")
        }
      }

      recorder.onerror = (e) => {
        console.error("[Voice] MediaRecorder error:", e)
        setVoiceState("idle")
        stopStream()
      }

      recorder.start(100) // collect chunks every 100ms
      setVoiceState("listening")

      // Auto-stop after silenceTimeoutMs
      silenceTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop()
        }
      }, silenceTimeoutMs)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        alert(
          "Microphone access denied. Please allow microphone access in your browser settings.",
        )
      } else {
        console.error("[Voice] Failed to start:", err)
      }
      setVoiceState("idle")
      stopStream()
    }
  }, [voiceState, sendAudioToWhisper, silenceTimeoutMs])

  const stopListening = useCallback(() => {
    silenceTimerRef.current && clearTimeout(silenceTimerRef.current)
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (voiceState === "listening") {
      stopListening()
    } else if (voiceState === "idle") {
      startListening()
    }
  }, [voiceState, startListening, stopListening])

  return {
    voiceState,
    interimText:
      voiceState === "listening" ? "Recording... click mic to send" : "",
    toggleListening,
    isListening: voiceState === "listening",
    isUnsupported: voiceState === "unsupported",
  }
}
