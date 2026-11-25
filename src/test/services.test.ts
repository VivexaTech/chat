import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_LIMITS,
  getMissingCloudinaryEnvKeys,
  getMissingFirebaseEnvKeys,
  isCloudinaryConfigComplete,
  isFirebaseConfigComplete,
} from '../config/chat.config';
import { uploadToCloudinary } from '../services/cloudinary.service';
import { buildGoogleMapsUrl, getCurrentLocation } from '../services/location.service';
import {
  audioExtensionFromMime,
  normalizeMimeType,
  validateAudioBlob,
  validateImageFile,
} from '../services/media.service';
import { getMessageDeliveryStatus } from '../services/message.service';
import { normalizeChatError } from '../services/firebase';
import type { ChatMessage } from '../types/chat.types';
import {
  buildDirectConversationId,
  deriveDisplayNameFromEmail,
  formatDuration,
  formatFileSize,
  formatMessagePreview,
  getInitials,
} from '../utils/formatters';

describe('formatters and config helpers', () => {
  it('builds deterministic conversation IDs regardless of participant order', () => {
    expect(buildDirectConversationId('uid_b', 'uid_a')).toBe('uid_a__uid_b');
    expect(buildDirectConversationId('uid_a', 'uid_b')).toBe('uid_a__uid_b');
  });

  it('formats message previews across all message types', () => {
    expect(formatMessagePreview('Hello there', 'text')).toBe('Hello there');
    expect(formatMessagePreview(null, 'image')).toBe('Photo');
    expect(formatMessagePreview('Front bumper crack', 'image')).toBe('Photo: Front bumper crack');
    expect(formatMessagePreview(null, 'audio')).toBe('Voice message');
    expect(formatMessagePreview(null, 'location')).toBe('Shared location');
  });

  it('formats durations, file sizes, initials, and fallback names', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(getInitials('Vivek Sharma')).toBe('VS');
    expect(getInitials('Vivek')).toBe('VI');
    expect(deriveDisplayNameFromEmail('john.doe@example.com')).toBe('John Doe');
  });

  it('validates Firebase and Cloudinary config completeness accurately', () => {
    expect(getMissingFirebaseEnvKeys({})).toHaveLength(4);
    expect(
      isFirebaseConfigComplete({
        apiKey: 'abc',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo',
        appId: '1:123:web:abc',
      }),
    ).toBe(true);

    expect(getMissingCloudinaryEnvKeys({})).toEqual([
      'VITE_CLOUDINARY_CLOUD_NAME',
      'VITE_CLOUDINARY_UPLOAD_PRESET',
    ]);
    expect(
      isCloudinaryConfigComplete({
        cloudName: 'demo-cloud',
        uploadPreset: 'unsigned_preset',
      }),
    ).toBe(true);
    expect(
      isCloudinaryConfigComplete({
        cloudName: 'demo-cloud',
        signedUploadEndpoint: '/api/cloudinary/sign',
      }),
    ).toBe(true);
  });
});

describe('media validation', () => {
  it('validates image MIME types and size boundaries', () => {
    const validPng = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' });
    expect(validateImageFile(validPng)).toEqual({ valid: true });

    const badType = new File([new Uint8Array(1024)], 'doc.pdf', { type: 'application/pdf' });
    expect(validateImageFile(badType).valid).toBe(false);

    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(emptyFile).valid).toBe(false);

    const oversized = new File([new Uint8Array(10)], 'big.png', { type: 'image/png' });
    expect(validateImageFile(oversized, 5).valid).toBe(false);
    expect(CHAT_LIMITS.MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('validates audio blobs and normalizes codec MIME types', () => {
    expect(normalizeMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(audioExtensionFromMime('audio/mp4')).toBe('m4a');
    expect(audioExtensionFromMime('audio/ogg;codecs=opus')).toBe('ogg');

    const validAudio = new Blob([new Uint8Array(256)], { type: 'audio/webm;codecs=opus' });
    expect(validateAudioBlob(validAudio)).toEqual({ valid: true });

    const emptyAudio = new Blob([], { type: 'audio/webm' });
    expect(validateAudioBlob(emptyAudio).valid).toBe(false);
  });
});

describe('location service', () => {
  it('builds the exact required Google Maps URL format', () => {
    expect(buildGoogleMapsUrl(12.971598, 77.594566)).toBe(
      'https://www.google.com/maps?q=12.971598,77.594566',
    );
  });

  it('maps geolocation permission denial cleanly', async () => {
    const originalGeo = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success, errorCb) => {
          errorCb({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }),
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(/permission was denied/i);

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeo,
    });
  });
});

describe('message delivery status', () => {
  const baseMessage: ChatMessage = {
    id: 'msg-1',
    conversationId: 'c-1',
    senderId: 'uid-1',
    messageType: 'text',
    text: 'Hi',
    mediaURL: null,
    mediaMetadata: null,
    location: null,
    createdAt: 1000,
    createdAtMs: 1000,
    readBy: ['uid-1'],
    deliveredTo: ['uid-1'],
    isPending: false,
  };

  it('resolves sending, sent, delivered, and read transitions accurately', () => {
    const participants = ['uid-1', 'uid-2'];
    expect(getMessageDeliveryStatus({ ...baseMessage, isPending: true }, participants)).toBe(
      'sending',
    );
    expect(getMessageDeliveryStatus(baseMessage, participants)).toBe('sent');
    expect(
      getMessageDeliveryStatus({ ...baseMessage, deliveredTo: ['uid-1', 'uid-2'] }, participants),
    ).toBe('delivered');
    expect(
      getMessageDeliveryStatus(
        { ...baseMessage, deliveredTo: ['uid-1', 'uid-2'], readBy: ['uid-1', 'uid-2'] },
        participants,
      ),
    ).toBe('read');
  });
});

describe('firebase error normalization', () => {
  it('maps offline unavailable errors to an actionable Cloud Firestore message', () => {
    const err = normalizeChatError(
      { code: 'unavailable', message: 'Failed to get document because the client is offline.' },
      'Fallback',
    );
    expect(err.code).toBe('unavailable');
    expect(err.message).toMatch(/Cloud Firestore is created and enabled/i);
  });

  it('preserves direct Firebase Console index creation URL on failed-precondition errors', () => {
    const err = normalizeChatError(
      {
        code: 'failed-precondition',
        message:
          'The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/demo/firestore/indexes?create_composite=abc',
      },
      'Fallback',
    );
    expect(err.message).toContain('https://console.firebase.google.com/v1/r/project/demo');
  });
});

describe('cloudinary upload service', () => {
  const OriginalXHR = globalThis.XMLHttpRequest;

  afterEach(() => {
    globalThis.XMLHttpRequest = OriginalXHR;
  });

  it('uploads images to Cloudinary /image/upload and voice notes to /video/upload with progress', async () => {
    const openedUrls: string[] = [];
    const sentForms: FormData[] = [];

    class MockXHR {
      status = 200;
      responseText = '';
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      open(_method: string, url: string) {
        openedUrls.push(url);
      }

      abort() {
        this.onabort?.();
      }

      send(body: FormData) {
        sentForms.push(body);
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        } as ProgressEvent);
        this.responseText = JSON.stringify({
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/sample.png',
          public_id: 'repair-series-connect/c1/images/sample',
          resource_type: openedUrls[openedUrls.length - 1]?.includes('/video/upload')
            ? 'video'
            : 'image',
          bytes: 100,
        });
        this.onload?.();
      }
    }

    globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

    const progressEvents: number[] = [];
    const imgResult = await uploadToCloudinary({
      config: { cloudName: 'demo-cloud', uploadPreset: 'unsigned_local' },
      conversationId: 'c1',
      senderId: 'u1',
      subfolder: 'images',
      resourceType: 'image',
      data: new File([new Uint8Array(100)], 'photo.png', { type: 'image/png' }),
      fileName: 'photo.png',
      onProgress: (p) => progressEvents.push(p.progress),
    });

    expect(openedUrls[0]).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    expect(sentForms[0]?.get('upload_preset')).toBe('unsigned_local');
    expect(sentForms[0]?.get('folder')).toBe('repair-series-connect/c1/images');
    expect(progressEvents).toEqual([50, 100]);
    expect(imgResult.secureUrl).toContain('https://res.cloudinary.com/');

    await uploadToCloudinary({
      config: {
        cloudName: 'demo-cloud',
        getSignature: async () => ({
          signature: 'sig_123',
          timestamp: 1700000000,
          apiKey: 'public_api_key',
        }),
      },
      conversationId: 'c1',
      senderId: 'u1',
      subfolder: 'audio',
      resourceType: 'video',
      data: new Blob([new Uint8Array(100)], { type: 'audio/webm' }),
      fileName: 'voice.webm',
    });

    expect(openedUrls[1]).toBe('https://api.cloudinary.com/v1_1/demo-cloud/video/upload');
    expect(sentForms[1]?.get('signature')).toBe('sig_123');
    expect(sentForms[1]?.get('api_key')).toBe('public_api_key');
  });

  it('rejects upload cleanly when Cloudinary env variables are missing', async () => {
    await expect(
      uploadToCloudinary({
        config: { cloudName: '', uploadPreset: '' },
        conversationId: 'c1',
        senderId: 'u1',
        subfolder: 'images',
        resourceType: 'image',
        data: new Blob([new Uint8Array(10)], { type: 'image/png' }),
        fileName: 'photo.png',
      }),
    ).rejects.toThrow(/VITE_CLOUDINARY_CLOUD_NAME/i);
  });
});
