import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatClient } from '../sdk/createChatClient';
import { normalizeChatError } from '../services/firebase';
import { buildDirectConversationId } from '../utils/formatters';
import type {
  ChatAuthUser,
  ChatError,
  ChatUser,
  Conversation,
  ParticipantDetail,
  UserRole,
} from '../types/chat.types';

export interface UseChatOptions {
  client: ChatClient;
  expectedUserId?: string;
  userRole?: UserRole;
  userName?: string;
  userPhotoURL?: string | null;
  lockedConversationId?: string;
  recipientId?: string;
  recipientProfile?: Partial<ParticipantDetail>;
  onConversationChange?: (conversationId: string | null) => void;
  onError?: (error: ChatError) => void;
}

export function useChat(options: UseChatOptions) {
  const {
    client,
    expectedUserId,
    userRole,
    userName,
    userPhotoURL,
    lockedConversationId,
    recipientId,
    recipientProfile,
    onConversationChange,
    onError,
  } = options;

  const [authUser, setAuthUser] = useState<ChatAuthUser | null>(() => client.auth.getCurrentUser());
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [lockedConversation, setLockedConversation] = useState<Conversation | null>(null);
  const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    lockedConversationId ?? null,
  );
  const [error, setError] = useState<ChatError | null>(null);

  const deliveredAckRef = useRef<Set<string>>(new Set());
  const syncedProfileUidRef = useRef<string | null>(null);
  const activeConvIdRef = useRef<string | null>(activeConversationId);
  activeConvIdRef.current = activeConversationId;
  const recipientProfileRef = useRef(recipientProfile);
  recipientProfileRef.current = recipientProfile;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onConvChangeRef = useRef(onConversationChange);
  onConvChangeRef.current = onConversationChange;

  const reportError = useCallback((err: unknown, fallback: string) => {
    const normalized = normalizeChatError(err, fallback);
    setError(normalized);
    onErrorRef.current?.(normalized);
    return normalized;
  }, []);

  // Subscribe to authentication state
  useEffect(() => {
    setAuthLoading(true);
    let mounted = true;

    const unsubscribe = client.auth.onAuthStateChanged((user) => {
      if (!mounted) return;
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) {
        setConversations([]);
        setLockedConversation(null);
        setAvailableUsers([]);
        setActiveConversationId(lockedConversationId ?? null);
        deliveredAckRef.current.clear();
        syncedProfileUidRef.current = null;
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [client, lockedConversationId]);

  // Bridge external token adapter or sync SDK profile overrides once authenticated
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    async function syncIdentity() {
      if (!authUser && client.authAdapter.ensureAuthenticated) {
        try {
          const bridgedUser = await client.authAdapter.ensureAuthenticated(expectedUserId);
          if (!cancelled && bridgedUser) {
            setAuthUser(bridgedUser);
          }
        } catch (err) {
          if (!cancelled) {
            reportError(err, 'Failed to authenticate chat session.');
          }
        }
        return;
      }

      if (!authUser) return;

      if (expectedUserId && authUser.uid !== expectedUserId) {
        reportError(
          new Error(
            `Signed-in user (${authUser.uid}) does not match expected userId (${expectedUserId}).`,
          ),
          'Authenticated user mismatch.',
        );
        return;
      }

      const hasOverrides = Boolean(userRole || userName || userPhotoURL !== undefined);
      if (hasOverrides || syncedProfileUidRef.current !== authUser.uid) {
        try {
          const profile = await client.auth.ensureProfile(
            authUser,
            hasOverrides
              ? {
                  role: userRole,
                  name: userName,
                  photoURL: userPhotoURL,
                }
              : undefined,
          );
          syncedProfileUidRef.current = authUser.uid;
          if (!cancelled) {
            setAuthUser((prev) =>
              prev && prev.uid === profile.uid
                ? {
                    ...prev,
                    name: profile.name,
                    photoURL: profile.photoURL,
                    role: profile.role ?? prev.role,
                  }
                : prev,
            );
          }
        } catch (err) {
          if (!cancelled) {
            setConversationsLoading(false);
            setUsersLoading(false);
            reportError(err, 'Failed to synchronize user chat profile.');
          }
        }
      }
    }

    void syncIdentity();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    authUser?.uid,
    client,
    expectedUserId,
    reportError,
    userName,
    userPhotoURL,
    userRole,
  ]);

  const isIdentityAuthorized = Boolean(
    authUser && (!expectedUserId || authUser.uid === expectedUserId),
  );

  // Subscribe to conversations list
  useEffect(() => {
    if (!authUser || !isIdentityAuthorized) {
      setConversations([]);
      setConversationsLoading(false);
      return;
    }

    setConversationsLoading(true);
    const unsubscribe = client.conversations.subscribeToList(
      authUser.uid,
      (list) => {
        setConversations(list);
        setConversationsLoading(false);

        // Automatically acknowledge delivery for incoming messages across background/inactive conversations
        const tabVisible =
          typeof document === 'undefined' ? true : document.visibilityState !== 'hidden';
        for (const conv of list) {
          if (conv.id === activeConvIdRef.current && tabVisible) {
            continue;
          }
          if (
            conv.lastMessageId &&
            conv.lastMessageSenderId &&
            conv.lastMessageSenderId !== authUser.uid &&
            conv.lastDeliveredBy?.[authUser.uid] !== conv.lastMessageId
          ) {
            const ackKey = `${conv.id}::${conv.lastMessageId}`;
            if (!deliveredAckRef.current.has(ackKey)) {
              deliveredAckRef.current.add(ackKey);
              void client.messages
                .markDelivered(conv.id, [conv.lastMessageId], authUser.uid, conv.lastMessageId)
                .catch(() => {
                  deliveredAckRef.current.delete(ackKey);
                });
            }
          }
        }
      },
      (err) => {
        setConversationsLoading(false);
        reportError(err, 'Unable to load conversations.');
      },
    );

    return () => unsubscribe();
  }, [authUser, client, isIdentityAuthorized, reportError]);

  // Subscribe to directory of chat users for starting new conversations
  useEffect(() => {
    if (!authUser || !isIdentityAuthorized) {
      setAvailableUsers([]);
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);
    const unsubscribe = client.auth.subscribeUsers(
      authUser.uid,
      (users) => {
        setAvailableUsers(users);
        setUsersLoading(false);
      },
      (err) => {
        setUsersLoading(false);
        reportError(err, 'Unable to load chat users.');
      },
    );

    return () => unsubscribe();
  }, [authUser, client, isIdentityAuthorized, reportError]);

  // Handle locked conversationId in SDK mode
  useEffect(() => {
    if (!lockedConversationId || !authUser || !isIdentityAuthorized) {
      setLockedConversation(null);
      return;
    }

    let cancelled = false;
    let unsubscribe = () => {};

    async function initLockedConversation() {
      if (!authUser || !lockedConversationId) return;
      try {
        await client.conversations.ensureById(
          lockedConversationId,
          authUser,
          recipientId
            ? {
                uid: recipientId,
                ...recipientProfileRef.current,
              }
            : undefined,
        );
        if (cancelled) return;
        setActiveConversationId(lockedConversationId);
        unsubscribe = client.conversations.subscribeToOne(
          lockedConversationId,
          (conv) => {
            if (!cancelled) {
              setLockedConversation(conv);
            }
          },
          (err) => {
            if (!cancelled) {
              reportError(err, 'Unable to access the requested conversation.');
            }
          },
        );
      } catch (err) {
        if (!cancelled) {
          reportError(err, 'Unable to initialize conversation.');
        }
      }
    }

    void initLockedConversation();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    authUser,
    client,
    isIdentityAuthorized,
    lockedConversationId,
    recipientId,
    reportError,
  ]);

  const selectConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
    onConvChangeRef.current?.(conversationId);
  }, []);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return (
      conversations.find((c) => c.id === activeConversationId) ??
      (lockedConversation?.id === activeConversationId ? lockedConversation : null)
    );
  }, [activeConversationId, conversations, lockedConversation]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        return await client.auth.signInWithEmail(email, password);
      } catch (err) {
        throw reportError(err, 'Sign-in failed.');
      }
    },
    [client, reportError],
  );

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await client.auth.signOut();
      setActiveConversationId(null);
    } catch (err) {
      throw reportError(err, 'Sign-out failed.');
    }
  }, [client, reportError]);

  const updateUserProfile = useCallback(
    async (updates: { name?: string; photoURL?: string | null; role?: UserRole }) => {
      if (!authUser) throw new Error('Not signed in.');
      setError(null);
      try {
        const updated = await client.auth.updateProfile(authUser.uid, updates);
        setAuthUser({
          uid: updated.uid,
          email: updated.email,
          name: updated.name,
          photoURL: updated.photoURL,
          role: updated.role,
        });
        return updated;
      } catch (err) {
        throw reportError(err, 'Failed to update profile.');
      }
    },
    [authUser, client, reportError],
  );

  const startConversationWith = useCallback(
    async (recipient: ChatUser) => {
      if (!authUser) throw new Error('You must sign in first.');
      setError(null);

      const expectedId = buildDirectConversationId(authUser.uid, recipient.uid);
      const existing = conversations.find(
        (c) =>
          c.id === expectedId ||
          (c.participants.length === 2 &&
            c.participants.includes(authUser.uid) &&
            c.participants.includes(recipient.uid)),
      );
      if (existing) {
        selectConversation(existing.id);
        return existing;
      }

      try {
        const conv = await client.conversations.getOrCreateDirect(authUser, recipient);
        selectConversation(conv.id);
        return conv;
      } catch (err) {
        throw reportError(err, 'Failed to start conversation.');
      }
    },
    [authUser, client, conversations, reportError, selectConversation],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    authUser: isIdentityAuthorized ? authUser : null,
    authMismatch: Boolean(authUser && expectedUserId && authUser.uid !== expectedUserId),
    authLoading,
    conversations,
    conversationsLoading,
    availableUsers,
    usersLoading,
    activeConversationId,
    activeConversation,
    error,
    clearError,
    selectConversation,
    startConversationWith,
    signIn,
    signOut,
    updateUserProfile,
  };
}
