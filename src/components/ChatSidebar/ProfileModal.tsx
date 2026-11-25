import { Check, Copy, User, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { ChatAuthUser, UserRole } from '../../types/chat.types';
import { Avatar } from '../common/Avatar';

export interface ProfileModalProps {
  open: boolean;
  user: ChatAuthUser;
  onClose: () => void;
  onSave: (updates: { name?: string; photoURL?: string | null; role?: UserRole }) => Promise<unknown>;
}

export function ProfileModal({ open, user, onClose, onSave }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [photoURL, setPhotoURL] = useState(user.photoURL ?? '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setPhotoURL(user.photoURL ?? '');
      setErrorMsg(null);
    }
  }, [open, user.name, user.photoURL]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave({
        name: trimmedName,
        photoURL: photoURL.trim() || null,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyUid() {
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit chat profile"
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-50 text-[#0F766E] flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Your chat profile</h2>
              <p className="text-xs text-slate-500">Stored in chat_users/{user.uid.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <Avatar name={name || user.name} photoURL={photoURL.trim() || null} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{name || user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <code className="text-[11px] font-mono-tabular text-slate-500 truncate">
                UID: {user.uid}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyUid()}
                aria-label="Copy Firebase UID"
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                {copied ? <Check className="h-3 w-3 text-[#0F766E]" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="rsc-profile-name" className="block text-xs font-medium text-slate-700">
              Display name
            </label>
            <input
              id="rsc-profile-name"
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rsc-profile-photo" className="block text-xs font-medium text-slate-700">
              Avatar URL (optional)
            </label>
            <input
              id="rsc-profile-photo"
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://..."
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-60 text-xs font-medium text-white cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
