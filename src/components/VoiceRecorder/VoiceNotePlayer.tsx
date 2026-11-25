import { AlertCircle, Pause, Play } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDuration } from '../../utils/formatters';

const AUDIO_PLAY_EVENT = 'rsc:audio-play';

export interface VoiceNotePlayerProps {
  audioUrl: string;
  durationHint?: number;
  isOutgoing?: boolean;
  compact?: boolean;
}

export function VoiceNotePlayer({
  audioUrl,
  durationHint = 0,
  isOutgoing = false,
  compact = false,
}: VoiceNotePlayerProps) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(durationHint);
    setLoadError(false);
  }, [audioUrl, durationHint]);

  useEffect(() => {
    const handleOtherAudioPlay = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener(AUDIO_PLAY_EVENT, handleOtherAudioPlay);
    return () => {
      window.removeEventListener(AUDIO_PLAY_EVENT, handleOtherAudioPlay);
    };
  }, [playerId]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || loadError) return;

    if (audio.paused) {
      window.dispatchEvent(new CustomEvent(AUDIO_PLAY_EVENT, { detail: playerId }));
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setLoadError(true);
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function handleSeek(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const effectiveDuration = Number.isFinite(duration) && duration > 0 ? duration : durationHint || 1;
  const progressPct = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  return (
    <div className={`flex items-center gap-2.5 ${compact ? 'min-w-[180px]' : 'w-56 sm:w-64'}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setLoadError(true);
          setIsPlaying(false);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={loadError}
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
          isOutgoing
            ? 'bg-white text-[#0F766E] hover:bg-teal-50'
            : 'bg-[#0F766E] text-white hover:bg-[#115E59]'
        }`}
      >
        {loadError ? (
          <AlertCircle className="h-4 w-4" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="relative h-5 flex items-center">
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${
              isOutgoing ? 'bg-white/25' : 'bg-slate-200'
            }`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                isOutgoing ? 'bg-white' : 'bg-[#0F766E]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.1}
            value={Math.min(currentTime, effectiveDuration)}
            onChange={(e) => handleSeek(Number(e.target.value))}
            aria-label="Seek voice note"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div
          className={`flex items-center justify-between text-[11px] font-mono-tabular ${
            isOutgoing ? 'text-teal-100' : 'text-slate-500'
          }`}
        >
          <span>{loadError ? 'Unavailable' : formatDuration(isPlaying || currentTime > 0 ? currentTime : 0)}</span>
          <span>{formatDuration(duration > 0 ? duration : durationHint)}</span>
        </div>
      </div>
    </div>
  );
}
