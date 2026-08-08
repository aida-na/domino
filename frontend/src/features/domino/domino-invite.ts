import type { DominoMeResponse } from '@/features/domino/domino-api';

export function inviteUrlFor(profile: DominoMeResponse | null): string | null {
  if (profile?.invite_url) return profile.invite_url;
  if (profile?.invite_code) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://domino.fyi';
    return `${origin}/login?ref=${profile.invite_code}`;
  }
  return null;
}

export async function shareInvite(url: string): Promise<'shared' | 'copied'> {
  const data = {
    title: 'join me on domino',
    text: "i use domino to save links over iMessage. join with my link and we'll connect automatically:",
    url,
  };
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
    }
  }
  await navigator.clipboard.writeText(
    `join me on domino — save links over iMessage. we'll connect automatically:\n${url}`,
  );
  return 'copied';
}

export const REFERRER_TOAST_KEY = 'domino_referrer_toast_v1';
