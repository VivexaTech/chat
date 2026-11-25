import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatClient } from '../sdk/createChatClient';
import type { ChatAuthUser, TypingState } from '../types/chat.types';

export interface UseTypingIndicatorOptions {
  client: ChatClient;
  conversationId: string | null;
  currentUser: Pick<ChatAuthUser, 'uid' | 'name'> | null;
}

export function useTypingIndicator(options: UseTypingIndicatorOptions) {
  const { client, conversationId, currentUser } = options;
  const currentUid = currentUser?.uid ?? null;
  const { typingThrottleMs, typingIdleTimeoutMs, typingStaleMs } = client.options;

  const [rawTypingStates, setRawTypingStates] = useState<TypingState[]>([]);
  const [tickNow, setTickNow] = useState(() => Date.now());

  const isTypingRef = useRef(false);
  const lastWriteAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeConvRef = useRef<string | null>(conversationId);
  const activeUserRef = useRef(currentUser);
  activeConvRef.current = conversationId;
  activeUserRef.current = currentUser;

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const stopTyping = useCallback(async () => {
    clearIdleTimer();
    const convId = activeConvRef.current;
    const user = activeUserRef.current;
    if (!isTypingRef.current || !convId || !user) {
      isTypingRef.current = false;
      return;
    }
    isTypingRef.current = false;
    lastWriteAtRef.current = 0;
    await client.typing.setTyping(convId, user, false).catch(() => {});
  }, [clearIdleTimer, client]);

  const notifyTyping = useCallback(() => {
    const convId = activeConvRef.current;
    const user = activeUserRef.current;
    if (!convId || !user) return;

    const now = Date.now();
    const shouldWrite =
      !isTypingRef.current || now - lastWriteAtRef.current >= typingThrottleMs;

    if (shouldWrite) {
      isTypingRef.current = true;
      lastWriteAtRef.current = now;
      void client.typing.setTyping(convId, user, true).catch(() => {});
    }

    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      void stopTyping();
    }, typingIdleTimeoutMs);
  }, [clearIdleTimer, client, stopTyping, typingIdleTimeoutMs, typingThrottleMs]);

  // Clear typing state on conversation change or unmount
  useEffect(() => {
    return () => {
      clearIdleTimer();
      const user = activeUserRef.current;
      if (isTypingRef.current && conversationId && user) {
        isTypingRef.current = false;
        lastWriteAtRef.current = 0;
        void client.typing.setTyping(conversationId, user, false).catch(() => {});
      }
    };
  }, [clearIdleTimer, client, conversationId, currentUid]);

  // Subscribe to other participants' typing documents
  useEffect(() => {
    setRawTypingStates([]);
    if (!conversationId || !currentUid) return;

    const unsubscribe = client.typing.subscribe(
      conversationId,
      currentUid,
      (states) => {
        setRawTypingStates(states);
        setTickNow(Date.now());
      },
    );

    return () => unsubscribe();
  }, [client, conversationId, currentUid]);

  // Automatically expire stale typing states without extra Firestore writes
  useEffect(() => {
    if (rawTypingStates.length === 0) return;

    const now = Date.now();
    let soonestRemainingMs = Infinity;
    for (const state of rawTypingStates) {
      const expiresAt = state.updatedAtMs + typingStaleMs;
      const remaining = expiresAt - now;
      if (remaining > 0 && remaining < soonestRemainingMs) {
        soonestRemainingMs = remaining;
      }
    }

    if (!Number.isFinite(soonestRemainingMs)) return;

    const timer = setTimeout(() => {
      setTickNow(Date.now());
    }, Math.max(100, soonestRemainingMs + 50));

    return () => clearTimeout(timer);
  }, [rawTypingStates, typingStaleMs]);

  const activeTypingUsers = useMemo(() => {
    return rawTypingStates.filter(
      (state) => state.isTyping && tickNow - state.updatedAtMs < typingStaleMs,
    );
  }, [rawTypingStates, tickNow, typingStaleMs]);

  const typingLabel = useMemo(() => {
    if (activeTypingUsers.length === 0) return null;
    if (activeTypingUsers.length === 1) {
      const name = activeTypingUsers[0]?.name.trim() || 'Someone';
      return `${name} is typing...`;
    }
    const first = activeTypingUsers[0]?.name.trim() || 'Someone';
    return `${first} and ${activeTypingUsers.length - 1} other${activeTypingUsers.length > 2 ? 's' : ''} are typing...`;
  }, [activeTypingUsers]);

  return {
    activeTypingUsers,
    typingLabel,
    notifyTyping,
    stopTyping,
  };
}
