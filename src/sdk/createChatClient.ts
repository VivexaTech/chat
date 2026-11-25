import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { CHAT_LIMITS, DEFAULT_APP_INSTANCE_NAME, defaultChatConfig } from '../config/chat.config';
import {
  createFirebaseAuthAdapter,
  ensureChatUserProfile,
  getChatUserProfile,
  listChatUsers,
  subscribeToChatUsers,
  updateChatUserProfile,
} from '../services/auth.service';
import {
  ensureConversationById,
  getOrCreateDirectConversation,
  markConversationAsRead,
  setTypingIndicator,
  subscribeToConversation,
  subscribeToConversations,
  subscribeToTypingStates,
} from '../services/chat.service';
import { getChatFirebaseServices, type ChatFirebaseServices } from '../services/firebase';
import { buildGoogleMapsUrl, getCurrentLocation } from '../services/location.service';
import {
  downloadMediaFile,
  uploadChatImage,
  uploadChatVoiceNote,
  validateAudioBlob,
  validateImageFile,
} from '../services/media.service';
import {
  getMessageDeliveryStatus,
  loadOlderMessages,
  markMessagesDelivered,
  markMessagesRead,
  sendImageMessage,
  sendLocationMessage,
  sendTextMessage,
  sendVoiceMessage,
  subscribeToLatestMessages,
  type MessagesPageResult,
} from '../services/message.service';
import type {
  ChatAuthAdapter,
  ChatAuthUser,
  ChatMessage,
  ChatUser,
  CloudinaryConfig,
  Conversation,
  FirebaseConfig,
  LocationData,
  MediaMetadata,
  MessageDeliveryStatus,
  ParticipantDetail,
  TypingState,
  UploadProgress,
  UserRole,
} from '../types/chat.types';

export interface CreateChatClientOptions {
  firebaseConfig?: FirebaseConfig;
  cloudinaryConfig?: CloudinaryConfig;
  appInstanceName?: string;
  authAdapter?: ChatAuthAdapter;
  pageSize?: number;
  maxImageSizeBytes?: number;
  maxAudioSizeBytes?: number;
  typingThrottleMs?: number;
  typingIdleTimeoutMs?: number;
  typingStaleMs?: number;
}

export interface ChatClient {
  readonly services: ChatFirebaseServices;
  readonly authAdapter: ChatAuthAdapter;
  readonly options: {
    pageSize: number;
    maxImageSizeBytes: number;
    maxAudioSizeBytes: number;
    typingThrottleMs: number;
    typingIdleTimeoutMs: number;
    typingStaleMs: number;
  };
  auth: {
    getCurrentUser: () => ChatAuthUser | null;
    onAuthStateChanged: (cb: (user: ChatAuthUser | null) => void) => () => void;
    signInWithEmail: (email: string, password: string) => Promise<ChatAuthUser>;
    signOut: () => Promise<void>;
    ensureProfile: (
      user: ChatAuthUser,
      overrides?: { name?: string; photoURL?: string | null; role?: UserRole },
    ) => Promise<ChatUser>;
    getProfile: (uid: string) => Promise<ChatUser | null>;
    updateProfile: (
      uid: string,
      updates: { name?: string; photoURL?: string | null; role?: UserRole },
    ) => Promise<ChatUser>;
    listUsers: (excludeUid?: string) => Promise<ChatUser[]>;
    subscribeUsers: (
      excludeUid: string | undefined,
      onUsers: (users: ChatUser[]) => void,
      onError?: (err: unknown) => void,
    ) => () => void;
  };
  conversations: {
    subscribeToList: (
      uid: string,
      onConversations: (conversations: Conversation[]) => void,
      onError?: (err: unknown) => void,
    ) => () => void;
    subscribeToOne: (
      conversationId: string,
      onConversation: (conversation: Conversation | null) => void,
      onError?: (err: unknown) => void,
    ) => () => void;
    getOrCreateDirect: (
      currentUser: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>,
      recipient: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>,
    ) => Promise<Conversation>;
    ensureById: (
      conversationId: string,
      currentUser: Pick<ChatUser, 'uid' | 'name' | 'email' | 'photoURL' | 'role'>,
      recipient?: Partial<ParticipantDetail> & { uid: string },
    ) => Promise<Conversation>;
    markAsRead: (conversationId: string, uid: string) => Promise<void>;
  };
  messages: {
    subscribeLatest: (
      conversationId: string,
      onResult: (res: MessagesPageResult) => void,
      onError?: (err: unknown) => void,
      pageSizeOverride?: number,
    ) => () => void;
    loadOlder: (
      conversationId: string,
      cursor: QueryDocumentSnapshot<DocumentData>,
      pageSizeOverride?: number,
    ) => Promise<MessagesPageResult>;
    sendText: (conversation: Conversation, senderId: string, text: string) => Promise<ChatMessage>;
    sendImage: (
      conversation: Conversation,
      senderId: string,
      mediaURL: string,
      mediaMetadata: MediaMetadata,
      caption?: string,
    ) => Promise<ChatMessage>;
    sendVoice: (
      conversation: Conversation,
      senderId: string,
      mediaURL: string,
      mediaMetadata: MediaMetadata,
    ) => Promise<ChatMessage>;
    sendLocation: (
      conversation: Conversation,
      senderId: string,
      location: LocationData,
    ) => Promise<ChatMessage>;
    markDelivered: (
      conversationId: string,
      messageIds: string[],
      uid: string,
      latestMessageId?: string,
    ) => Promise<void>;
    markRead: (
      conversationId: string,
      messageIds: string[],
      uid: string,
      resetUnreadCount: boolean,
    ) => Promise<void>;
    getDeliveryStatus: (message: ChatMessage, participants: string[]) => MessageDeliveryStatus;
  };
  typing: {
    setTyping: (
      conversationId: string,
      user: Pick<ChatUser, 'uid' | 'name'>,
      isTyping: boolean,
    ) => Promise<void>;
    subscribe: (
      conversationId: string,
      currentUid: string,
      onTyping: (states: TypingState[]) => void,
      onError?: (err: unknown) => void,
    ) => () => void;
  };
  media: {
    validateImageFile: (file: File) => { valid: boolean; error?: string };
    validateAudioBlob: (blob: Blob) => { valid: boolean; error?: string };
    uploadImage: (params: {
      conversationId: string;
      senderId: string;
      file: File;
      onProgress?: (progress: UploadProgress) => void;
      onAbortCreated?: (abort: () => void) => void;
    }) => Promise<{ downloadURL: string; mediaMetadata: MediaMetadata }>;
    uploadVoiceNote: (params: {
      conversationId: string;
      senderId: string;
      blob: Blob;
      durationSec: number;
      onProgress?: (progress: UploadProgress) => void;
      onAbortCreated?: (abort: () => void) => void;
    }) => Promise<{ downloadURL: string; mediaMetadata: MediaMetadata }>;
    downloadFile: (url: string, fileName: string) => Promise<void>;
  };
  location: {
    getCurrentPosition: (options?: PositionOptions) => Promise<LocationData>;
    buildGoogleMapsUrl: (latitude: number, longitude: number) => string;
  };
}

/**
 * Creates a standalone, reusable Repair Series Connect client bound to an isolated
 * Firebase app instance and pluggable authentication adapter.
 */
export function createChatClient(config: CreateChatClientOptions = {}): ChatClient {
  const services = getChatFirebaseServices(
    config.firebaseConfig ?? defaultChatConfig.firebase,
    config.appInstanceName ?? DEFAULT_APP_INSTANCE_NAME,
  );
  const authAdapter =
    config.authAdapter ?? createFirebaseAuthAdapter(services.auth, services.db);

  const resolvedOptions = {
    pageSize: config.pageSize ?? defaultChatConfig.pageSize ?? CHAT_LIMITS.PAGE_SIZE,
    maxImageSizeBytes:
      config.maxImageSizeBytes ??
      defaultChatConfig.maxImageSizeBytes ??
      CHAT_LIMITS.MAX_IMAGE_SIZE_BYTES,
    maxAudioSizeBytes:
      config.maxAudioSizeBytes ??
      defaultChatConfig.maxAudioSizeBytes ??
      CHAT_LIMITS.MAX_AUDIO_SIZE_BYTES,
    typingThrottleMs:
      config.typingThrottleMs ??
      defaultChatConfig.typingThrottleMs ??
      CHAT_LIMITS.TYPING_THROTTLE_MS,
    typingIdleTimeoutMs:
      config.typingIdleTimeoutMs ??
      defaultChatConfig.typingIdleTimeoutMs ??
      CHAT_LIMITS.TYPING_IDLE_TIMEOUT_MS,
    typingStaleMs:
      config.typingStaleMs ?? defaultChatConfig.typingStaleMs ?? CHAT_LIMITS.TYPING_STALE_MS,
  };

  return {
    services,
    authAdapter,
    options: resolvedOptions,
    auth: {
      getCurrentUser: () => authAdapter.getCurrentUser(),
      onAuthStateChanged: (cb) => authAdapter.onAuthStateChanged(cb),
      signInWithEmail: async (email, password) => {
        if (!authAdapter.signInWithEmail) {
          throw new Error('Active authAdapter does not support email/password sign-in.');
        }
        return authAdapter.signInWithEmail(email, password);
      },
      signOut: () => authAdapter.signOut(),
      ensureProfile: (user, overrides) => ensureChatUserProfile(services.db, user, overrides),
      getProfile: (uid) => getChatUserProfile(services.db, uid),
      updateProfile: async (uid, updates) => {
        if (authAdapter.updateProfile) {
          const updated = await authAdapter.updateProfile(updates);
          return {
            uid: updated.uid,
            name: updated.name,
            email: updated.email,
            photoURL: updated.photoURL,
            role: updated.role,
          };
        }
        return updateChatUserProfile(services.db, services.auth, uid, updates);
      },
      listUsers: (excludeUid) => listChatUsers(services.db, excludeUid),
      subscribeUsers: (excludeUid, onUsers, onError) =>
        subscribeToChatUsers(services.db, excludeUid, onUsers, onError),
    },
    conversations: {
      subscribeToList: (uid, onConversations, onError) =>
        subscribeToConversations(services.db, uid, onConversations, onError),
      subscribeToOne: (conversationId, onConversation, onError) =>
        subscribeToConversation(services.db, conversationId, onConversation, onError),
      getOrCreateDirect: (currentUser, recipient) =>
        getOrCreateDirectConversation(services.db, currentUser, recipient),
      ensureById: (conversationId, currentUser, recipient) =>
        ensureConversationById(services.db, conversationId, currentUser, recipient),
      markAsRead: (conversationId, uid) => markConversationAsRead(services.db, conversationId, uid),
    },
    messages: {
      subscribeLatest: (conversationId, onResult, onError, pageSizeOverride) =>
        subscribeToLatestMessages(
          services.db,
          conversationId,
          pageSizeOverride ?? resolvedOptions.pageSize,
          onResult,
          onError,
        ),
      loadOlder: (conversationId, cursor, pageSizeOverride) =>
        loadOlderMessages(
          services.db,
          conversationId,
          cursor,
          pageSizeOverride ?? resolvedOptions.pageSize,
        ),
      sendText: (conversation, senderId, text) =>
        sendTextMessage(services.db, conversation, senderId, text),
      sendImage: (conversation, senderId, mediaURL, mediaMetadata, caption) =>
        sendImageMessage(services.db, conversation, senderId, mediaURL, mediaMetadata, caption),
      sendVoice: (conversation, senderId, mediaURL, mediaMetadata) =>
        sendVoiceMessage(services.db, conversation, senderId, mediaURL, mediaMetadata),
      sendLocation: (conversation, senderId, location) =>
        sendLocationMessage(services.db, conversation, senderId, location),
      markDelivered: (conversationId, messageIds, uid, latestMessageId) =>
        markMessagesDelivered(services.db, conversationId, messageIds, uid, latestMessageId),
      markRead: (conversationId, messageIds, uid, resetUnreadCount) =>
        markMessagesRead(services.db, conversationId, messageIds, uid, resetUnreadCount),
      getDeliveryStatus: (message, participants) => getMessageDeliveryStatus(message, participants),
    },
    typing: {
      setTyping: (conversationId, user, isTyping) =>
        setTypingIndicator(services.db, conversationId, user, isTyping),
      subscribe: (conversationId, currentUid, onTyping, onError) =>
        subscribeToTypingStates(services.db, conversationId, currentUid, onTyping, onError),
    },
    media: {
      validateImageFile: (file) => validateImageFile(file, resolvedOptions.maxImageSizeBytes),
      validateAudioBlob: (blob) => validateAudioBlob(blob, resolvedOptions.maxAudioSizeBytes),
      uploadImage: (params) =>
        uploadChatImage({
          cloudinaryConfig: config.cloudinaryConfig,
          maxBytes: resolvedOptions.maxImageSizeBytes,
          ...params,
        }),
      uploadVoiceNote: (params) =>
        uploadChatVoiceNote({
          cloudinaryConfig: config.cloudinaryConfig,
          maxBytes: resolvedOptions.maxAudioSizeBytes,
          ...params,
        }),
      downloadFile: (url, fileName) => downloadMediaFile(url, fileName),
    },
    location: {
      getCurrentPosition: (options) => getCurrentLocation(options),
      buildGoogleMapsUrl: (lat, lng) => buildGoogleMapsUrl(lat, lng),
    },
  };
}
