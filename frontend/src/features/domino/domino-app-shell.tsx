'use client';

import { usePathname, useRouter } from 'next/navigation';
import { IcBookmark, IcMap, IcCompass, IcUser } from './domino-icons';

const TABS = [
  { id: 'saved',    href: '/dashboard', label: 'saved',    Icon: IcBookmark },
  { id: 'map',      href: '/map',       label: 'map',      Icon: IcMap },
  { id: 'discover', href: '/discover',  label: 'discover', Icon: IcCompass },
  { id: 'me',       href: '/me',        label: 'me',       Icon: IcUser },
] as const;

export function DominoAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const active =
    pathname.startsWith('/map') ? 'map' :
    pathname.startsWith('/discover') ? 'discover' :
    pathname.startsWith('/me') ? 'me' : 'saved';

  return (
    <div className="dn-app" style={{
      height: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 'max(44px, env(safe-area-inset-top))',
    }}>
      {/* Dot-grid texture */}
      <div className="dn-grid-bg" />

      {/* Page content */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <nav className="dn-bottom-nav">
        {TABS.map(({ id, href, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              className={`dn-tab${isActive ? ' active' : ''}`}
              onClick={() => router.push(href)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={24} filled={isActive} />
              {isActive && <div className="dn-tab-dot" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
