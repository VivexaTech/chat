import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatClient } from '../sdk/createChatClient';
import { normalizeChatError } from '../services/firebase';
import type {
  ChatError,
  ChatMessage,
  Conversation,
  LocationData,
  UploadProgress,
} from '../types/chat.types';

export interface UseMessagesOptions {
  client: ChatClient;
  conversation: Conversation | null;
  currentUid: string | null;
  pageSize?: number;
  onMessageSent?: (message: ChatMessage) => void;
  onError?: (error: ChatError) => void;
}

export function useMessages(options: UseMessagesOptions) {
  const { client, conversation, currentUid, pageSize, onMessageSent, onError } = options;
  const conversationId = conversation?.id ?? null;

  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [archivedById, setArchivedById] = useState<Map<string, ChatMessage>>(() => new Map());
  const [oldestCursor, setOldestCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );

  const cursorInitializedRef = useRef(false);
  const previousLiveRef = useRef<ChatMessage[]>([]);
  const markedReadIdsRef = useRef<Set<string>>(new Set());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSentRef = useRef(onMessageSent);
  onSentRef.current = onMessageSent;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Subscribe to real-time window of newest messages
  useEffect(() => {
    setLiveMessages([]);
    setArchivedById(new Map());
    setOldestCursor(null);
    setHasMore(false);
    cursorInitializedRef.current = false;
    previousLiveRef.current = [];
    markedReadIdsRef.current.clear();

    if (!conversationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = client.messages.subscribeLatest(
      conversationId,
      (result) => {
        const prevLive = previousLiveRef.current;
        const nextIds = new Set(result.messages.map((m) => m.id));
        const evicted = prevLive.filter((m) => !nextIds.has(m.id));

        if (evicted.length > 0) {
          setArchivedById((prevMap) => {
            const nextMap = new Map(prevMap);
            for (const msg of evicted) {
              nextMap.set(msg.id, msg);
            }
            return nextMap;
          });
        }

        previousLiveRef.current = result.messages;
        setLiveMessages(result.messages);

        if (!cursorInitializedRef.current) {
          cursorInitializedRef.current = true;
          setOldestCursor(result.oldestCursor);
          setHasMore(result.hasMore);
        }

        setLoading(false);
      },
      (err) => {
        setLoading(false);
        onErrorRef.current?.(normalizeChatError(err, 'Failed to stream messages.'));
      },
      pageSize,
    );

    return () => unsubscribe();
  }, [client, conversationId, pageSize]);

  // Merge archived/paginated messages + live messages chronologically without duplicates
  const messages = useMemo(() => {
    const merged = new Map<string, ChatMessage>(archivedById);
    for (const msg of liveMessages) {
      merged.set(msg.id, msg);
    }
    return Array.from(merged.values()).sort((a, b) => {
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      return a.id.localeCompare(b.id);
    });
  }, [archivedById, liveMessages]);

  // Automatically mark incoming messages in active visible chat as read & reset unread badge
  useEffect(() => {
    if (!conversation || !currentUid || !isTabVisible) return;

    const unreadIncomingIds = messages
      .filter(
        (m) =>
          m.senderId !== currentUid &&
          !m.readBy.includes(currentUid) &&
          !markedReadIdsRef.current.has(m.id),
      )
      .map((m) => m.id);

    const hasUnreadCounter = (conversation.unreadCounts[currentUid] ?? 0) > 0;
    if (unreadIncomingIds.length === 0 && !hasUnreadCounter) return;

    for (const id of unreadIncomingIds) {
      markedReadIdsRef.current.add(id);
    }

    void client.messages
      .markRead(conversation.id, unreadIncomingIds, currentUid, hasUnreadCounter)
      .catch(() => {
        for (const id of unreadIncomingIds) {
          markedReadIdsRef.current.delete(id);
        }
      });
  }, [client, conversation, currentUid, isTabVisible, messages]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !oldestCursor || loadingOlder || !hasMore) return;

    setLoadingOlder(true);
    try {
      const older = await client.messages.loadOlder(conversationId, oldestCursor, pageSize);
      setArchivedById((prev) => {
        const next = new Map(prev);
        for (const msg of older.messages) {
          next.set(msg.id, msg);
        }
        return next;
      });
      setOldestCursor(older.oldestCursor);
      setHasMore(older.hasMore);
    } catch (err) {
      onErrorRef.current?.(normalizeChatError(err, 'Failed to load older messages.'));
    } finally {
      setLoadingOlder(false);
    }
  }, [client, conversationId, hasMore, loadingOlder, oldestCursor, pageSize]);

  const sendText = useCallback(
    async (text: string) => {
      if (!conversation || !currentUid) return null;
      setSending(true);
      try {
        const sent = await client.messages.sendText(conversation, currentUid, text);
        onSentRef.current?.(sent);
        return sent;
      } catch (err) {
        onErrorRef.current?.(normalizeChatError(err, 'Failed to send message.'));
        return null;
      } finally {
        setSending(false);
      }
    },
    [client, conversation, currentUid],
  );

  const sendImage = useCallback(
    async (file: File, caption?: string) => {
      if (!conversation || !currentUid) return null;
      setSending(true);
      setUploadProgress({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'running',
      });
      try {
        const { downloadURL, mediaMetadata } = await client.media.uploadImage({
          conversationId: conversation.id,
          senderId: currentUid,
          file,
          onProgress: (p) => setUploadProgress(p),
        });
        const sent = await client.messages.sendImage(
          conversation,
          currentUid,
          downloadURL,
          mediaMetadata,
          caption,
        );
        onSentRef.current?.(sent);
        return sent;
      } catch (err) {
        onErrorRef.current?.(normalizeChatError(err, 'Failed to upload and send image.'));
        return null;
      } finally {
        setSending(false);
        setUploadProgress(null);
      }
    },
    [client, conversation, currentUid],
  );

  const sendVoiceNote = useCallback(
    async (blob: Blob, durationSec: number) => {
      if (!conversation || !currentUid) return null;
      setSending(true);
      setUploadProgress({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: blob.size,
        state: 'running',
      });
      try {
        const { downloadURL, mediaMetadata } = await client.media.uploadVoiceNote({
          conversationId: conversation.id,
          senderId: currentUid,
          blob,
          durationSec,
          onProgress: (p) => setUploadProgress(p),
        });
        const sent = await client.messages.sendVoice(
          conversation,
          currentUid,
          downloadURL,
          mediaMetadata,
        );
        onSentRef.current?.(sent);
        return sent;
      } catch (err) {
        onErrorRef.current?.(normalizeChatError(err, 'Failed to upload voice note.'));
        return null;
      } finally {
        setSending(false);
        setUploadProgress(null);
      }
    },
    [client, conversation, currentUid],
  );

  const sendLocation = useCallback(
    async (location: LocationData) => {
      if (!conversation || !currentUid) return null;
      setSending(true);
      try {
        const sent = await client.messages.sendLocation(conversation, currentUid, location);
        onSentRef.current?.(sent);
        return sent;
      } catch (err) {
        onErrorRef.current?.(normalizeChatError(err, 'Failed to share location.'));
        return null;
      } finally {
        setSending(false);
      }
    },
    [client, conversation, currentUid],
  );

  return {
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
  };
}
