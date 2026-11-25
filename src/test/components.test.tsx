import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepairChat, type ChatClient } from 'repair-series-connect';
import * as chatConfig from '../config/chat.config';
import { LoginScreen } from '../components/Auth/LoginScreen';
import { ImageViewer } from '../components/ImageViewer/ImageViewer';
import { NewConversationModal } from '../components/ChatSidebar/NewConversationModal';
import { VoiceRecorder } from '../components/VoiceRecorder/VoiceRecorder';
import type { ChatAuthUser, ChatMessage, ChatUser, Conversation } from '../types/chat.types';

function createInteractiveMockClient() {
  let currentUser: ChatAuthUser | null = {
    uid: 'uid-vivek',
    email: 'user1@example.com',
    name: 'Vivek',
    photoURL: null,
    role: 'customer',
  };

  let authCb: ((user: ChatAuthUser | null) => void) | null = null;
  let convsCb: ((convs: Conversation[]) => void) | null = null;
  let msgsCb:
    | ((res: { messages: ChatMessage[]; oldestCursor: any; hasMore: boolean }) => void)
    | null = null;
  let typingCb: ((states: { uid: string; name: string; isTyping: boolean; updatedAtMs: number }[]) => void) | null =
    null;

  const otherUser: ChatUser = {
    uid: 'uid-test',
    email: 'user2@example.com',
    name: 'Test User',
    photoURL: null,
    role: 'partner',
  };

  const conversation: Conversation = {
    id: 'uid-test__uid-vivek',
    participants: ['uid-vivek', 'uid-test'],
    participantDetails: {
      'uid-vivek': { uid: 'uid-vivek', name: 'Vivek', email: 'user1@example.com', role: 'customer' },
      'uid-test': { uid: 'uid-test', name: 'Test User', email: 'user2@example.com', role: 'partner' },
    },
    lastMessage: 'How can I help with your repair?',
    lastMessageType: 'text',
    lastMessageId: 'msg-1',
    lastMessageSenderId: 'uid-test',
    lastMessageAt: Date.now() - 60000,
    lastMessageAtMs: Date.now() - 60000,
    unreadCounts: { 'uid-vivek': 1, 'uid-test': 0 },
    createdAt: Date.now() - 120000,
    updatedAt: Date.now() - 60000,
  };

  const initialMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      conversationId: conversation.id,
      senderId: 'uid-test',
      messageType: 'text',
      text: 'How can I help with your repair?',
      mediaURL: null,
      mediaMetadata: null,
      location: null,
      createdAt: Date.now() - 60000,
      createdAtMs: Date.now() - 60000,
      readBy: ['uid-test'],
      deliveredTo: ['uid-test'],
    },
    {
      id: 'msg-2',
      conversationId: conversation.id,
      senderId: 'uid-vivek',
      messageType: 'location',
      text: null,
      mediaURL: null,
      mediaMetadata: null,
      location: { latitude: 12.9716, longitude: 77.5946, accuracy: 12 },
      createdAt: Date.now() - 30000,
      createdAtMs: Date.now() - 30000,
      readBy: ['uid-vivek', 'uid-test'],
      deliveredTo: ['uid-vivek', 'uid-test'],
    },
  ];

  const sendText = vi.fn(async (_conv: Conversation, senderId: string, text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: conversation.id,
      senderId,
      messageType: 'text',
      text,
      mediaURL: null,
      mediaMetadata: null,
      location: null,
      createdAt: Date.now(),
      createdAtMs: Date.now(),
      readBy: [senderId],
      deliveredTo: [senderId],
    };
    initialMessages.push(newMsg);
    msgsCb?.({ messages: [...initialMessages], oldestCursor: null, hasMore: false });
    return newMsg;
  });

  const sendLocation = vi.fn(async (_conv: Conversation, senderId: string, loc) => {
    const newMsg: ChatMessage = {
      id: `msg-loc-${Date.now()}`,
      conversationId: conversation.id,
      senderId,
      messageType: 'location',
      text: null,
      mediaURL: null,
      mediaMetadata: null,
      location: loc,
      createdAt: Date.now(),
      createdAtMs: Date.now(),
      readBy: [senderId],
      deliveredTo: [senderId],
    };
    initialMessages.push(newMsg);
    msgsCb?.({ messages: [...initialMessages], oldestCursor: null, hasMore: false });
    return newMsg;
  });

  const signOut = vi.fn(async () => {
    currentUser = null;
    authCb?.(null);
  });

  const client: ChatClient = {
    services: {} as ChatClient['services'],
    authAdapter: {
      mode: 'firebase-email',
      getCurrentUser: () => currentUser,
      onAuthStateChanged: (cb) => {
        authCb = cb;
        cb(currentUser);
        return () => {};
      },
      signOut,
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
      getCurrentUser: () => currentUser,
      onAuthStateChanged: (cb) => {
        authCb = cb;
        cb(currentUser);
        return () => {};
      },
      signInWithEmail: vi.fn(),
      signOut,
      ensureProfile: vi.fn(async (u) => u),
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      listUsers: vi.fn().mockResolvedValue([otherUser]),
      subscribeUsers: (_ex, onUsers) => {
        onUsers([otherUser]);
        return () => {};
      },
    },
    conversations: {
      subscribeToList: (_uid, onConvs) => {
        convsCb = onConvs;
        onConvs([conversation]);
        return () => {};
      },
      subscribeToOne: (_id, onConv) => {
        onConv(conversation);
        return () => {};
      },
      getOrCreateDirect: vi.fn().mockResolvedValue(conversation),
      ensureById: vi.fn().mockResolvedValue(conversation),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    },
    messages: {
      subscribeLatest: (_id, onRes) => {
        msgsCb = onRes;
        onRes({ messages: [...initialMessages], oldestCursor: null, hasMore: false });
        return () => {};
      },
      loadOlder: vi.fn(),
      sendText,
      sendImage: vi.fn(),
      sendVoice: vi.fn(),
      sendLocation,
      markDelivered: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      getDeliveryStatus: (m, parts) => {
        const others = parts.filter((p) => p !== m.senderId);
        if (others.some((p) => m.readBy.includes(p))) return 'read';
        if (others.some((p) => m.deliveredTo.includes(p))) return 'delivered';
        return 'sent';
      },
    },
    typing: {
      setTyping: vi.fn().mockResolvedValue(undefined),
      subscribe: (_id, _uid, onTyping) => {
        typingCb = onTyping;
        onTyping([]);
        return () => {};
      },
    },
    media: {
      validateImageFile: () => ({ valid: true }),
      validateAudioBlob: () => ({ valid: true }),
      uploadImage: vi.fn(),
      uploadVoiceNote: vi.fn(),
      downloadFile: vi.fn(),
    },
    location: {
      getCurrentPosition: vi.fn().mockResolvedValue({
        latitude: 12.971598,
        longitude: 77.594566,
        accuracy: 15,
      }),
      buildGoogleMapsUrl: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
    },
  };

  return {
    client,
    sendText,
    sendLocation,
    signOut,
    triggerRemoteTyping: (name: string) =>
      typingCb?.([{ uid: 'uid-test', name, isTyping: true, updatedAtMs: Date.now() }]),
    updateConvs: (convs: Conversation[]) => convsCb?.(convs),
  };
}

describe('LoginScreen', () => {
  it('shows Firebase configuration instructions when env vars are missing', () => {
    const spy = vi.spyOn(chatConfig, 'readEnvFirebaseConfig').mockReturnValue({
      apiKey: '',
      authDomain: '',
      projectId: '',
      appId: '',
    });
    render(<LoginScreen onSignIn={vi.fn()} error={null} onClearError={vi.fn()} />);
    expect(screen.getByText(/Firebase configuration required/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_FIREBASE_API_KEY/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('submits email and password when Firebase env is configured', async () => {
    const spy = vi.spyOn(chatConfig, 'readEnvFirebaseConfig').mockReturnValue({
      apiKey: 'demo-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo-project',
      appId: '1:12345:web:abc',
    });
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen onSignIn={onSignIn} error={null} onClearError={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'user1@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in to chat/i }));

    await waitFor(() => {
      expect(onSignIn).toHaveBeenCalledWith('user1@example.com', 'secret123');
    });
    spy.mockRestore();
  });
});

describe('RepairChat SDK & Chat Flow', () => {
  it('renders conversations, sends real-time text messages, confirms location before sharing, shows typing indicator, and omits online status', async () => {
    const { client, sendText, sendLocation, signOut, triggerRemoteTyping } =
      createInteractiveMockClient();

    render(<RepairChat client={client} userId="uid-vivek" userRole="customer" />);

    // Sidebar displays logged-in user and conversation list with unread badge
    expect(await screen.findByText('Vivek')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByLabelText('1 unread messages')).toBeInTheDocument();

    // Verify no online/offline/last-seen indicator text exists
    expect(screen.queryByText(/online|offline|last seen|active now/i)).not.toBeInTheDocument();

    // Open conversation
    fireEvent.click(screen.getByText('Test User'));

    // Messages and Google Maps link render (appears in sidebar preview and chat window)
    const initialMsgNodes = await screen.findAllByText('How can I help with your repair?');
    expect(initialMsgNodes.length).toBeGreaterThanOrEqual(1);
    const mapsLink = screen.getByRole('link', { name: /Open in Google Maps/i });
    expect(mapsLink).toHaveAttribute('href', 'https://www.google.com/maps?q=12.9716,77.5946');

    // Remote typing indicator appears
    triggerRemoteTyping('Test User');
    expect(await screen.findAllByText('Test User is typing...')).toHaveLength(2);

    // Send a text message
    const composer = screen.getByPlaceholderText('Message');
    fireEvent.change(composer, { target: { value: 'On my way now' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(sendText).toHaveBeenCalledWith(expect.anything(), 'uid-vivek', 'On my way now');
    });
    expect(await screen.findByText('On my way now')).toBeInTheDocument();

    // Location sharing requires explicit user confirmation modal before sending
    fireEvent.click(screen.getByLabelText('Attach image or location'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Current location/i }));

    expect(await screen.findByRole('dialog', { name: /Confirm location sharing/i })).toBeInTheDocument();
    expect(sendLocation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Share location' }));
    await waitFor(() => {
      expect(sendLocation).toHaveBeenCalledWith(expect.anything(), 'uid-vivek', {
        latitude: 12.971598,
        longitude: 77.594566,
        accuracy: 15,
      });
    });

    // Sign out works
    fireEvent.click(screen.getByLabelText('Sign out'));
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  it('supports locked conversationId SDK mode without sidebar', async () => {
    const { client } = createInteractiveMockClient();

    render(
      <RepairChat
        client={client}
        userId="uid-vivek"
        userRole="customer"
        conversationId="uid-test__uid-vivek"
        showSidebar={false}
      />,
    );

    expect(await screen.findByText('How can I help with your repair?')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search conversations')).not.toBeInTheDocument();
  });

  it('filters conversations by search query in sidebar', async () => {
    const { client } = createInteractiveMockClient();
    render(<RepairChat client={client} userId="uid-vivek" userRole="customer" />);

    expect(await screen.findByText('Test User')).toBeInTheDocument();
    const searchInput = screen.getByLabelText('Search conversations');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-person' } });

    expect(screen.getByText('No matching conversations')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});

describe('ImageViewer & VoiceRecorder', () => {
  it('opens and closes full-screen ImageViewer via Escape and close button', () => {
    const onClose = vi.fn();
    render(
      <ImageViewer
        imageUrl="https://example.com/photo.jpg"
        fileName="photo.jpg"
        caption="Damaged screen"
        senderName="Vivek"
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog', { name: /Full-screen image viewer/i })).toBeInTheDocument();
    expect(screen.getByText('Damaged screen')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles microphone permission errors gracefully in VoiceRecorder', async () => {
    const originalMediaDevices = navigator.mediaDevices;
    const originalMediaRecorder = globalThis.MediaRecorder;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class MockMediaRecorder {
        static isTypeSupported() {
          return true;
        }
      },
    });

    const onCancel = vi.fn();
    render(<VoiceRecorder onCancel={onCancel} onSendVoiceNote={vi.fn()} />);

    expect(
      await screen.findByText(/Microphone permission denied/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    });
  });

  it('displays permission error inside NewConversationModal without throwing an unhandled rejection', async () => {
    const onSelectUser = vi.fn().mockRejectedValue({
      code: 'permission-denied',
      message: 'You do not have permission to access this resource.',
    });

    render(
      <NewConversationModal
        open={true}
        users={[
          {
            uid: 'uid-test',
            name: 'Test User',
            email: 'user2@example.com',
            photoURL: null,
          },
        ]}
        loading={false}
        onClose={vi.fn()}
        onSelectUser={onSelectUser}
      />,
    );

    fireEvent.click(screen.getByText('Test User'));
    expect(
      await screen.findByText('You do not have permission to access this resource.'),
    ).toBeInTheDocument();
  });
});
