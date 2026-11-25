import {
  ALLOWED_AUDIO_BASE_TYPES,
  ALLOWED_IMAGE_TYPES,
  CHAT_LIMITS,
} from '../config/chat.config';
import type { CloudinaryConfig, MediaMetadata, UploadProgress } from '../types/chat.types';
import { formatFileSize } from '../utils/formatters';
import { uploadToCloudinary } from './cloudinary.service';

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(
  file: File,
  maxBytes: number = CHAT_LIMITS.MAX_IMAGE_SIZE_BYTES,
): MediaValidationResult {
  const mime = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mime as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      error: 'Unsupported image format. Choose a JPEG, PNG, WebP, or GIF image.',
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Selected image file is empty.',
    };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image is too large (${formatFileSize(file.size)}). Maximum allowed size is ${formatFileSize(maxBytes)}.`,
    };
  }
  return { valid: true };
}

export function validateAudioBlob(
  blob: Blob,
  maxBytes: number = CHAT_LIMITS.MAX_AUDIO_SIZE_BYTES,
): MediaValidationResult {
  const baseType = normalizeMimeType(blob.type || 'audio/webm');
  if (
    blob.type &&
    !ALLOWED_AUDIO_BASE_TYPES.includes(baseType as (typeof ALLOWED_AUDIO_BASE_TYPES)[number])
  ) {
    return {
      valid: false,
      error: 'Unsupported audio recording format.',
    };
  }
  if (blob.size <= 0) {
    return {
      valid: false,
      error: 'Voice recording is empty.',
    };
  }
  if (blob.size > maxBytes) {
    return {
      valid: false,
      error: `Voice recording exceeds ${formatFileSize(maxBytes)}.`,
    };
  }
  return { valid: true };
}

export function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(';')[0] ?? 'audio/webm').trim().toLowerCase();
}

export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return 'audio/webm';
}

export function audioExtensionFromMime(mimeType: string): string {
  const base = normalizeMimeType(mimeType);
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/wav') return 'wav';
  return 'webm';
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

export async function uploadChatImage(options: {
  cloudinaryConfig?: CloudinaryConfig;
  conversationId: string;
  senderId: string;
  file: File;
  maxBytes?: number;
  onProgress?: (progress: UploadProgress) => void;
  onAbortCreated?: (abort: () => void) => void;
}): Promise<{ downloadURL: string; mediaMetadata: MediaMetadata }> {
  const validation = validateImageFile(options.file, options.maxBytes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const localDimensions = await readImageDimensions(options.file);
  const uploaded = await uploadToCloudinary({
    config: options.cloudinaryConfig,
    conversationId: options.conversationId,
    senderId: options.senderId,
    subfolder: 'images',
    resourceType: 'image',
    data: options.file,
    fileName: options.file.name,
    onProgress: options.onProgress,
    onAbortCreated: options.onAbortCreated,
  });

  const width = uploaded.width ?? localDimensions?.width;
  const height = uploaded.height ?? localDimensions?.height;

  return {
    downloadURL: uploaded.secureUrl,
    mediaMetadata: {
      fileName: options.file.name,
      mimeType: options.file.type,
      size: options.file.size,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      provider: 'cloudinary',
    },
  };
}

export async function uploadChatVoiceNote(options: {
  cloudinaryConfig?: CloudinaryConfig;
  conversationId: string;
  senderId: string;
  blob: Blob;
  durationSec: number;
  maxBytes?: number;
  onProgress?: (progress: UploadProgress) => void;
  onAbortCreated?: (abort: () => void) => void;
}): Promise<{ downloadURL: string; mediaMetadata: MediaMetadata }> {
  const validation = validateAudioBlob(options.blob, options.maxBytes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const contentType = normalizeMimeType(options.blob.type || 'audio/webm');
  const ext = audioExtensionFromMime(contentType);
  const fileName = `voice_note_${Date.now()}.${ext}`;

  // Cloudinary handles audio files under its 'video' resource type
  const uploaded = await uploadToCloudinary({
    config: options.cloudinaryConfig,
    conversationId: options.conversationId,
    senderId: options.senderId,
    subfolder: 'audio',
    resourceType: 'video',
    data: options.blob,
    fileName,
    onProgress: options.onProgress,
    onAbortCreated: options.onAbortCreated,
  });

  return {
    downloadURL: uploaded.secureUrl,
    mediaMetadata: {
      fileName,
      mimeType: contentType,
      size: options.blob.size,
      duration: Math.max(1, Math.round(uploaded.duration ?? options.durationSec)),
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      provider: 'cloudinary',
    },
  };
}

export async function downloadMediaFile(url: string, fileName: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
