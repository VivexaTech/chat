import { AlertCircle, Eye, EyeOff, Lock, Mail, MessageSquare, Wrench } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getMissingFirebaseEnvKeys, readEnvFirebaseConfig } from '../../config/chat.config';
import type { ChatError } from '../../types/chat.types';

export interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<unknown>;
  error: ChatError | null;
  onClearError: () => void;
  expectedUserId?: string;
}

export function LoginScreen({
  onSignIn,
  error,
  onClearError,
  expectedUserId,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  const missingEnvKeys = getMissingFirebaseEnvKeys(readEnvFirebaseConfig());
  const isEnvMissing = missingEnvKeys.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalValidationError(null);
    onClearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalValidationError('Enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await onSignIn(trimmedEmail, password);
    } catch {
      // Error state is handled by parent hook and surfaced cleanly via error prop
    } finally {
      setSubmitting(false);
    }
  }

  const displayedError = localValidationError ?? error?.message ?? null;

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-[#F4F5F7] px-4 py-8">
      <div className="w-full max-w-md bg-white border border-slate-900/10 rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-[#0F766E] text-white flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
              Repair Series Connect
            </h1>
            <p className="text-xs text-slate-500">
              Independent real-time messaging workspace
            </p>
          </div>
        </div>

        {isEnvMissing ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium">Firebase configuration required</p>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Create a <code className="font-mono-tabular bg-amber-100 px-1 py-0.5 rounded">.env</code>{' '}
                  file from <code className="font-mono-tabular bg-amber-100 px-1 py-0.5 rounded">.env.example</code>{' '}
                  using your independent Firebase project credentials:
                </p>
                <ul className="text-xs font-mono-tabular text-amber-900 space-y-0.5 pl-3 list-disc">
                  {missingEnvKeys.map((key) => (
                    <li key={key}>{key}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {expectedUserId && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                Sign in with the account matching UID{' '}
                <code className="font-mono-tabular text-slate-800">{expectedUserId}</code> to open
                this session.
              </div>
            )}

            {displayedError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="rsc-login-email" className="block text-xs font-medium text-slate-700">
                Email address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="rsc-login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localValidationError) setLocalValidationError(null);
                  }}
                  placeholder="name@example.com"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 transition-colors"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rsc-login-password"
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="rsc-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localValidationError) setLocalValidationError(null);
                  }}
                  placeholder="Enter your password"
                  className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 transition-colors"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{submitting ? 'Signing in...' : 'Sign in to chat'}</span>
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
          Authenticated through Firebase Authentication. Your profile in{' '}
          <code className="font-mono-tabular text-slate-700">chat_users</code> is created and
          synced automatically on first sign-in.
        </div>
      </div>
    </div>
  );
}
