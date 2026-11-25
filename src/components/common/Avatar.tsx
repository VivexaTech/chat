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
  'bg-[#7C1620]/10 text-[#7C1620] border-[#7C1620]/15',
  'bg-[#C86B3C]/14 text-[#9A4720] border-[#C86B3C]/22',
  'bg-stone-800/8 text-stone-700 border-stone-800/12',
  'bg-amber-800/10 text-amber-900 border-amber-800/15',
  'bg-rose-950/10 text-rose-900 border-rose-950/15',
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
        className={`${sizeCls} shrink-0 rounded-full border border-[#2B1B12]/10 object-cover bg-[#F6F4F1] ${className}`}
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
