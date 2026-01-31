"use client";

import { cn } from "@/lib/utils";
import { PauseIcon, PlayIcon, SendIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  threadId: string;
  themeColor?: string;
  onCancel: () => void;
  onSent: () => void;
};

export default function InlineVoiceRecorder({
  threadId,
  themeColor,
  onCancel,
  onSent,
}: Props) {
  // Recording state
  const [isRecording, setIsRecording] = useState(true); // Start recording immediately
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Audio data
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>("");
  const hasStartedRef = useRef(false);

  // Check browser support
  const SpeechRecognitionImpl = useMemo(() => {
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    return w?.SpeechRecognition || w?.webkitSpeechRecognition || null;
  }, []);

  // Format time as M:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!SpeechRecognitionImpl) return;

    try {
      const rec: SpeechRecognition = new SpeechRecognitionImpl();
      recognitionRef.current = rec;
      transcriptRef.current = "";

      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = "";
        let interimText = "";

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            finalText += text + " ";
          } else {
            interimText += text;
          }
        }

        transcriptRef.current = (finalText + interimText).trim();
        setTranscript(transcriptRef.current);
      };

      rec.onerror = () => {
        // Silent fail - audio is more important
      };

      rec.onend = () => {
        // Restart if still recording
        if (isRecording && !isPaused && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // Already started or ended
          }
        }
      };

      rec.start();
    } catch {
      // Speech recognition not available
    }
  }, [SpeechRecognitionImpl, isRecording, isPaused]);

  // Stop speech recognition
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Start recording immediately on mount
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        // Determine best supported format
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "audio/wav";

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          setAudioBlob(blob);
        };

        // Start recording
        mediaRecorder.start(500);
        setIsRecording(true);

        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

        // Start speech recognition
        if (SpeechRecognitionImpl) {
          startSpeechRecognition();
        }
      } catch (err) {
        console.error("Error starting recording:", err);
        toast.error("Could not access microphone");
        onCancel();
      }
    };

    startRecording();
  }, [SpeechRecognitionImpl, startSpeechRecognition, onCancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      stopSpeechRecognition();
    };
  }, [stopSpeechRecognition]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      if (SpeechRecognitionImpl) {
        startSpeechRecognition();
      }
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopSpeechRecognition();
    }
    setIsPaused(!isPaused);
  }, [
    isPaused,
    SpeechRecognitionImpl,
    startSpeechRecognition,
    stopSpeechRecognition,
  ]);

  // Cancel and cleanup
  const handleCancel = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    stopSpeechRecognition();
    onCancel();
  }, [stopSpeechRecognition, onCancel]);

  // Send voice message
  const handleSend = useCallback(async () => {
    // Stop recording first
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopSpeechRecognition();
    setIsRecording(false);
    setIsSending(true);

    // Wait for blob to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Get the blob from chunks directly
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });

      if (blob.size === 0) {
        toast.error("No audio recorded");
        onCancel();
        return;
      }

      // Create form data
      const formData = new FormData();
      const extension = mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("mp4")
          ? "m4a"
          : "wav";
      formData.append("audio", blob, `voice-${Date.now()}.${extension}`);
      formData.append("thread_id", threadId);
      formData.append("transcript", transcriptRef.current || "");
      formData.append("duration", recordingTime.toString());

      const res = await fetch("/api/hub/voice-message", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send");
      }

      // Stop stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      toast.success("Voice message sent!");
      onSent();
    } catch (err) {
      console.error("Send error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send voice message",
      );
      setIsSending(false);
    }
  }, [threadId, recordingTime, stopSpeechRecognition, onCancel, onSent]);

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Live transcript while recording */}
      {transcript && (
        <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
              Live Transcript
            </span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{transcript}</p>
        </div>
      )}

      {/* Recording controls */}
      <div className="flex items-center gap-2">
        {/* Cancel button */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSending}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-50"
          title="Cancel"
        >
          <Trash2Icon className="w-5 h-5" />
        </button>

        {/* Recording indicator and waveform area */}
        <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
          {/* Recording dot */}
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0",
              isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse",
            )}
          />

          {/* Timer */}
          <span className="text-sm font-medium text-white/80 tabular-nums w-12">
            {formatTime(recordingTime)}
          </span>

          {/* Waveform visualization */}
          <div className="flex-1 flex items-center justify-center gap-0.5 h-6 overflow-hidden">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-all duration-150",
                  isPaused ? "bg-white/20" : "bg-white/40",
                )}
                style={{
                  height: isPaused
                    ? "20%"
                    : `${20 + Math.sin((Date.now() / 150 + i) * 0.5) * 30 + Math.random() * 30}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>

          {/* Pause/Resume button */}
          <button
            type="button"
            onClick={togglePause}
            disabled={isSending}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-50"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <PlayIcon className="w-4 h-4" />
            ) : (
              <PauseIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || recordingTime < 1}
          className="p-2.5 rounded-full text-white transition-all disabled:opacity-50"
          style={{
            background: themeColor
              ? `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`
              : "linear-gradient(135deg, #22c55e, #16a34a)",
          }}
          title="Send"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <SendIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
