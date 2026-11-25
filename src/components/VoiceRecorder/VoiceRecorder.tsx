import { AlertCircle, Mic, SendHorizontal, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_LIMITS } from '../../config/chat.config';
import { getSupportedAudioMimeType } from '../../services/media.service';
import { formatDuration } from '../../utils/formatters';
import { VoiceNotePlayer } from './VoiceNotePlayer';

export interface VoiceRecorderProps {
  sending?: boolean;
  onCancel: () => void;
  onSendVoiceNote: (blob: Blob, durationSec: number) => Promise<void>;
}

type RecorderPhase = 'initializing' | 'recording' | 'preview' | 'error';

export function VoiceRecorder({
  sending = false,
  onCancel,
  onSendVoiceNote,
}: VoiceRecorderProps) {
  const [phase, setPhase] = useState<RecorderPhase>('initializing');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(14).fill(0.18));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const cleanupMedia = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore cleanup stop errors
        }
      }
      cleanupMedia();
    };
  }, [cleanupMedia]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setPhase('initializing');
    cancelledRef.current = false;
    chunksRef.current = [];
    setElapsedSec(0);
    durationRef.current = 0;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setPhase('error');
      setErrorMsg('Voice recording is not supported in this browser or requires a secure HTTPS/localhost context.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }

      streamRef.current = stream;
      const mimeType = getSupportedAudioMimeType();
      const recorder = MediaRecorder.isTypeSupported(mimeType)
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupMedia();
        if (cancelledRef.current) return;

        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        if (blob.size <= 0) {
          setPhase('error');
          setErrorMsg('Recording was too short or empty. Please try again.');
          return;
        }

        const nextUrl = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setPreviewUrl(nextUrl);
        setPhase('preview');
      };

      recorder.onerror = () => {
        cleanupMedia();
        setPhase('error');
        setErrorMsg('An error occurred while recording audio.');
      };

      // Optional live frequency meter
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);

          const sample = () => {
            if (!audioContextRef.current) return;
            analyser.getByteFrequencyData(data);
            const bars: number[] = [];
            for (let i = 0; i < 14; i += 1) {
              const value = (data[i % data.length] ?? 0) / 255;
              bars.push(Math.max(0.16, Math.min(1, value)));
            }
            setLevels(bars);
            rafRef.current = requestAnimationFrame(sample);
          };
          rafRef.current = requestAnimationFrame(sample);
        }
      } catch {
        // Non-critical visualizer fallback
      }

      recorder.start(250);
      startTimeRef.current = Date.now();
      setPhase('recording');

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        durationRef.current = secs;
        setElapsedSec(secs);
        if (secs >= CHAT_LIMITS.MAX_VOICE_DURATION_SEC) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 250);
    } catch (err) {
      cleanupMedia();
      setPhase('error');
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorMsg('Microphone permission denied. Allow microphone access in your browser to record voice notes.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorMsg('No microphone device was detected.');
      } else {
        setErrorMsg('Unable to access microphone. Check device permissions and try again.');
      }
    }
  }, [cleanupMedia]);

  useEffect(() => {
    void startRecording();
  }, [startRecording]);

  function handleStop() {
    durationRef.current = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    setElapsedSec(durationRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    cleanupMedia();
    onCancel();
  }

  async function handleSend() {
    if (!recordedBlob || sending) return;
    await onSendVoiceNote(recordedBlob, Math.max(1, durationRef.current || elapsedSec));
  }

  if (phase === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="truncate sm:whitespace-normal">{errorMsg}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void startRecording()}
            className="h-7 px-2.5 rounded-lg bg-white border border-red-200 text-red-800 hover:bg-red-100 font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="h-7 px-2.5 rounded-lg text-red-700 hover:bg-red-100 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'preview' && previewUrl) {
    return (
      <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-[#2B1B12]/10 bg-[#FAF8F5] px-3 py-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={sending}
          aria-label="Discard voice recording"
          className="h-9 w-9 rounded-xl text-[#6E5C52] hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <VoiceNotePlayer audioUrl={previewUrl} durationHint={elapsedSec} compact />
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          aria-label="Send voice note"
          className="h-9 px-3.5 rounded-xl bg-[#7C1620] hover:bg-[#631018] disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
        >
          <span>{sending ? 'Sending...' : 'Send'}</span>
          <SendHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#C86B3C]/25 bg-[#FDF4EE] px-3 py-2">
      <button
        type="button"
        onClick={handleCancel}
        aria-label="Cancel voice recording"
        className="h-9 w-9 rounded-xl text-[#5C4D45] hover:text-red-600 hover:bg-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="h-2.5 w-2.5 rounded-full bg-[#7C1620] shrink-0 animate-pulse" />
        <span className="text-xs font-mono-tabular font-medium text-[#1F1612] shrink-0">
          {phase === 'initializing' ? 'Starting...' : formatDuration(elapsedSec)}
        </span>

        <div className="flex items-center gap-1 flex-1 min-w-0 h-6 overflow-hidden" aria-hidden="true">
          {levels.map((lvl, idx) => (
            <span
              key={idx}
              className="w-1 rounded-full bg-[#C86B3C]/75 transition-[height] duration-75"
              style={{ height: `${Math.round(lvl * 20) + 4}px` }}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleStop}
        disabled={phase !== 'recording'}
        aria-label="Stop recording and preview"
        className="h-9 px-3 rounded-xl bg-[#7C1620] hover:bg-[#631018] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
      >
        <Mic className="h-3.5 w-3.5" />
        <Square className="h-3 w-3 fill-current" />
        <span className="hidden sm:inline">Stop</span>
      </button>
    </div>
  );
}
