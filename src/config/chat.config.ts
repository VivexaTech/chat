import type { CloudinaryConfig, FirebaseConfig, RepairChatConfig } from '../types/chat.types';

export const CHAT_COLLECTIONS = {
  USERS: 'chat_users',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  TYPING: 'typing',
} as const;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_AUDIO_BASE_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
  'audio/x-m4a',
] as const;

export const CHAT_LIMITS = {
  PAGE_SIZE: 25,
  MAX_TEXT_LENGTH: 4000,
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_AUDIO_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_VOICE_DURATION_SEC: 300, // 5 minutes
  TYPING_THROTTLE_MS: 2500,
  TYPING_IDLE_TIMEOUT_MS: 3000,
  TYPING_STALE_MS: 6500,
} as const;

export const DEFAULT_APP_INSTANCE_NAME = 'repair-series-connect';
export const DEFAULT_CLOUDINARY_FOLDER = 'repair-series-connect';

export function readEnvFirebaseConfig(): FirebaseConfig {
  const messagingSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '').trim();
  return {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim(),
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim(),
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim(),
    appId: (import.meta.env.VITE_FIREBASE_APP_ID ?? '').trim(),
    ...(messagingSenderId ? { messagingSenderId } : {}),
  };
}

export function getMissingFirebaseEnvKeys(config: Partial<FirebaseConfig>): string[] {
  const required: Array<[keyof FirebaseConfig, string]> = [
    ['apiKey', 'VITE_FIREBASE_API_KEY'],
    ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
    ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
    ['appId', 'VITE_FIREBASE_APP_ID'],
  ];

  return required
    .filter(([key]) => {
      const val = config[key];
      return typeof val !== 'string' || val.trim().length === 0 || val.startsWith('your_');
    })
    .map(([, envName]) => envName);
}

export function isFirebaseConfigComplete(config: Partial<FirebaseConfig>): config is FirebaseConfig {
  return getMissingFirebaseEnvKeys(config).length === 0;
}

export function readEnvCloudinaryConfig(): CloudinaryConfig {
  return {
    cloudName: (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '').trim(),
    uploadPreset: (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '').trim(),
    folderPrefix: DEFAULT_CLOUDINARY_FOLDER,
  };
}

export function getMissingCloudinaryEnvKeys(config: Partial<CloudinaryConfig>): string[] {
  const missing: string[] = [];
  const cloudName = config.cloudName?.trim() ?? '';
  if (!cloudName || cloudName.startsWith('your_')) {
    missing.push('VITE_CLOUDINARY_CLOUD_NAME');
  }

  const hasSignedFlow = Boolean(config.getSignature || config.signedUploadEndpoint);
  const uploadPreset = config.uploadPreset?.trim() ?? '';
  if (!hasSignedFlow && (!uploadPreset || uploadPreset.startsWith('your_'))) {
    missing.push('VITE_CLOUDINARY_UPLOAD_PRESET');
  }

  return missing;
}

export function isCloudinaryConfigComplete(
  config: Partial<CloudinaryConfig>,
): config is CloudinaryConfig {
  return getMissingCloudinaryEnvKeys(config).length === 0;
}

export const defaultChatConfig: RepairChatConfig = {
  firebase: readEnvFirebaseConfig(),
  cloudinary: readEnvCloudinaryConfig(),
  appInstanceName: DEFAULT_APP_INSTANCE_NAME,
  pageSize: CHAT_LIMITS.PAGE_SIZE,
  maxImageSizeBytes: CHAT_LIMITS.MAX_IMAGE_SIZE_BYTES,
  maxAudioSizeBytes: CHAT_LIMITS.MAX_AUDIO_SIZE_BYTES,
  typingThrottleMs: CHAT_LIMITS.TYPING_THROTTLE_MS,
  typingIdleTimeoutMs: CHAT_LIMITS.TYPING_IDLE_TIMEOUT_MS,
  typingStaleMs: CHAT_LIMITS.TYPING_STALE_MS,
};
