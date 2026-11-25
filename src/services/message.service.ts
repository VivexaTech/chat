import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { CHAT_COLLECTIONS, CHAT_LIMITS } from '../config/chat.config';
import type {
  ChatMessage,
  Conversation,
  LocationData,
  MediaMetadata,
  MessageDeliveryStatus,
  MessageType,
} from '../types/chat.types';
import { formatMessagePreview, timestampToMs } from '../utils/formatters';

export interface MessagesPageResult {
  messages: ChatMessage[];
  oldestCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function mapMessageDoc(
  conversationId: string,
  docSnap: QueryDocumentSnapshot<DocumentData>,
): ChatMessage {
  const data = docSnap.data();
  const messageType: MessageType =
    data.messageType === 'image' ||
    data.messageType === 'audio' ||
    data.messageType === 'location'
      ? data.messageType
      : 'text';

  const rawMeta =
    typeof data.mediaMetadata === 'object' && data.mediaMetadata !== null
      ? (data.mediaMetadata as Record<string, unknown>)
      : null;

  const mediaMetadata: MediaMetadata | null = rawMeta
    ? {
        fileName: typeof rawMeta.fileName === 'string' ? rawMeta.fileName : 'attachment',
        mimeType: typeof rawMeta.mimeType === 'string' ? rawMeta.mimeType : '',
        size: typeof rawMeta.size === 'number' ? rawMeta.size : 0,
        ...(typeof rawMeta.width === 'number' ? { width: rawMeta.width } : {}),
        ...(typeof rawMeta.height === 'number' ? { height: rawMeta.height } : {}),
        ...(typeof rawMeta.duration === 'number' ? { duration: rawMeta.duration } : {}),
        ...(typeof rawMeta.publicId === 'string' ? { publicId: rawMeta.publicId } : {}),
        ...(rawMeta.resourceType === 'image' ||
        rawMeta.resourceType === 'video' ||
        rawMeta.resourceType === 'raw' ||
        rawMeta.resourceType === 'auto'
          ? { resourceType: rawMeta.resourceType }
          : {}),
        ...(typeof rawMeta.provider === 'string' ? { provider: rawMeta.provider } : {}),
      }
    : null;

  const rawLocation =
    typeof data.location === 'object' && data.location !== null
      ? (data.location as Record<string, unknown>)
      : null;

  const location: LocationData | null =
    rawLocation &&
    typeof rawLocation.latitude === 'number' &&
    typeof rawLocation.longitude === 'number'
      ? {
          latitude: rawLocation.latitude,
          longitude: rawLocation.longitude,
          ...(typeof rawLocation.accuracy === 'number' ? { accuracy: rawLocation.accuracy } : {}),
          ...(typeof rawLocation.label === 'string' ? { label: rawLocation.label } : {}),
        }
      : null;

  const createdAtMs = timestampToMs(data.createdAt as never) || Date.now();

  return {
    id: docSnap.id,
    conversationId,
    senderId: typeof data.senderId === 'string' ? data.senderId : '',
    messageType,
    text: typeof data.text === 'string' ? data.text : null,
    mediaURL: typeof data.mediaURL === 'string' ? data.mediaURL : null,
    mediaMetadata,
    location,
    createdAt: data.createdAt ?? createdAtMs,
    createdAtMs,
    readBy: Array.isArray(data.readBy)
      ? data.readBy.filter((v): v is string => typeof v === 'string')
      : [],
    deliveredTo: Array.isArray(data.deliveredTo)
      ? data.deliveredTo.filter((v): v is string => typeof v === 'string')
      : [],
    isPending: docSnap.metadata.hasPendingWrites,
  };
}

export function subscribeToLatestMessages(
  db: Firestore,
  conversationId: string,
  pageSize: number = CHAT_LIMITS.PAGE_SIZE,
  onResult: (result: MessagesPageResult) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const messagesRef = collection(
    db,
    CHAT_COLLECTIONS.CONVERSATIONS,
    conversationId,
    CHAT_COLLECTIONS.MESSAGES,
  );
  const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'), limit(pageSize));

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const descendingDocs = snapshot.docs;
      const oldestCursor =
        descendingDocs.length > 0 ? descendingDocs[descendingDocs.length - 1] ?? null : null;
      const messages = descendingDocs
        .map((docSnap) => mapMessageDoc(conversationId, docSnap))
        .reverse();

      onResult({
        messages,
        oldestCursor,
        hasMore: descendingDocs.length >= pageSize,
      });
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function loadOlderMessages(
  db: Firestore,
  conversationId: string,
  oldestCursor: QueryDocumentSnapshot<DocumentData>,
  pageSize: number = CHAT_LIMITS.PAGE_SIZE,
): Promise<MessagesPageResult> {
  const messagesRef = collection(
    db,
    CHAT_COLLECTIONS.CONVERSATIONS,
    conversationId,
    CHAT_COLLECTIONS.MESSAGES,
  );
  const olderQuery = query(
    messagesRef,
    orderBy('createdAt', 'desc'),
    startAfter(oldestCursor),
    limit(pageSize),
  );

  const snapshot = await getDocs(olderQuery);
  const descendingDocs = snapshot.docs;
  const nextOldest =
    descendingDocs.length > 0 ? descendingDocs[descendingDocs.length - 1] ?? null : null;

  return {
    messages: descendingDocs.map((docSnap) => mapMessageDoc(conversationId, docSnap)).reverse(),
    oldestCursor: nextOldest,
    hasMore: descendingDocs.length >= pageSize,
  };
}

interface DispatchPayload {
  messageType: MessageType;
  text: string | null;
  mediaURL: string | null;
  mediaMetadata: MediaMetadata | null;
  location: LocationData | null;
}

async function dispatchMessage(
  db: Firestore,
  conversation: Conversation,
  senderId: string,
  payload: DispatchPayload,
): Promise<ChatMessage> {
  const messagesCol = collection(
    db,
    CHAT_COLLECTIONS.CONVERSATIONS,
    conversation.id,
    CHAT_COLLECTIONS.MESSAGES,
  );
  const messageRef = doc(messagesCol);
  const convRef = doc(db, CHAT_COLLECTIONS.CONVERSATIONS, conversation.id);

  const batch = writeBatch(db);
  const nowMs = Date.now();

  batch.set(messageRef, {
    senderId,
    messageType: payload.messageType,
    text: payload.text,
    mediaURL: payload.mediaURL,
    mediaMetadata: payload.mediaMetadata,
    location: payload.location,
    createdAt: serverTimestamp(),
    readBy: [senderId],
    deliveredTo: [senderId],
  });

  const convUpdate: Record<string, unknown> = {
    lastMessage: formatMessagePreview(payload.text, payload.messageType),
    lastMessageType: payload.messageType,
    lastMessageId: messageRef.id,
    lastMessageSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    [`unreadCounts.${senderId}`]: 0,
  };

  for (const participantUid of conversation.participants) {
    if (participantUid !== senderId) {
      convUpdate[`unreadCounts.${participantUid}`] = increment(1);
    }
  }

  batch.update(convRef, convUpdate);
  await batch.commit();

  return {
    id: messageRef.id,
    conversationId: conversation.id,
    senderId,
    messageType: payload.messageType,
    text: payload.text,
    mediaURL: payload.mediaURL,
    mediaMetadata: payload.mediaMetadata,
    location: payload.location,
    createdAt: nowMs,
    createdAtMs: nowMs,
    readBy: [senderId],
    deliveredTo: [senderId],
    isPending: false,
  };
}

export async function sendTextMessage(
  db: Firestore,
  conversation: Conversation,
  senderId: string,
  rawText: string,
): Promise<ChatMessage> {
  const text = rawText.trim();
  if (!text) {
    throw new Error('Cannot send an empty message.');
  }
  if (text.length > CHAT_LIMITS.MAX_TEXT_LENGTH) {
    throw new Error(`Message exceeds ${CHAT_LIMITS.MAX_TEXT_LENGTH} characters.`);
  }

  return dispatchMessage(db, conversation, senderId, {
    messageType: 'text',
    text,
    mediaURL: null,
    mediaMetadata: null,
    location: null,
  });
}

export async function sendImageMessage(
  db: Firestore,
  conversation: Conversation,
  senderId: string,
  mediaURL: string,
  mediaMetadata: MediaMetadata,
  caption?: string,
): Promise<ChatMessage> {
  const cleanCaption = caption?.trim() || null;
  return dispatchMessage(db, conversation, senderId, {
    messageType: 'image',
    text: cleanCaption,
    mediaURL,
    mediaMetadata,
    location: null,
  });
}

export async function sendVoiceMessage(
  db: Firestore,
  conversation: Conversation,
  senderId: string,
  mediaURL: string,
  mediaMetadata: MediaMetadata,
): Promise<ChatMessage> {
  return dispatchMessage(db, conversation, senderId, {
    messageType: 'audio',
    text: null,
    mediaURL,
    mediaMetadata,
    location: null,
  });
}

export async function sendLocationMessage(
  db: Firestore,
  conversation: Conversation,
  senderId: string,
  location: LocationData,
): Promise<ChatMessage> {
  return dispatchMessage(db, conversation, senderId, {
    messageType: 'location',
    text: null,
    mediaURL: null,
    mediaMetadata: null,
    location,
  });
}

export async function markMessagesDelivered(
  db: Firestore,
  conversationId: string,
  messageIds: string[],
  uid: string,
  latestMessageId?: string,
): Promise<void> {
  if (messageIds.length === 0 && !latestMessageId) return;

  const batch = writeBatch(db);
  for (const messageId of messageIds.slice(0, 400)) {
    const msgRef = doc(
      db,
      CHAT_COLLECTIONS.CONVERSATIONS,
      conversationId,
      CHAT_COLLECTIONS.MESSAGES,
      messageId,
    );
    batch.update(msgRef, {
      deliveredTo: arrayUnion(uid),
    });
  }

  if (latestMessageId) {
    const convRef = doc(db, CHAT_COLLECTIONS.CONVERSATIONS, conversationId);
    batch.update(convRef, {
      [`lastDeliveredBy.${uid}`]: latestMessageId,
    });
  }

  await batch.commit();
}

export async function markMessagesRead(
  db: Firestore,
  conversationId: string,
  messageIds: string[],
  uid: string,
  resetUnreadCount: boolean,
): Promise<void> {
  if (messageIds.length === 0 && !resetUnreadCount) return;

  const batch = writeBatch(db);
  for (const messageId of messageIds.slice(0, 400)) {
    const msgRef = doc(
      db,
      CHAT_COLLECTIONS.CONVERSATIONS,
      conversationId,
      CHAT_COLLECTIONS.MESSAGES,
      messageId,
    );
    batch.update(msgRef, {
      deliveredTo: arrayUnion(uid),
      readBy: arrayUnion(uid),
    });
  }

  if (resetUnreadCount) {
    const convRef = doc(db, CHAT_COLLECTIONS.CONVERSATIONS, conversationId);
    batch.update(convRef, {
      [`unreadCounts.${uid}`]: 0,
    });
  }

  await batch.commit();
}

export function getMessageDeliveryStatus(
  message: ChatMessage,
  participants: string[],
): MessageDeliveryStatus {
  if (message.isPending) return 'sending';
  const others = participants.filter((uid) => uid !== message.senderId);
  if (others.length === 0) return 'read';

  const readByOther = others.some((uid) => message.readBy.includes(uid));
  if (readByOther) return 'read';

  const deliveredToOther = others.some((uid) => message.deliveredTo.includes(uid));
  if (deliveredToOther) return 'delivered';

  return 'sent';
}
