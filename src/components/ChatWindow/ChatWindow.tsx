import { ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import repairSeriesLogo from '../../assets/repair-series-logo.png';
import { useMessages } from '../../hooks/useMessages';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import type { ChatClient } from '../../sdk/createChatClient';
import { getOtherParticipant } from '../../services/chat.service';
import type {
  ChatAuthUser,
  ChatError,
  ChatMessage,
  ChatUser,
  Conversation,
  LocationData,
} from '../../types/chat.types';
import { formatDateDivider, isSameDay } from '../../utils/formatters';
import { Avatar } from '../common/Avatar';
import { ImageViewer } from '../ImageViewer/ImageViewer';
import { LocationConfirmModal } from '../LocationMessage/LocationMessage';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import { MessageInput } from '../MessageInput/MessageInput';

export interface ChatWindowProps {
  client: ChatClient;
  currentUser: ChatAuthUser;
  conversation: Conversation | null;
  availableUsers?: ChatUser[];
  pageSize?: number;
  onBack?: () => void;
  onMessageSent?: (message: ChatMessage) => void;
  onError?: (error: ChatError) => void;
}

const GROUP_WINDOW_MS = 3 * 60 * 1000;

export function ChatWindow({
  client,
  currentUser,
  conversation,
  availableUsers,
  pageSize,
  onBack,
  onMessageSent,
  onError,
}: ChatWindowProps) {
  const {
    messages,
    loading,
    loadingOlder,
    hasMore,
    sending,
    uploadProgress,
    loadOlder,
    sendText,
    sendImage,
    sendVoiceNote,
    sendLocation,
  } = useMessages({
    client,
    conversation,
    currentUid: currentUser.uid,
    pageSize,
    onMessageSent,
    onError,
  });

  const { typingLabel, notifyTyping, stopTyping } = useTypingIndicator({
    client,
    conversationId: conversation?.id ?? null,
    currentUser,
  });

  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LocationData | null>(null);
  const [locating, setLocating] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevConversationIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const prependingHistoryRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  // Reset scroll tracking on conversation switch
  useEffect(() => {
    if (prevConversationIdRef.current !== (conversation?.id ?? null)) {
      prevConversationIdRef.current = conversation?.id ?? null;
      prevMessageCountRef.current = 0;
      isNearBottomRef.current = true;
      setShowJumpToLatest(false);
      setViewerMessage(null);
      setPendingLocation(null);
    }
  }, [conversation?.id]);

  // Keep latest messages visible when the mobile keyboard shrinks the message pane
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [conversation?.id]);

  // Preserve scroll offset when prepending older messages, or auto-scroll to newest message
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (prependingHistoryRef.current) {
      const { scrollHeight: prevH, scrollTop: prevT } = prependingHistoryRef.current;
      prependingHistoryRef.current = null;
      el.scrollTop = el.scrollHeight - prevH + prevT;
      prevMessageCountRef.current = messages.length;
      return;
    }

    const latestMsg = messages[messages.length - 1];
    const isInitialBatch = prevMessageCountRef.current === 0 && messages.length > 0;
    const isOwnLatest = latestMsg?.senderId === currentUser.uid;
    const grew = messages.length > prevMessageCountRef.current;

    if (isInitialBatch || (grew && (isNearBottomRef.current || isOwnLatest))) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToLatest(false);
    } else if (typingLabel && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    prevMessageCountRef.current = messages.length;
  }, [currentUser.uid, messages, typingLabel]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && messages.length > 0);
  }

  async function handleLoadOlder() {
    const el = scrollContainerRef.current;
    if (el) {
      prependingHistoryRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
    }
    await loadOlder();
  }

  function scrollToBottom() {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setShowJumpToLatest(false);
  }

  async function handleRequestLocation() {
    setLocating(true);
    try {
      const coords = await client.location.getCurrentPosition();
      setPendingLocation(coords);
    } finally {
      setLocating(false);
    }
  }

  if (!conversation) {
    return (
      <section className="flex-1 h-full flex items-center justify-center bg-[#F6F4F1] p-6">
        <div className="max-w-sm text-center space-y-3.5">
          <div className="h-16 w-16 rounded-2xl bg-white border border-[#2B1B12]/10 p-2.5 flex items-center justify-center mx-auto shadow-xs">
            <img
              src={repairSeriesLogo}
              alt="Repair Series Connect"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#1F1612]">Select a conversation</h2>
            <p className="text-xs text-[#6E5C52] leading-relaxed">
              Choose a thread from the sidebar or start a new conversation to exchange messages,
              photos, voice notes, and locations.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const baseRecipient = getOtherParticipant(conversation, currentUser.uid);
  const liveRecipient = availableUsers?.find((u) => u.uid === baseRecipient.uid);
  const recipient = liveRecipient
    ? {
        ...baseRecipient,
        name: liveRecipient.name,
        email: liveRecipient.email,
        photoURL: liveRecipient.photoURL,
        role: liveRecipient.role ?? baseRecipient.role,
      }
    : baseRecipient;

  return (
    <section className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden bg-[#F6F4F1] relative">
      {/* Pinned Chat Header — remains fixed above scrolling history even when mobile keyboard opens */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-[#2B1B12]/8 px-3 sm:px-5 py-3 flex items-center gap-3 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="md:hidden h-9 w-9 -ml-1 rounded-xl text-[#5C4D45] hover:text-[#1F1612] hover:bg-[#F6F4F1] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <Avatar name={recipient.name} photoURL={recipient.photoURL} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#1F1612] truncate">{recipient.name}</h2>
            {recipient.role && recipient.role !== 'user' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FDF2EC] text-[#9A4720] capitalize shrink-0">
                {recipient.role}
              </span>
            )}
          </div>
          <p
            className={`text-xs truncate ${
              typingLabel ? 'text-[#7C1620] font-medium' : 'text-[#6E5C52]'
            }`}
          >
            {typingLabel ?? recipient.email ?? 'Repair Series conversation'}
          </p>
        </div>

        <img
          src={repairSeriesLogo}
          alt=""
          aria-hidden="true"
          className="h-6 w-6 object-contain opacity-85 shrink-0 hidden sm:block"
        />
      </header>

      {/* Scrollable Message History */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain rsc-scroll px-3 sm:px-6 py-4"
      >
        {hasMore && (
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={() => void handleLoadOlder()}
              disabled={loadingOlder}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-white border border-[#2B1B12]/10 text-xs font-medium text-[#5C4D45] hover:text-[#1F1612] hover:bg-[#FAF8F5] shadow-2xs transition-colors cursor-pointer"
            >
              {loadingOlder && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7C1620]" />}
              <span>{loadingOlder ? 'Loading older messages...' : 'Load older messages'}</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[#6E5C52] gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#7C1620]" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4">
            <div className="max-w-xs text-center rounded-2xl bg-white border border-[#2B1B12]/8 px-5 py-6 shadow-2xs space-y-1.5">
              <p className="text-sm font-medium text-[#1F1612]">No messages yet</p>
              <p className="text-xs text-[#6E5C52] leading-relaxed">
                Send a message, photo, voice note, or current location to start this conversation.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((msg, index) => {
              const prev = index > 0 ? messages[index - 1] : undefined;
              const next = index < messages.length - 1 ? messages[index + 1] : undefined;
              const showDateDivider = !prev || !isSameDay(prev.createdAtMs, msg.createdAtMs);

              const sameSenderAsPrev =
                Boolean(prev) &&
                !showDateDivider &&
                prev?.senderId === msg.senderId &&
                msg.createdAtMs - (prev?.createdAtMs ?? 0) <= GROUP_WINDOW_MS;

              const sameSenderAsNext =
                Boolean(next) &&
                isSameDay(msg.createdAtMs, next?.createdAtMs ?? 0) &&
                next?.senderId === msg.senderId &&
                (next?.createdAtMs ?? 0) - msg.createdAtMs <= GROUP_WINDOW_MS;

              const isOutgoing = msg.senderId === currentUser.uid;
              const senderName =
                conversation.participantDetails[msg.senderId]?.name ?? recipient.name;

              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-1 rounded-full bg-white border border-[#2B1B12]/8 text-[11px] font-medium text-[#6E5C52] shadow-2xs">
                        {formatDateDivider(msg.createdAtMs)}
                      </span>
                    </div>
                  )}

                  <MessageBubble
                    message={msg}
                    isOutgoing={isOutgoing}
                    isFirstInGroup={!sameSenderAsPrev}
                    isLastInGroup={!sameSenderAsNext}
                    deliveryStatus={client.messages.getDeliveryStatus(msg, conversation.participants)}
                    senderName={conversation.participants.length > 2 ? senderName : undefined}
                    onOpenImage={(m) => setViewerMessage(m)}
                  />
                </div>
              );
            })}

            {typingLabel && (
              <div className="mt-3 flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white border border-[#2B1B12]/8 px-3.5 py-2.5 shadow-2xs">
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C86B3C]/70 animate-bounce [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C86B3C]/70 animate-bounce [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C86B3C]/70 animate-bounce" />
                  </span>
                  <span className="text-xs text-[#5C4D45]">{typingLabel}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Scroll to Latest button */}
      {showJumpToLatest && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          className="absolute bottom-20 right-5 z-20 h-9 px-3 rounded-full bg-white border border-[#2B1B12]/12 shadow-md text-xs font-medium text-[#3F312A] hover:text-[#7C1620] inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ChevronDown className="h-4 w-4" />
          <span className="hidden sm:inline">Latest</span>
        </button>
      )}

      {/* Composer */}
      <MessageInput
        sending={sending}
        locating={locating}
        uploadProgress={uploadProgress}
        validateImageFile={(file) => client.media.validateImageFile(file)}
        onSendText={sendText}
        onSendImage={sendImage}
        onSendVoiceNote={sendVoiceNote}
        onRequestLocation={handleRequestLocation}
        onTyping={notifyTyping}
        onStopTyping={() => void stopTyping()}
      />

      {/* Full-screen image lightbox */}
      {viewerMessage && viewerMessage.mediaURL && (
        <ImageViewer
          imageUrl={viewerMessage.mediaURL}
          fileName={viewerMessage.mediaMetadata?.fileName ?? 'image'}
          caption={viewerMessage.text}
          senderName={
            viewerMessage.senderId === currentUser.uid
              ? currentUser.name
              : conversation.participantDetails[viewerMessage.senderId]?.name ?? recipient.name
          }
          onClose={() => setViewerMessage(null)}
        />
      )}

      {/* Explicit user confirmation before sharing GPS coordinates */}
      {pendingLocation && (
        <LocationConfirmModal
          location={pendingLocation}
          sending={sending}
          onCancel={() => setPendingLocation(null)}
          onConfirm={async () => {
            const sent = await sendLocation(pendingLocation);
            if (sent) {
              setPendingLocation(null);
            }
          }}
        />
      )}
    </section>
  );
}
