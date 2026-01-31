"use client";

import { cn } from "@/lib/utils";
import { MicIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  voiceUrl: string;
  transcript?: string | null;
  duration?: number | null;
  isMe?: boolean;
  className?: string;
};

export default function VoiceMessagePlayer({
  voiceUrl,
  transcript,
  duration,
  isMe = false,
  className,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Format time as M:SS - handle invalid values
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Generate consistent waveform heights (memoized)
  const waveformHeights = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => {
      const baseHeight = Math.sin((i / 40) * Math.PI * 2.5) * 0.4 + 0.5;
      const variation = Math.sin(i * 5.7) * 0.25;
      return Math.max(0.15, Math.min(1, baseHeight + variation));
    });
  }, []);

  // Handle play/pause
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Reset if ended
      if (audio.ended) {
        audio.currentTime = 0;
      }
      audio.play().catch((err) => {
        console.error("Playback error:", err);
        setHasError(true);
      });
    }
  }, [isPlaying, hasError]);

  // Handle seeking on waveform click
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const waveform = waveformRef.current;
      if (!audio || !waveform || hasError) return;

      const rect = waveform.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * (audioDuration || audio.duration || 0);
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [audioDuration, hasError],
  );

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      // Only update if we get a valid finite duration from the audio element
      if (
        audio.duration &&
        isFinite(audio.duration) &&
        !isNaN(audio.duration)
      ) {
        setAudioDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleLoadedData = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Try to get duration during playback if we don't have it yet
      if (
        audio.duration &&
        isFinite(audio.duration) &&
        !isNaN(audio.duration)
      ) {
        setAudioDuration((prev) => (prev > 0 ? prev : audio.duration));
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setHasError(true);
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("loadeddata", handleLoadedData);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    // Try to load
    audio.load();

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("loadeddata", handleLoadedData);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [voiceUrl]);

  // Use database duration as fallback when audio element duration isn't available
  const effectiveDuration =
    audioDuration > 0 && isFinite(audioDuration)
      ? audioDuration
      : duration || 0;
  // Progress percentage
  const progress =
    effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className={cn("min-w-[160px] max-w-[240px]", className)}>
      {/* Compact voice message bubble */}
      <div
        className={cn(
          "rounded-xl p-2",
          isMe
            ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10"
            : "bg-white/5",
        )}
      >
        <div className="flex items-center gap-2">
          {/* Play/Pause button */}
          <button
            type="button"
            onClick={togglePlayback}
            disabled={isLoading || hasError}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0",
              isMe
                ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                : "bg-cyan-500 hover:bg-cyan-400 text-white",
              (isLoading || hasError) && "opacity-60",
            )}
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : hasError ? (
              <MicIcon className="w-3.5 h-3.5 opacity-50" />
            ) : isPlaying ? (
              <PauseIcon className="w-3.5 h-3.5 fill-current" />
            ) : (
              <PlayIcon className="w-3.5 h-3.5 ml-0.5 fill-current" />
            )}
          </button>

          {/* Waveform and time */}
          <div className="flex-1 flex flex-col gap-1">
            {/* Clickable waveform */}
            <div
              ref={waveformRef}
              className="flex items-center gap-[2px] h-5 cursor-pointer"
              onClick={handleSeek}
            >
              {waveformHeights.map((height, i) => {
                const barProgress = (i / waveformHeights.length) * 100;
                const isPlayed = barProgress <= progress;

                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-full transition-colors duration-100",
                      isPlayed
                        ? isMe
                          ? "bg-emerald-400"
                          : "bg-cyan-400"
                        : isMe
                          ? "bg-emerald-500/30"
                          : "bg-white/20",
                    )}
                    style={{ height: `${height * 100}%` }}
                  />
                );
              })}
            </div>

            {/* Time display */}
            <div className="flex items-center justify-between text-[10px] text-white/50 font-medium tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>
        </div>

        {/* Transcript always visible inside bubble */}
        {transcript && (
          <p className="mt-1.5 pt-1.5 border-t border-white/10 text-[11px] leading-relaxed text-white/70">
            {transcript}
          </p>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={voiceUrl}
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  );
}
