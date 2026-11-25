import { AlertCircle, Loader2, X } from 'lucide-react';
import { useMemo } from 'react';
import { LoginScreen } from '../components/Auth/LoginScreen';
import { ChatSidebar } from '../components/ChatSidebar/ChatSidebar';
import { ChatWindow } from '../components/ChatWindow/ChatWindow';
import { isFirebaseConfigComplete } from '../config/chat.config';
import { useChat } from '../hooks/useChat';
import { hasValidDefaultFirebaseEnv } from '../services/firebase';
import type { RepairChatProps } from '../types/chat.types';
import { createChatClient, type ChatClient } from './createChatClient';

interface RepairChatShellProps extends RepairChatProps {
  client: ChatClient;
}

function RepairChatShell({
  client,
  userId,
  userRole,
  userName,
  userPhotoURL,
  conversationId,
  recipientId,
  recipientProfile,
  showSidebar,
  pageSize,
  className = '',
  onConversationChange,
  onMessageSent,
  onError,
}: RepairChatShellProps) {
  const {
    authUser,
    authMismatch,
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
  } = useChat({
    client,
    expectedUserId: userId,
    userRole,
    userName,
    userPhotoURL,
    lockedConversationId: conversationId,
    recipientId,
    recipientProfile,
    onConversationChange,
    onError,
  });

  if (authLoading) {
    return (
      <div className={`h-full w-full flex items-center justify-center bg-[#F6F4F1] ${className}`}>
        <div className="flex items-center gap-2.5 text-sm text-[#5C4D45]">
          <Loader2 className="h-4 w-4 animate-spin text-[#7C1620]" />
          <span>Connecting to Repair Series Connect...</span>
        </div>
      </div>
    );
  }

  if (authMismatch) {
    return (
      <div className={`h-full w-full flex items-center justify-center bg-[#F6F4F1] p-4 ${className}`}>
        <div className="max-w-md w-full bg-white border border-[#2B1B12]/10 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#C86B3C] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#1F1612]">Active session mismatch</h2>
              <p className="text-xs text-[#5C4D45] leading-relaxed">
                Another user is currently signed in on this browser. Sign out to authenticate as{' '}
                <code className="font-mono-tabular text-[#1F1612]">{userId}</code>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full h-9 rounded-xl bg-[#7C1620] hover:bg-[#631018] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Sign out current session
          </button>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className={`h-full w-full ${className}`}>
        <LoginScreen
          onSignIn={signIn}
          error={error}
          onClearError={clearError}
          expectedUserId={userId}
        />
      </div>
    );
  }

  const shouldShowSidebar = showSidebar ?? !conversationId;
  const mobileShowingChat = !shouldShowSidebar || activeConversationId !== null;

  return (
    <div className={`h-full w-full flex flex-col bg-white overflow-hidden ${className}`}>
      {error && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-800 flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="truncate">{error.message}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="p-1 text-red-600 hover:text-red-800 cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {shouldShowSidebar && (
          <div
            className={`${
              mobileShowingChat ? 'hidden md:flex' : 'flex'
            } w-full md:w-80 lg:w-96 shrink-0 border-r border-[#2B1B12]/8 h-full min-h-0`}
          >
            <ChatSidebar
              currentUser={authUser}
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              availableUsers={availableUsers}
              usersLoading={usersLoading}
              activeConversationId={activeConversationId}
              onSelectConversation={(id) => selectConversation(id)}
              onStartConversation={startConversationWith}
              onUpdateProfile={updateUserProfile}
              onSignOut={signOut}
            />
          </div>
        )}

        <div
          className={`${
            shouldShowSidebar && !mobileShowingChat ? 'hidden md:flex' : 'flex'
          } flex-1 min-w-0 h-full min-h-0`}
        >
          <ChatWindow
            client={client}
            currentUser={authUser}
            conversation={activeConversation}
            availableUsers={availableUsers}
            pageSize={pageSize}
            onBack={shouldShowSidebar ? () => selectConversation(null) : undefined}
            onMessageSent={onMessageSent}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable, standalone Repair Series Connect chat component.
 * Supports both independent local login and host-app integration via authAdapter + conversationId.
 */
export function RepairChat(props: RepairChatProps) {
  const {
    client,
    firebaseConfig,
    cloudinaryConfig,
    authAdapter,
    pageSize,
    className = '',
  } = props;

  const firebaseConfigKey = firebaseConfig
    ? `${firebaseConfig.apiKey}:${firebaseConfig.authDomain}:${firebaseConfig.projectId}:${firebaseConfig.messagingSenderId ?? ''}:${firebaseConfig.appId}`
    : 'env-default';
  const cloudinaryConfigKey = cloudinaryConfig
    ? `${cloudinaryConfig.cloudName}:${cloudinaryConfig.uploadPreset ?? ''}:${cloudinaryConfig.signedUploadEndpoint ?? ''}:${cloudinaryConfig.folderPrefix ?? ''}`
    : 'env-cloudinary';

  const isConfigured = useMemo(() => {
    if (client) return true;
    if (firebaseConfig) return isFirebaseConfigComplete(firebaseConfig);
    return hasValidDefaultFirebaseEnv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, firebaseConfigKey]);

  const resolvedClient = useMemo(() => {
    if (client) return client;
    if (!isConfigured) return null;
    return createChatClient({
      firebaseConfig,
      cloudinaryConfig,
      authAdapter,
      pageSize,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authAdapter, client, cloudinaryConfigKey, firebaseConfigKey, isConfigured, pageSize]);

  if (!resolvedClient) {
    return (
      <div className={`h-full w-full ${className}`}>
        <LoginScreen
          onSignIn={async () => undefined}
          error={null}
          onClearError={() => {}}
          expectedUserId={props.userId}
        />
      </div>
    );
  }

  return <RepairChatShell {...props} client={resolvedClient} />;
}
