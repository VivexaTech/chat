import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessages } from '../hooks/useMessages';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import type { ChatClient } from '../sdk/createChatClient';
import type { ChatMessage, Conversation, TypingState } from '../types/chat.types';

function createMockClient(overrides?: Partial<ChatClient>): ChatClient {
  return {
    services: {} as ChatClient['services'],
    authAdapter: {
      mode: 'firebase-email',
      getCurrentUser: () => null,
      onAuthStateChanged: () => () => {},
      signOut: async () => {},
    },
    options: {
      pageSize: 25,
      maxImageSizeBytes: 10 * 1024 * 1024,
      maxAudioSizeBytes: 15 * 1024 * 1024,
      typingThrottleMs: 2500,
      typingIdleTimeoutMs: 3000,
      typingStaleMs: 6500,
    },
    auth: {
      getCurrentUser: () => null,
      onAuthStateChanged: () => () => {},
      signInWithEmail: vi.fn(),
      signOut: vi.fn(),
      ensureProfile: vi.fn(),
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      listUsers: vi.fn(),
      subscribeUsers: () => () => {},
    },
    conversations: {
      subscribeToList: () => () => {},
      subscribeToOne: () => () => {},
      getOrCreateDirect: vi.fn(),
      ensureById: vi.fn(),
      markAsRead: vi.fn(),
    },
    messages: {
      subscribeLatest: () => () => {},
      loadOlder: vi.fn(),
      sendText: vi.fn(),
      sendImage: vi.fn(),
      sendVoice: vi.fn(),
      sendLocation: vi.fn(),
      markDelivered: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      getDeliveryStatus: () => 'sent',
    },
    typing: {
      setTyping: vi.fn().mockResolvedValue(undefined),
      subscribe: () => () => {},
    },
    media: {
      validateImageFile: () => ({ valid: true }),
      validateAudioBlob: () => ({ valid: true }),
      uploadImage: vi.fn(),
      uploadVoiceNote: vi.fn(),
      downloadFile: vi.fn(),
    },
    location: {
      getCurrentPosition: vi.fn(),
      buildGoogleMapsUrl: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
    },
    ...overrides,
  };
}

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throttles outgoing typing writes, clears after idle timeout, and expires stale remote typing', () => {
    let emitTyping: ((states: TypingState[]) => void) | null = null;
    const setTyping = vi.fn().mockResolvedValue(undefined);
    const client = createMockClient({
      typing: {
        setTyping,
        subscribe: (_convId, _uid, onTyping) => {
          emitTyping = onTyping;
          return () => {};
        },
      },
    });

    const { result } = renderHook(() =>
      useTypingIndicator({
        client,
        conversationId: 'conv-1',
        currentUser: { uid: 'u1', name: 'Vivek' },
      }),
    );

    act(() => {
      result.current.notifyTyping();
      result.current.notifyTyping();
      result.current.notifyTyping();
    });

    // Multiple rapid keystrokes only trigger 1 Firestore write
    expect(setTyping).toHaveBeenCalledTimes(1);
    expect(setTyping).toHaveBeenCalledWith('conv-1', { uid: 'u1', name: 'Vivek' }, true);

    // After idle timeout (3000ms), typing stops automatically
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(setTyping).toHaveBeenCalledWith('conv-1', { uid: 'u1', name: 'Vivek' }, false);

    // Remote user starts typing
    act(() => {
      emitTyping?.([
        { uid: 'u2', name: 'Test User', isTyping: true, updatedAtMs: Date.now() },
      ]);
    });
    expect(result.current.typingLabel).toBe('Test User is typing...');

    // If remote tab crashes without sending false, stale cleanup removes it after typingStaleMs
    act(() => {
      vi.advanceTimersByTime(6600);
    });
    expect(result.current.typingLabel).toBeNull();
  });
});

describe('useMessages', () => {
  it('streams messages chronologically, loads older pages without duplicates, and marks unread incoming messages read', async () => {
    const markRead = vi.fn().mockResolvedValue(undefined);
    const loadOlder = vi.fn().mockResolvedValue({
      messages: [
        {
          id: 'm1',
          conversationId: 'conv-1',
          senderId: 'u2',
          messageType: 'text',
          text: 'Older message',
          mediaURL: null,
          mediaMetadata: null,
          location: null,
          createdAt: 1000,
          createdAtMs: 1000,
          readBy: ['u2', 'u1'],
          deliveredTo: ['u2', 'u1'],
        },
      ] satisfies ChatMessage[],
      oldestCursor: null,
      hasMore: false,
    });

    let emitLatest:
      | ((res: { messages: ChatMessage[]; oldestCursor: any; hasMore: boolean }) => void)
      | null = null;

    const client = createMockClient({
      messages: {
        subscribeLatest: (_convId, onResult) => {
          emitLatest = onResult;
          return () => {};
        },
        loadOlder,
        sendText: vi.fn(),
        sendImage: vi.fn(),
        sendVoice: vi.fn(),
        sendLocation: vi.fn(),
        markDelivered: vi.fn().mockResolvedValue(undefined),
        markRead,
        getDeliveryStatus: () => 'sent',
      },
    });

    const conv: Conversation = {
      id: 'conv-1',
      participants: ['u1', 'u2'],
      participantDetails: {
        u1: { uid: 'u1', name: 'Vivek' },
        u2: { uid: 'u2', name: 'Test User' },
      },
      lastMessage: 'Newest',
      lastMessageType: 'text',
      lastMessageAt: 2000,
      lastMessageAtMs: 2000,
      unreadCounts: { u1: 1, u2: 0 },
      createdAt: 1000,
      updatedAt: 2000,
    };

    const { result } = renderHook(() =>
      useMessages({
        client,
        conversation: conv,
        currentUid: 'u1',
      }),
    );

    act(() => {
      emitLatest?.({
        messages: [
          {
            id: 'm2',
            conversationId: 'conv-1',
            senderId: 'u2',
            messageType: 'text',
            text: 'Latest unread',
            mediaURL: null,
            mediaMetadata: null,
            location: null,
            createdAt: 2000,
            createdAtMs: 2000,
            readBy: ['u2'],
            deliveredTo: ['u2'],
          },
        ],
        oldestCursor: { id: 'cursor-1' } as never,
        hasMore: true,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(markRead).toHaveBeenCalledWith('conv-1', ['m2'], 'u1', true);

    await act(async () => {
      await result.current.loadOlder();
    });

    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result.current.hasMore).toBe(false);
  });
});
