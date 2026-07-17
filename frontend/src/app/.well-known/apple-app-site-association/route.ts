import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

/**
 * Serve AASA for iOS universal links.
 * Must return 200 + application/json with no redirects on both
 * domino.fyi and www.domino.fyi (see associated domains in the iOS app).
 */
const AASA = {
  applinks: {
    apps: [] as string[],
    details: [
      {
        appIDs: ['2CTC2JW55A.fyi.domino.app'],
        components: [
          {
            '/': '/dashboard',
            '?': { token: '?*' },
          },
          {
            '/': '/verify',
            '?': { token: '?*' },
          },
        ],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
