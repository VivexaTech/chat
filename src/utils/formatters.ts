import type { Timestamp } from 'firebase/firestore';
import type { MessageType } from '../types/chat.types';

export function timestampToMs(value: Timestamp | Date | number | null | undefined): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return 0;
}

export function formatMessageTime(ms: number): string {
  if (!ms) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

export function formatConversationTime(ms: number): string {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (ms >= startOfToday) {
    return formatMessageTime(ms);
  }
  if (ms >= startOfYesterday) {
    return 'Yesterday';
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function formatDateDivider(ms: number): string {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (ms >= startOfToday) return 'Today';
  if (ms >= startOfYesterday) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function isSameDay(msA: number, msB: number): boolean {
  if (!msA || !msB) return false;
  const a = new Date(msA);
  const b = new Date(msB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

export function deriveDisplayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'User';
  const normalized = localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return normalized || 'User';
}

export function formatMessagePreview(text: string | null | undefined, type: MessageType): string {
  if (type === 'image') return text && text.trim() ? `Photo: ${text.trim()}` : 'Photo';
  if (type === 'audio') return 'Voice message';
  if (type === 'location') return 'Shared location';
  return (text ?? '').trim() || 'Message';
}

export function buildDirectConversationId(uidA: string, uidB: string): string {
  const sorted = [uidA.trim(), uidB.trim()].sort();
  return `${sorted[0]}__${sorted[1]}`;
}
