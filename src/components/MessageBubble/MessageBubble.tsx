import { Check, CheckCheck, Clock, Download, Maximize2 } from 'lucide-react';
import { downloadMediaFile } from '../../services/media.service';
import type { ChatMessage, MessageDeliveryStatus } from '../../types/chat.types';
import { formatFileSize, formatMessageTime } from '../../utils/formatters';
import { LocationMessage } from '../LocationMessage/LocationMessage';
import { VoiceNotePlayer } from '../VoiceRecorder/VoiceNotePlayer';

export interface MessageBubbleProps {
  message: ChatMessage;
  isOutgoing: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  deliveryStatus: MessageDeliveryStatus;
  senderName?: string;
  onOpenImage: (message: ChatMessage) => void;
}

function DeliveryStatusIcon({ status }: { status: MessageDeliveryStatus }) {
  if (status === 'sending') {
    return (
      <span title="Sending" aria-label="Sending" className="inline-flex items-center text-white/65">
        <Clock className="h-3 w-3" />
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span title="Sent" aria-label="Sent" className="inline-flex items-center text-white/75">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span title="Delivered" aria-label="Delivered" className="inline-flex items-center text-white/75">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span title="Read" aria-label="Read" className="inline-flex items-center text-[#FCD34D]">
      <CheckCheck className="h-3.5 w-3.5" />
    </span>
  );
}

export function MessageBubble({
  message,
  isOutgoing,
  isFirstInGroup,
  isLastInGroup,
  deliveryStatus,
  senderName,
  onOpenImage,
}: MessageBubbleProps) {
  const cornerClasses = isOutgoing
    ? [
        'rounded-2xl',
        !isFirstInGroup ? 'rounded-tr-md' : '',
        !isLastInGroup ? 'rounded-br-md' : 'rounded-br-sm',
      ].join(' ')
    : [
        'rounded-2xl',
        !isFirstInGroup ? 'rounded-tl-md' : '',
        !isLastInGroup ? 'rounded-bl-md' : 'rounded-bl-sm',
      ].join(' ');

  return (
    <div
      className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} ${
        isFirstInGroup ? 'mt-3' : 'mt-1'
      }`}
    >
      {!isOutgoing && isFirstInGroup && senderName && (
        <span className="text-[11px] font-medium text-[#6E5C52] px-1 mb-1">{senderName}</span>
      )}

      <div
        className={`max-w-[82%] sm:max-w-[72%] px-3.5 py-2.5 shadow-2xs ${cornerClasses} ${
          isOutgoing
            ? 'bg-[#7C1620] text-white'
            : 'bg-white text-[#1F1612] border border-[#2B1B12]/8'
        }`}
      >
        {message.messageType === 'image' && message.mediaURL && (
          <div className="space-y-2">
            <div className="relative group rounded-xl overflow-hidden bg-[#1F1612]/10">
              <button
                type="button"
                onClick={() => onOpenImage(message)}
                aria-label="Open full-screen image"
                className="block w-full text-left cursor-pointer"
              >
                <img
                  src={message.mediaURL}
                  alt={message.text || message.mediaMetadata?.fileName || 'Shared photo'}
                  loading="lazy"
                  className="max-h-72 w-full min-w-[180px] max-w-[280px] sm:max-w-[320px] object-cover rounded-xl"
                />
              </button>

              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onOpenImage(message)}
                  aria-label="View full screen"
                  className="h-7 w-7 rounded-lg bg-[#1F1612]/70 hover:bg-[#1F1612]/90 text-white flex items-center justify-center cursor-pointer"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void downloadMediaFile(
                      message.mediaURL!,
                      message.mediaMetadata?.fileName ?? 'image',
                    )
                  }
                  aria-label="Download image"
                  className="h-7 w-7 rounded-lg bg-[#1F1612]/70 hover:bg-[#1F1612]/90 text-white flex items-center justify-center cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {message.text && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
            )}
            {message.mediaMetadata?.size ? (
              <p
                className={`text-[11px] font-mono-tabular ${
                  isOutgoing ? 'text-rose-100/80' : 'text-[#85746A]'
                }`}
              >
                {formatFileSize(message.mediaMetadata.size)}
              </p>
            ) : null}
          </div>
        )}

        {message.messageType === 'audio' && message.mediaURL && (
          <VoiceNotePlayer
            audioUrl={message.mediaURL}
            durationHint={message.mediaMetadata?.duration ?? 0}
            isOutgoing={isOutgoing}
          />
        )}

        {message.messageType === 'location' && message.location && (
          <LocationMessage location={message.location} isOutgoing={isOutgoing} />
        )}

        {message.messageType === 'text' && message.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        )}

        <div
          className={`flex items-center justify-end gap-1.5 mt-1 select-none ${
            isOutgoing ? 'text-rose-100/85' : 'text-[#85746A]'
          }`}
        >
          <span className="text-[11px] font-mono-tabular leading-none">
            {formatMessageTime(message.createdAtMs)}
          </span>
          {isOutgoing && <DeliveryStatusIcon status={deliveryStatus} />}
        </div>
      </div>
    </div>
  );
}
