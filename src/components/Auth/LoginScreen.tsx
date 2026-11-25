import { AlertCircle, Eye, EyeOff, Lock, Mail, MessageSquare } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import repairSeriesLogo from '../../assets/repair-series-logo.png';
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
    <div className="h-full w-full overflow-y-auto flex items-center justify-center bg-[#F6F4F1] px-4 py-8">
      <div className="w-full max-w-md bg-white border border-[#2B1B12]/10 rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="h-12 w-12 rounded-xl bg-[#FAF8F5] border border-[#2B1B12]/10 p-1.5 flex items-center justify-center shrink-0">
            <img
              src={repairSeriesLogo}
              alt="Repair Series logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[#1F1612] tracking-tight truncate">
              Repair Series Connect
            </h1>
            <p className="text-xs text-[#6E5C52]">
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
              <div className="rounded-xl border border-[#2B1B12]/10 bg-[#FAF8F5] px-3.5 py-2.5 text-xs text-[#5C4D45]">
                Sign in with the account matching UID{' '}
                <code className="font-mono-tabular text-[#1F1612]">{expectedUserId}</code> to open
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
              <label htmlFor="rsc-login-email" className="block text-xs font-medium text-[#3F312A]">
                Email address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-[#85746A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#2B1B12]/12 bg-white text-base sm:text-sm text-[#1F1612] placeholder:text-[#9C8B80] focus:outline-none focus:border-[#7C1620] focus:ring-2 focus:ring-[#7C1620]/15 transition-colors"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rsc-login-password"
                className="block text-xs font-medium text-[#3F312A]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-[#85746A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  className="w-full h-10 pl-9 pr-10 rounded-xl border border-[#2B1B12]/12 bg-white text-base sm:text-sm text-[#1F1612] placeholder:text-[#9C8B80] focus:outline-none focus:border-[#7C1620] focus:ring-2 focus:ring-[#7C1620]/15 transition-colors"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#85746A] hover:text-[#1F1612] rounded-md transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-xl bg-[#7C1620] hover:bg-[#631018] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{submitting ? 'Signing in...' : 'Sign in to chat'}</span>
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#2B1B12]/8 text-xs text-[#6E5C52] leading-relaxed">
          Authenticated through Firebase Authentication. Your profile in{' '}
          <code className="font-mono-tabular text-[#3F312A]">chat_users</code> is created and
          synced automatically on first sign-in.
        </div>
      </div>
    </div>
  );
}
