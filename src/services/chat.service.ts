import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { CHAT_COLLECTIONS } from '../config/chat.config';
import type {
  ChatUser,
  Conversation,
  MessageType,
  ParticipantDetail,
  TypingState,
} from '../types/chat.types';
import { buildDirectConversationId, timestampToMs } from '../utils/formatters';

function mapParticipantDetail(raw: unknown, uid: string): ParticipantDetail {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    uid: typeof obj.uid === 'string' ? obj.uid : uid,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Chat User',
    email: typeof obj.email === 'string' ? obj.email : undefined,
    photoURL: typeof obj.photoURL === 'string' ? obj.photoURL : null,
    role:
      obj.role === 'customer' ||
      obj.role === 'partner' ||
      obj.role === 'support' ||
      obj.role === 'user'
        ? obj.role
        : undefined,
  };
}

function mapConversationDoc(id: string, data: Record<string, unknown>): Conversation {
  const participants = Array.isArray(data.participants)
    ? data.participants.filter((item): item is string => typeof item === 'string')
    : [];

  const rawDetails =
    typeof data.participantDetails === 'object' && data.participantDetails !== null
      ? (data.participantDetails as Record<string, unknown>)
      : {};

  const participantDetails: Record<string, ParticipantDetail> = {};
  for (const uid of participants) {
    participantDetails[uid] = mapParticipantDetail(rawDetails[uid], uid);
  }

  const rawUnread =
    typeof data.unreadCounts === 'object' && data.unreadCounts !== null
      ? (data.unreadCounts as Record<string, unknown>)
      : {};
  const unreadCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawUnread)) {
    unreadCounts[k] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  const rawDelivered =
    typeof data.lastDeliveredBy === 'object' && data.lastDeliveredBy !== null
      ? (data.lastDeliveredBy as Record<string, unknown>)
      : undefined;
  const lastDeliveredBy: Record<string, string> | undefined = rawDelivered
    ? Object.fromEntries(
        Object.entries(rawDelivered).filter(([, val]) => typeof val === 'string') as Array<
          [string, string]
        >,
      )
    : undefined;

  const messageType: MessageType =
    data.lastMessageType === 'image' ||
    data.lastMessageType === 'audio' ||
    data.lastMessageType === 'location'
      ? data.lastMessageType
      : 'text';

  const lastMessageAtMs = timestampToMs(data.lastMessageAt as never) || timestampToMs(data.updatedAt as never);

  return {
    id,
    participants,
    participantDetails,
    lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : '',
    lastMessageType: messageType,
    lastMessageId: typeof data.lastMessageId === 'string' ? data.lastMessageId : undefined,
    lastMessageSenderId:
      typeof data.lastMessageSenderId === 'string' ? data.lastMessageSenderId : undefined,
    lastMessageAt: lastMessageAtMs,
    lastMessageAtMs,
    lastDeliveredBy,
    unreadCounts,
    createdAt: timestampToMs(data.createdAt as never),
    updatedAt: timestampToMs(data.updatedAt as never),
  };
}

function toParticipantDetail(user: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>): Record<string, unknown> {
  const detail: Record<string, unknown> = {
    uid: user.uid,
    name: user.name,
    photoURL: user.photoURL ?? null,
  };
  if (user.email) detail.email = user.email;
  if (user.role) detail.role = user.role;
  return detail;
}

export function subscribeToConversations(
  db: Firestore,
  uid: string,
  onConversations: (conversations: Conversation[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  let activeUnsubscribe: Unsubscribe = () => {};
  let disposed = false;

  const indexedQuery = query(
    collection(db, CHAT_COLLECTIONS.CONVERSATIONS),
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
  );

  const subscribeFallback = () => {
    const fallbackQuery = query(
      collection(db, CHAT_COLLECTIONS.CONVERSATIONS),
      where('participants', 'array-contains', uid),
    );
    activeUnsubscribe = onSnapshot(
      fallbackQuery,
      (snapshot) => {
        const conversations = snapshot.docs
          .map((docSnap) => mapConversationDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => {
            const bTime = (typeof b.updatedAt === 'number' ? b.updatedAt : 0) || b.lastMessageAtMs;
            const aTime = (typeof a.updatedAt === 'number' ? a.updatedAt : 0) || a.lastMessageAtMs;
            return bTime - aTime;
          });
        onConversations(conversations);
      },
      (fallbackErr) => {
        onError?.(fallbackErr);
      },
    );
  };

  activeUnsubscribe = onSnapshot(
    indexedQuery,
    (snapshot) => {
      const conversations = snapshot.docs.map((docSnap) =>
        mapConversationDoc(docSnap.id, docSnap.data()),
      );
      onConversations(conversations);
    },
    (error) => {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'failed-precondition' && !disposed) {
        console.warn(
          '[RepairSeriesConnect] Composite index not yet deployed for conversations; using automatic fallback query. Deploy firestore.indexes.json for server-side sorting.',
          error instanceof Error ? error.message : error,
        );
        subscribeFallback();
        return;
      }
      onError?.(error);
    },
  );

  return () => {
    disposed = true;
    activeUnsubscribe();
  };
}

export function subscribeToConversation(
  db: Firestore,
  conversationId: string,
  onConversation: (conversation: Conversation | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const ref = doc(db, CHAT_COLLECTIONS.CONVERSATIONS, conversationId);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onConversation(null);
        return;
      }
      onConversation(mapConversationDoc(snapshot.id, snapshot.data()));
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function getOrCreateDirectConversation(
  db: Firestore,
  currentUser: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>,
  recipient: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>,
): Promise<Conversation> {
  if (currentUser.uid === recipient.uid) {
    throw new Error('Cannot start a conversation with yourself.');
  }

  const conversationId = buildDirectConversationId(currentUser.uid, recipient.uid);
  return ensureConversationById(db, conversationId, currentUser, recipient);
}

export async function ensureConversationById(
  db: Firestore,
  conversationId: string,
  currentUser: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>,
  recipient?: Partial<ParticipantDetail> & { uid: string },
): Promise<Conversation> {
  const convRef = doc(db, CHAT_COLLECTIONS.CONVERSATIONS, conversationId);
  const existingSnap = await getDoc(convRef);

  if (existingSnap.exists()) {
    const conv = mapConversationDoc(existingSnap.id, existingSnap.data());
    if (!conv.participants.includes(currentUser.uid)) {
      throw new Error('You are not a participant in this conversation.');
    }

    const currentSaved = conv.participantDetails[currentUser.uid];
    if (
      !currentSaved ||
      currentSaved.name !== currentUser.name ||
      currentSaved.photoURL !== currentUser.photoURL ||
      (currentUser.role && currentSaved.role !== currentUser.role)
    ) {
      await updateDoc(convRef, {
        [`participantDetails.${currentUser.uid}`]: toParticipantDetail(currentUser),
      });
    }
    return conv;
  }

  if (!recipient?.uid) {
    throw new Error(
      `Conversation "${conversationId}" does not exist yet. Provide recipientId to initialize it.`,
    );
  }

  const participants = Array.from(new Set([currentUser.uid, recipient.uid]));
  const unreadCounts: Record<string, number> = {};
  for (const uid of participants) {
    unreadCounts[uid] = 0;
  }

  const participantDetails: Record<string, unknown> = {
    [currentUser.uid]: toParticipantDetail(currentUser),
    [recipient.uid]: toParticipantDetail({
      uid: recipient.uid,
      name: recipient.name?.trim() || 'Participant',
      email: recipient.email ?? '',
      photoURL: recipient.photoURL ?? null,
      role: recipient.role,
    }),
  };

  await setDoc(convRef, {
    participants,
    participantDetails,
    lastMessage: '',
    lastMessageType: 'text',
    lastMessageAt: serverTimestamp(),
    unreadCounts,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const createdSnap = await getDoc(convRef);
  if (!createdSnap.exists()) {
    throw new Error('Failed to create conversation.');
  }
  return mapConversationDoc(createdSnap.id, createdSnap.data());
}

export async function markConversationAsRead(
  db: Firestore,
  conversationId: string,
  uid: string,
): Promise<void> {
  const convRef = doc(db, CHAT_COLLECTIONS.CONVERSATIONS, conversationId);
  await updateDoc(convRef, {
    [`unreadCounts.${uid}`]: 0,
  });
}

export async function setTypingIndicator(
  db: Firestore,
  conversationId: string,
  user: Pick<ChatUser, 'uid' | 'name'>,
  isTyping: boolean,
): Promise<void> {
  const typingRef = doc(
    db,
    CHAT_COLLECTIONS.CONVERSATIONS,
    conversationId,
    CHAT_COLLECTIONS.TYPING,
    user.uid,
  );

  if (!isTyping) {
    await deleteDoc(typingRef).catch(() =>
      setDoc(
        typingRef,
        {
          uid: user.uid,
          name: user.name,
          isTyping: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    return;
  }

  await setDoc(
    typingRef,
    {
      uid: user.uid,
      name: user.name,
      isTyping: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToTypingStates(
  db: Firestore,
  conversationId: string,
  currentUid: string,
  onTypingStates: (states: TypingState[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const typingCol = collection(
    db,
    CHAT_COLLECTIONS.CONVERSATIONS,
    conversationId,
    CHAT_COLLECTIONS.TYPING,
  );

  return onSnapshot(
    typingCol,
    (snapshot) => {
      const states: TypingState[] = [];
      for (const docSnap of snapshot.docs) {
        if (docSnap.id === currentUid) continue;
        const data = docSnap.data();
        if (data.isTyping === true) {
          states.push({
            uid: typeof data.uid === 'string' ? data.uid : docSnap.id,
            name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Someone',
            isTyping: true,
            updatedAtMs: timestampToMs(data.updatedAt as never) || Date.now(),
          });
        }
      }
      onTypingStates(states);
    },
    (error) => {
      onError?.(error);
    },
  );
}

export function getOtherParticipant(
  conversation: Conversation,
  currentUid: string,
): ParticipantDetail {
  const otherUid = conversation.participants.find((uid) => uid !== currentUid);
  if (!otherUid) {
    return (
      conversation.participantDetails[currentUid] ?? {
        uid: currentUid,
        name: 'Saved Notes',
        photoURL: null,
      }
    );
  }
  return (
    conversation.participantDetails[otherUid] ?? {
      uid: otherUid,
      name: 'Participant',
      photoURL: null,
    }
  );
}
