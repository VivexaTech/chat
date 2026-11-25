import { Search, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ChatUser } from '../../types/chat.types';
import { Avatar } from '../common/Avatar';

export interface NewConversationModalProps {
  open: boolean;
  users: ChatUser[];
  loading: boolean;
  onClose: () => void;
  onSelectUser: (user: ChatUser) => Promise<void>;
}

export function NewConversationModal({
  open,
  users,
  loading,
  onClose,
  onSelectUser,
}: NewConversationModalProps) {
  const [queryText, setQueryText] = useState('');
  const [creatingUid, setCreatingUid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setQueryText('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role ?? '').toLowerCase().includes(q),
    );
  }, [queryText, users]);

  if (!open) return null;

  async function handlePick(user: ChatUser) {
    if (creatingUid) return;
    setErrorMsg(null);
    setCreatingUid(user.uid);
    try {
      await onSelectUser(user);
      onClose();
    } catch (err) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Unable to start conversation. Check Firestore rules and try again.';
      setErrorMsg(message);
    } finally {
      setCreatingUid(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start a new conversation"
      className="fixed inset-0 z-50 bg-[#1F1612]/45 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-[#2B1B12]/10 rounded-2xl shadow-lg overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B1B12]/8">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#FDF2EC] text-[#7C1620] flex items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1F1612]">New conversation</h2>
              <p className="text-xs text-[#6E5C52]">Select an authenticated chat user</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#85746A] hover:text-[#1F1612] hover:bg-[#F6F4F1] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[#2B1B12]/8">
          <div className="relative">
            <Search className="h-4 w-4 text-[#85746A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search by name or email"
              autoFocus
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#2B1B12]/12 bg-[#F6F4F1] focus:bg-white text-base sm:text-sm text-[#1F1612] placeholder:text-[#9C8B80] focus:outline-none focus:border-[#7C1620] focus:ring-2 focus:ring-[#7C1620]/15"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rsc-scroll p-2 space-y-1">
          {errorMsg && (
            <div
              role="alert"
              className="mx-2 my-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {errorMsg}
            </div>
          )}
          {loading ? (
            <div className="p-6 text-center text-xs text-[#6E5C52]">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center space-y-1.5">
              <p className="text-sm font-medium text-[#3F312A]">
                {users.length === 0 ? 'No other users registered yet' : 'No matching users'}
              </p>
              <p className="text-xs text-[#6E5C52] leading-relaxed">
                {users.length === 0
                  ? 'Sign in with your second Firebase Authentication account in a separate browser session so its chat_users profile appears here.'
                  : 'Try searching with a different name or email address.'}
              </p>
            </div>
          ) : (
            filtered.map((user) => (
              <button
                key={user.uid}
                type="button"
                disabled={creatingUid !== null}
                onClick={() => void handlePick(user)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F6F4F1] disabled:opacity-60 text-left transition-colors cursor-pointer"
              >
                <Avatar name={user.name} photoURL={user.photoURL} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#1F1612] truncate">{user.name}</p>
                    {user.role && user.role !== 'user' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#FDF2EC] text-[#9A4720] capitalize shrink-0">
                        {user.role}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6E5C52] truncate">{user.email}</p>
                </div>
                {creatingUid === user.uid && (
                  <span className="text-xs text-[#7C1620] font-medium shrink-0">Opening...</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
