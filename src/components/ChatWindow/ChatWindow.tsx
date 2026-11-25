import { ArrowLeft, ChevronDown, Loader2, MessageSquare } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
      <section className="flex-1 h-full flex items-center justify-center bg-[#F4F5F7] p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 text-[#0F766E] flex items-center justify-center mx-auto shadow-xs">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Select a conversation</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
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
    <section className="flex-1 flex flex-col h-full min-w-0 bg-[#F4F5F7] relative">
      {/* Chat Header */}
      <header className="bg-white border-b border-slate-900/8 px-3 sm:px-5 py-3 flex items-center gap-3 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="md:hidden h-9 w-9 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <Avatar name={recipient.name} photoURL={recipient.photoURL} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 truncate">{recipient.name}</h2>
            {recipient.role && recipient.role !== 'user' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-50 text-[#0F766E] capitalize shrink-0">
                {recipient.role}
              </span>
            )}
          </div>
          <p
            className={`text-xs truncate ${
              typingLabel ? 'text-[#0F766E] font-medium' : 'text-slate-500'
            }`}
          >
            {typingLabel ?? recipient.email ?? 'Repair Series conversation'}
          </p>
        </div>
      </header>

      {/* Message History */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden rsc-scroll px-3 sm:px-6 py-4"
      >
        {hasMore && (
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={() => void handleLoadOlder()}
              disabled={loadingOlder}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              {loadingOlder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{loadingOlder ? 'Loading older messages...' : 'Load older messages'}</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#0F766E]" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4">
            <div className="max-w-xs text-center rounded-2xl bg-white border border-slate-200/80 px-5 py-6 shadow-2xs space-y-1.5">
              <p className="text-sm font-medium text-slate-800">No messages yet</p>
              <p className="text-xs text-slate-500 leading-relaxed">
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
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200/80 text-[11px] font-medium text-slate-500 shadow-2xs">
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
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white border border-slate-900/8 px-3.5 py-2.5 shadow-2xs">
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                  </span>
                  <span className="text-xs text-slate-600">{typingLabel}</span>
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
          className="absolute bottom-20 right-5 z-20 h-9 px-3 rounded-full bg-white border border-slate-200 shadow-md text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 transition-colors cursor-pointer"
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
