import type { DominoItem } from './domino-api';

export interface Bookmark {
  id: string;
  kind: 'link' | 'note' | 'pdf' | 'image';
  title: string | null;
  url: string | null;
  domain: string | null;
  color: string;
  categories: string[];
  snippet: string | null;
  days: number;
  starred: boolean;
  pinned: boolean;
}

const COLORS = ['y', 'p', 'v', 'o', 'm', 'b', 's'] as const;

export function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function cardColor(c: string): string {
  return `var(--card-${c || 's'})`;
}

export function faviconLetter(domain: string | null): string {
  if (!domain) return '·';
  return domain.replace(/^www\./, '')[0].toUpperCase();
}

export function urlToDisplayTitle(url: string | null, domain: string | null): string {
  if (!url) return 'Untitled';
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    if (!path || path === '/') return domain || u.hostname;
    const seg = path.split('/').filter(Boolean).slice(-2).join(' / ');
    return seg.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
  } catch {
    return url;
  }
}

export function timeAgo(days: number): string {
  if (days < 1) return 'today';
  if (days < 2) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function extractTitle(item: DominoItem): string | null {
  if (item.input_type === 'note') {
    const firstLine = item.raw_input.split('\n')[0].trim();
    return firstLine.slice(0, 80) || null;
  }
  if (item.summary) {
    const first = item.summary.split('\n')[0].replace(/^#+\s*/, '').trim();
    if (first && first.length < 120) return first;
  }
  return null;
}

export function toBookmark(item: DominoItem): Bookmark {
  const isLink = item.input_type === 'link';
  const isNote = item.input_type === 'note';
  const domain = isLink ? extractDomain(item.raw_input) : null;
  const topic = item.topic || 'Inbox';

  return {
    id: item.id,
    kind: item.input_type as Bookmark['kind'],
    title: extractTitle(item),
    url: isLink ? item.raw_input : null,
    domain,
    color: hashColor(topic),
    categories: [topic],
    snippet: isNote
      ? item.raw_input.slice(0, 280)
      : (item.summary?.slice(0, 200) ?? null),
    days: daysSince(item.created_at),
    starred: item.is_favorited,
    pinned: item.is_pinned,
  };
}
