import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const INR_COMPACT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number | null | undefined, compact = false) {
  if (value == null || Number.isNaN(value)) return '—';
  return (compact ? INR_COMPACT : INR).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1) {
  if (value == null) return '—';
  return `${value.toFixed(fractionDigits)}%`;
}

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const DATE = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  return DATE_TIME.format(typeof d === 'string' ? new Date(d) : d);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return DATE.format(typeof d === 'string' ? new Date(d) : d);
}

export function timeAgo(d: string | Date | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
}

export function initials(name: string | null | undefined) {
  if (!name) return '??';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function pickFirst<T>(...vals: (T | null | undefined)[]): T | undefined {
  for (const v of vals) if (v != null) return v;
  return undefined;
}
