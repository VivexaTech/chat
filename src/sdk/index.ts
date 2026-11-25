// Public SDK surface for Repair Series Connect
export { RepairChat } from './RepairChat';
export { createChatClient, type ChatClient, type CreateChatClientOptions } from './createChatClient';

// Config & Firebase helpers
export {
  CHAT_COLLECTIONS,
  CHAT_LIMITS,
  DEFAULT_APP_INSTANCE_NAME,
  DEFAULT_CLOUDINARY_FOLDER,
  defaultChatConfig,
  getMissingCloudinaryEnvKeys,
  getMissingFirebaseEnvKeys,
  isCloudinaryConfigComplete,
  isFirebaseConfigComplete,
  readEnvCloudinaryConfig,
  readEnvFirebaseConfig,
} from '../config/chat.config';
export {
  getChatFirebaseServices,
  hasValidDefaultFirebaseEnv,
  normalizeChatError,
  type ChatFirebaseServices,
} from '../services/firebase';

// Auth adapters & profile services
export {
  createCustomTokenAuthAdapter,
  createFirebaseAuthAdapter,
  ensureChatUserProfile,
  getChatUserProfile,
  listChatUsers,
  subscribeToChatUsers,
  updateChatUserProfile,
} from '../services/auth.service';

// Domain services
export {
  ensureConversationById,
  getOrCreateDirectConversation,
  getOtherParticipant,
  markConversationAsRead,
  setTypingIndicator,
  subscribeToConversation,
  subscribeToConversations,
  subscribeToTypingStates,
} from '../services/chat.service';
export {
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
export {
  uploadToCloudinary,
  type CloudinaryUploadParams,
  type CloudinaryUploadResponse,
} from '../services/cloudinary.service';
export {
  downloadMediaFile,
  getSupportedAudioMimeType,
  uploadChatImage,
  uploadChatVoiceNote,
  validateAudioBlob,
  validateImageFile,
} from '../services/media.service';
export { buildGoogleMapsUrl, getCurrentLocation } from '../services/location.service';

// Reusable React hooks
export { useChat, type UseChatOptions } from '../hooks/useChat';
export { useMessages, type UseMessagesOptions } from '../hooks/useMessages';
export { useTypingIndicator, type UseTypingIndicatorOptions } from '../hooks/useTypingIndicator';

// Reusable UI components
export { AttachmentMenu, type AttachmentMenuProps } from '../components/AttachmentMenu/AttachmentMenu';
export { LoginScreen, type LoginScreenProps } from '../components/Auth/LoginScreen';
export { ChatSidebar, type ChatSidebarProps } from '../components/ChatSidebar/ChatSidebar';
export { ChatWindow, type ChatWindowProps } from '../components/ChatWindow/ChatWindow';
export { Avatar, type AvatarProps } from '../components/common/Avatar';
export { ImageViewer, type ImageViewerProps } from '../components/ImageViewer/ImageViewer';
export {
  LocationConfirmModal,
  LocationMessage,
  type LocationConfirmModalProps,
  type LocationMessageProps,
} from '../components/LocationMessage/LocationMessage';
export { MessageBubble, type MessageBubbleProps } from '../components/MessageBubble/MessageBubble';
export { MessageInput, type MessageInputProps } from '../components/MessageInput/MessageInput';
export {
  VoiceNotePlayer,
  type VoiceNotePlayerProps,
} from '../components/VoiceRecorder/VoiceNotePlayer';
export {
  VoiceRecorder,
  type VoiceRecorderProps,
} from '../components/VoiceRecorder/VoiceRecorder';

// TypeScript interfaces
export type {
  ChatAuthAdapter,
  ChatAuthUser,
  ChatError,
  ChatMessage,
  ChatUser,
  CloudinaryConfig,
  CloudinaryResourceType,
  CloudinarySignaturePayload,
  Conversation,
  FirebaseConfig,
  LocationData,
  MediaMetadata,
  MessageDeliveryStatus,
  MessageType,
  ParticipantDetail,
  RepairChatConfig,
  RepairChatProps,
  TypingState,
  UploadProgress,
  UserRole,
} from '../types/chat.types';
