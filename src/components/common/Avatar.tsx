import { useState } from 'react';
import { getInitials } from '../../utils/formatters';

export interface AvatarProps {
  name: string;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const TONE_CLASSES = [
  'bg-teal-700/10 text-teal-800 border-teal-700/15',
  'bg-slate-800/10 text-slate-700 border-slate-800/15',
  'bg-sky-700/10 text-sky-800 border-sky-700/15',
  'bg-amber-700/10 text-amber-800 border-amber-700/15',
  'bg-emerald-700/10 text-emerald-800 border-emerald-700/15',
];

function pickTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TONE_CLASSES[hash % TONE_CLASSES.length] ?? TONE_CLASSES[0]!;
}

export function Avatar({ name, photoURL, size = 'md', className = '' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeCls = SIZE_CLASSES[size];

  if (photoURL && !imgFailed) {
    return (
      <img
        src={photoURL}
        alt={name}
        onError={() => setImgFailed(true)}
        className={`${sizeCls} shrink-0 rounded-full border border-slate-900/10 object-cover bg-slate-100 ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeCls} ${pickTone(name)} shrink-0 select-none rounded-full border font-medium flex items-center justify-center ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
