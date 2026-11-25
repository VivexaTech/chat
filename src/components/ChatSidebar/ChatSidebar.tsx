import {
  Image as ImageIcon,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Mic,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getOtherParticipant } from '../../services/chat.service';
import type { ChatAuthUser, ChatUser, Conversation, UserRole } from '../../types/chat.types';
import { formatConversationTime } from '../../utils/formatters';
import { Avatar } from '../common/Avatar';
import { NewConversationModal } from './NewConversationModal';
import { ProfileModal } from './ProfileModal';

export interface ChatSidebarProps {
  currentUser: ChatAuthUser;
  conversations: Conversation[];
  conversationsLoading: boolean;
  availableUsers: ChatUser[];
  usersLoading: boolean;
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onStartConversation: (recipient: ChatUser) => Promise<unknown>;
  onUpdateProfile: (updates: {
    name?: string;
    photoURL?: string | null;
    role?: UserRole;
  }) => Promise<unknown>;
  onSignOut: () => Promise<void>;
}

function LastMessageIcon({ type }: { type: Conversation['lastMessageType'] }) {
  if (type === 'image') return <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
  if (type === 'audio') return <Mic className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
  if (type === 'location') return <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
  return null;
}

export function ChatSidebar({
  currentUser,
  conversations,
  conversationsLoading,
  availableUsers,
  usersLoading,
  activeConversationId,
  onSelectConversation,
  onStartConversation,
  onUpdateProfile,
  onSignOut,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const usersById = useMemo(() => {
    const map = new Map<string, ChatUser>();
    for (const u of availableUsers) {
      map.set(u.uid, u);
    }
    return map;
  }, [availableUsers]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conv) => {
      const baseOther = getOtherParticipant(conv, currentUser.uid);
      const liveUser = usersById.get(baseOther.uid);
      const name = liveUser?.name ?? baseOther.name;
      const email = liveUser?.email ?? baseOther.email ?? '';
      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        conv.lastMessage.toLowerCase().includes(q)
      );
    });
  }, [conversations, currentUser.uid, searchQuery, usersById]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <aside className="flex flex-col h-full w-full bg-white">
      {/* User header */}
      <div className="px-4 py-3.5 border-b border-slate-900/8 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl p-1 -ml-1 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Edit profile"
        >
          <Avatar name={currentUser.name} photoURL={currentUser.photoURL} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
              {currentUser.role && currentUser.role !== 'user' && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-50 text-[#0F766E] capitalize shrink-0">
                  {currentUser.role}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Profile settings"
            title="Profile settings"
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            aria-label="New conversation"
            title="New conversation"
            className="h-9 w-9 rounded-xl text-[#0F766E] bg-teal-50/80 hover:bg-teal-100/80 flex items-center justify-center transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-3 border-b border-slate-900/6 shrink-0">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200/80 bg-[#F4F5F7] focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto rsc-scroll p-2 space-y-1">
        {conversationsLoading ? (
          <div className="p-2 space-y-2">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl">
                <div className="h-10 w-10 rounded-full bg-slate-200/70 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 bg-slate-200/70 rounded" />
                  <div className="h-3 w-44 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              {conversations.length === 0 ? 'No conversations yet' : 'No matching conversations'}
            </p>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {conversations.length === 0
                ? 'Start a conversation with another registered user to begin messaging in real time.'
                : 'Try a different name or message keyword.'}
            </p>
            {conversations.length === 0 && (
              <button
                type="button"
                onClick={() => setNewChatOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>Start a conversation</span>
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const baseOther = getOtherParticipant(conv, currentUser.uid);
            const liveUser = usersById.get(baseOther.uid);
            const other = liveUser
              ? {
                  ...baseOther,
                  name: liveUser.name,
                  email: liveUser.email,
                  photoURL: liveUser.photoURL,
                  role: liveUser.role ?? baseOther.role,
                }
              : baseOther;
            const unread = conv.unreadCounts[currentUser.uid] ?? 0;
            const isActive = conv.id === activeConversationId;
            const isSentBySelf = conv.lastMessageSenderId === currentUser.uid;
            const previewText = conv.lastMessage || 'No messages yet';

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-700/8 border border-teal-700/15'
                    : 'hover:bg-slate-100/70 border border-transparent'
                }`}
              >
                <Avatar name={other.name} photoURL={other.photoURL} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {other.name}
                      </span>
                      {other.role && other.role !== 'user' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize shrink-0">
                          {other.role}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-mono-tabular shrink-0 ${
                        unread > 0 ? 'text-[#0F766E] font-medium' : 'text-slate-400'
                      }`}
                    >
                      {formatConversationTime(conv.lastMessageAtMs)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <LastMessageIcon type={conv.lastMessageType} />
                      <p
                        className={`text-xs truncate ${
                          unread > 0 ? 'text-slate-800 font-medium' : 'text-slate-500'
                        }`}
                      >
                        {isSentBySelf && conv.lastMessage ? `You: ${previewText}` : previewText}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span
                        aria-label={`${unread} unread messages`}
                        className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#0F766E] text-white text-[11px] font-mono-tabular font-medium inline-flex items-center justify-center shrink-0"
                      >
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <NewConversationModal
        open={newChatOpen}
        users={availableUsers}
        loading={usersLoading}
        onClose={() => setNewChatOpen(false)}
        onSelectUser={async (recipient) => {
          await onStartConversation(recipient);
        }}
      />

      <ProfileModal
        open={profileOpen}
        user={currentUser}
        onClose={() => setProfileOpen(false)}
        onSave={onUpdateProfile}
      />
    </aside>
  );
}
