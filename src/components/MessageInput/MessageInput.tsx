import { AlertCircle, Mic, Paperclip, SendHorizontal, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import type { UploadProgress } from '../../types/chat.types';
import { formatFileSize } from '../../utils/formatters';
import { AttachmentMenu } from '../AttachmentMenu/AttachmentMenu';
import { VoiceRecorder } from '../VoiceRecorder/VoiceRecorder';

export interface MessageInputProps {
  disabled?: boolean;
  sending?: boolean;
  locating?: boolean;
  uploadProgress: UploadProgress | null;
  validateImageFile: (file: File) => { valid: boolean; error?: string };
  onSendText: (text: string) => Promise<unknown>;
  onSendImage: (file: File, caption?: string) => Promise<unknown>;
  onSendVoiceNote: (blob: Blob, durationSec: number) => Promise<unknown>;
  onRequestLocation: () => Promise<void>;
  onTyping: () => void;
  onStopTyping: () => void;
}

export function MessageInput({
  disabled = false,
  sending = false,
  locating = false,
  uploadProgress,
  validateImageFile,
  onSendText,
  onSendImage,
  onSendVoiceNote,
  onRequestLocation,
  onTyping,
  onStopTyping,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [stagedImage, setStagedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (stagedImage?.previewUrl) {
        URL.revokeObjectURL(stagedImage.previewUrl);
      }
    };
  }, [stagedImage]);

  function autoResizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    setLocalError(null);
    autoResizeTextarea();
    if (val.trim().length > 0) {
      onTyping();
    } else {
      onStopTyping();
    }
  }

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setLocalError(validation.error ?? 'Invalid image file.');
      return;
    }

    if (stagedImage?.previewUrl) {
      URL.revokeObjectURL(stagedImage.previewUrl);
    }
    setLocalError(null);
    setStagedImage({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function clearStagedImage() {
    if (stagedImage?.previewUrl) {
      URL.revokeObjectURL(stagedImage.previewUrl);
    }
    setStagedImage(null);
  }

  async function handleSubmit() {
    if (disabled || sending) return;

    if (stagedImage) {
      const fileToSend = stagedImage.file;
      const caption = text.trim();
      onStopTyping();
      const result = await onSendImage(fileToSend, caption || undefined);
      if (result) {
        clearStagedImage();
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    onStopTyping();
    const sent = await onSendText(trimmed);
    if (sent) {
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const canSend = Boolean(stagedImage || text.trim().length > 0);

  return (
    <div className="bg-white border-t border-[#2B1B12]/8 px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2.5 shrink-0">
      {localError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="truncate sm:whitespace-normal">{localError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            aria-label="Dismiss error"
            className="p-0.5 text-red-600 hover:text-red-800 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {uploadProgress && uploadProgress.state === 'running' && (
        <div className="rounded-xl border border-[#2B1B12]/10 bg-[#FAF8F5] px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#5C4D45]">
            <span>Uploading attachment...</span>
            <span className="font-mono-tabular font-medium text-[#1F1612]">
              {uploadProgress.progress}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#E7E0D8] overflow-hidden">
            <div
              className="h-full bg-[#7C1620] transition-[width] duration-150"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
        </div>
      )}

      {stagedImage && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#2B1B12]/10 bg-[#FAF8F5] p-2.5">
          <img
            src={stagedImage.previewUrl}
            alt={stagedImage.file.name}
            className="h-16 w-16 rounded-xl object-cover border border-[#2B1B12]/10 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#1F1612] truncate">{stagedImage.file.name}</p>
            <p className="text-[11px] font-mono-tabular text-[#6E5C52] mt-0.5">
              {formatFileSize(stagedImage.file.size)} · Ready to send
            </p>
          </div>
          <button
            type="button"
            onClick={clearStagedImage}
            disabled={sending}
            aria-label="Remove staged image"
            className="h-8 w-8 rounded-lg text-[#6E5C52] hover:text-[#1F1612] hover:bg-[#EFEAE4] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {recordingVoice ? (
        <VoiceRecorder
          sending={sending}
          onCancel={() => setRecordingVoice(false)}
          onSendVoiceNote={async (blob, durationSec) => {
            const sent = await onSendVoiceNote(blob, durationSec);
            if (sent) {
              setRecordingVoice(false);
            }
          }}
        />
      ) : (
        <div className="relative flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelected}
            className="hidden"
          />

          <AttachmentMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onPickImage={() => fileInputRef.current?.click()}
            onShareLocation={() => {
              void onRequestLocation().catch((err) => {
                setLocalError(
                  err instanceof Error ? err.message : 'Unable to retrieve your current location.',
                );
              });
            }}
            locating={locating}
          />

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={disabled || sending}
            aria-label="Attach image or location"
            aria-expanded={menuOpen}
            className="h-10 w-10 rounded-xl border border-[#2B1B12]/12 bg-white hover:bg-[#F6F4F1] text-[#5C4D45] hover:text-[#7C1620] disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0 rounded-2xl border border-[#2B1B12]/10 bg-[#F6F4F1] focus-within:bg-white focus-within:border-[#7C1620] focus-within:ring-2 focus-within:ring-[#7C1620]/15 transition-colors px-3.5 py-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onBlur={() => onStopTyping()}
              disabled={disabled || sending}
              placeholder={stagedImage ? 'Add an optional caption...' : 'Message'}
              className="w-full resize-none bg-transparent text-base sm:text-sm text-[#1F1612] placeholder:text-[#9C8B80] focus:outline-none max-h-[120px] leading-5"
            />
          </div>

          {canSend ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={disabled || sending}
              aria-label="Send message"
              className="h-10 w-10 rounded-xl bg-[#7C1620] hover:bg-[#631018] disabled:opacity-50 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setRecordingVoice(true);
              }}
              disabled={disabled || sending}
              aria-label="Record voice note"
              className="h-10 w-10 rounded-xl border border-[#2B1B12]/12 bg-white hover:bg-[#F6F4F1] text-[#5C4D45] hover:text-[#7C1620] disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
