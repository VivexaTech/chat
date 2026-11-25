import type { FirebaseOptions } from 'firebase/app';
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'partner' | 'support' | 'user';

export type MessageType = 'text' | 'image' | 'audio' | 'location';

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read';

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

export interface ChatUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role?: UserRole;
  createdAt?: Timestamp | Date | number | null;
  updatedAt?: Timestamp | Date | number | null;
}

export interface ChatAuthUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string | null;
  role?: UserRole;
}

export interface ParticipantDetail {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string | null;
  role?: UserRole;
}

export interface MediaMetadata {
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  publicId?: string;
  resourceType?: CloudinaryResourceType;
  provider?: 'cloudinary' | string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  label?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: MessageType;
  text: string | null;
  mediaURL: string | null;
  mediaMetadata: MediaMetadata | null;
  location: LocationData | null;
  createdAt: Timestamp | Date | number | null;
  createdAtMs: number;
  readBy: string[];
  deliveredTo: string[];
  isPending?: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantDetails: Record<string, ParticipantDetail>;
  lastMessage: string;
  lastMessageType: MessageType;
  lastMessageId?: string;
  lastMessageSenderId?: string;
  lastMessageAt: Timestamp | Date | number | null;
  lastMessageAtMs: number;
  lastDeliveredBy?: Record<string, string>;
  unreadCounts: Record<string, number>;
  createdAt: Timestamp | Date | number | null;
  updatedAt: Timestamp | Date | number | null;
}

export interface TypingState {
  uid: string;
  name: string;
  isTyping: boolean;
  updatedAtMs: number;
}

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'paused' | 'success' | 'canceled' | 'error';
}

export interface ChatError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface FirebaseConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
}

export interface CloudinarySignaturePayload {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName?: string;
  uploadPreset?: string;
  folder?: string;
  publicId?: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset?: string;
  folderPrefix?: string;
  /**
   * Optional signed-upload backend endpoint or custom signature provider
   * for production deployments without exposing Cloudinary API secrets on the client.
   */
  signedUploadEndpoint?: string;
  getSignature?: (params: {
    folder: string;
    resourceType: CloudinaryResourceType;
    conversationId: string;
    senderId: string;
    fileName: string;
  }) => Promise<CloudinarySignaturePayload>;
}

/**
 * Pluggable authentication adapter so host applications (Repair Series Customer App,
 * Partner App, Website) can bridge identity into the independent chat Firebase project
 * without duplicating accounts or embedding service account credentials on the client.
 */
export interface ChatAuthAdapter {
  readonly mode: 'firebase-email' | 'external-token' | 'custom';
  getCurrentUser(): ChatAuthUser | null;
  onAuthStateChanged(callback: (user: ChatAuthUser | null) => void): () => void;
  signInWithEmail?(email: string, password: string): Promise<ChatAuthUser>;
  authenticateWithToken?(token: string): Promise<ChatAuthUser>;
  ensureAuthenticated?(expectedUserId?: string): Promise<ChatAuthUser | null>;
  signOut(): Promise<void>;
  updateProfile?(updates: { name?: string; photoURL?: string | null; role?: UserRole }): Promise<ChatAuthUser>;
}

export interface RepairChatConfig {
  firebase: FirebaseConfig;
  cloudinary: CloudinaryConfig;
  appInstanceName?: string;
  pageSize?: number;
  maxImageSizeBytes?: number;
  maxAudioSizeBytes?: number;
  typingThrottleMs?: number;
  typingIdleTimeoutMs?: number;
  typingStaleMs?: number;
}

export interface RepairChatProps {
  /** Authenticated user UID in the active chat auth context */
  userId?: string;
  /** Role tag shown cleanly in Repair Series context */
  userRole?: UserRole;
  /** Optional display name override when initializing profile */
  userName?: string;
  /** Optional photo URL override when initializing profile */
  userPhotoURL?: string | null;
  /** Optional locked or pre-selected conversation ID */
  conversationId?: string;
  /** Optional recipient UID when opening or creating a direct conversation via SDK */
  recipientId?: string;
  /** Optional recipient details used if recipient profile has not synced yet */
  recipientProfile?: Partial<ParticipantDetail>;
  /** Whether to show the conversation list sidebar (defaults to true unless locked conversationId with showSidebar=false) */
  showSidebar?: boolean;
  /** Pre-created ChatClient instance for shared client lifecycle */
  client?: import('../sdk/createChatClient').ChatClient;
  /** Independent Firebase configuration override */
  firebaseConfig?: FirebaseConfig;
  /** Cloudinary media configuration override */
  cloudinaryConfig?: CloudinaryConfig;
  /** Optional custom authentication adapter for host Repair Series apps */
  authAdapter?: ChatAuthAdapter;
  /** Pagination batch size */
  pageSize?: number;
  /** Optional container class */
  className?: string;
  /** Callback fired when active conversation changes */
  onConversationChange?: (conversationId: string | null) => void;
  /** Callback fired after a message sends successfully */
  onMessageSent?: (message: ChatMessage) => void;
  /** Callback fired on recoverable operational errors */
  onError?: (error: ChatError) => void;
}
