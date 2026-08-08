// Shared SVG icons matching the design prototype

type IconProps = { size?: number; filled?: boolean };

const Ic = ({ d, size = 18, sw = 1.7, children }: { d?: string; size?: number; sw?: number; children?: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    {d ? <path d={d} /> : children}
  </svg>
);

export const IcSearch = ({ size = 16 }: IconProps) => (
  <Ic size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Ic>
);
export const IcSort = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="M4 6h16M7 12h10M10 18h4" />
);
export const IcX = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="m6 6 12 12M18 6 6 18" />
);
export const IcStar = ({ size = 16, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M12 3.5l2.6 5.5 6 .9-4.4 4.2 1 6L12 17.6 6.8 20.1l1-6L3.4 9.9l6-.9z" />
  </svg>
);
export const IcPin = ({ size = 16, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M12 2.5l-3 3 1 1L7 9.5 4.5 10l4 4L4 18.5l1 1L9.5 15l4 4L14 16.5l3-3 1 1 3-3-9-9z" />
  </svg>
);
export const IcShare = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="M12 4v12m0-12-3 3m3-3 3 3M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
);
export const IcLink = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="M9.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
);
export const IcArrowUp = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="M12 19V5M5 12l7-7 7 7" />
);
export const IcExt = ({ size = 12 }: IconProps) => (
  <Ic size={size} d="M7 17 17 7M9 7h8v8" />
);
export const IcBookmark = ({ size = 22, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M6 4h12v17l-6-4-6 4z" />
  </svg>
);
export const IcMap = ({ size = 22, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v16M15 6v16" />
  </svg>
);
export const IcAsk = ({ size = 22, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M10 8.5a1.5 1.5 0 1 1 1.5 1.5" />
  </svg>
);
export const IcCompass = ({ size = 22, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="12" r="9" /><path d="m15 9-3.5 5L7 16l2-5 5-2z" />
  </svg>
);
export const IcUser = ({ size = 22, filled }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);
export const IcPlus = ({ size = 22 }: IconProps) => (
  <Ic size={size} sw={2.2} d="M12 5v14M5 12h14" />
);
export const IcChevron = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="m9 6 6 6-6 6" />
);
export const IcNote = ({ size = 14 }: IconProps) => (
  <Ic size={size} d="M4 4h12l4 4v12H4zM16 4v4h4" />
);
export const IcPdf = ({ size = 14 }: IconProps) => (
  <Ic size={size}><path d="M5 3h10l4 4v14H5z" /><path d="M9 14h1.5a1.5 1.5 0 0 0 0-3H9zM14 14v-3h2M14 12.5h1.5" /></Ic>
);
export const IcImage = ({ size = 14 }: IconProps) => (
  <Ic size={size}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-9 9" /></Ic>
);
export const IcClipboard = ({ size = 14 }: IconProps) => (
  <Ic size={size}><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /></Ic>
);
export const IcCopy = ({ size = 16 }: IconProps) => (
  <Ic size={size}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M15 5.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" /></Ic>
);
export const IcPencil = ({ size = 16 }: IconProps) => (
  <Ic size={size} d="M15.5 3.5 20 8 8.5 19.5H4V15z" />
);
export const IcUsers = ({ size = 16 }: IconProps) => (
  <Ic size={size}><circle cx="9" cy="8" r="3.4" /><path d="M2.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" /><circle cx="18" cy="8.5" r="2.6" /></Ic>
);
export const IcUserPlus = ({ size = 16 }: IconProps) => (
  <Ic size={size}><circle cx="9" cy="8" r="3.4" /><path d="M2.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" /><path d="M18 7v5M15.5 9.5h5" /></Ic>
);
export const IcClock = ({ size = 16 }: IconProps) => (
  <Ic size={size}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.4l3.4 2" /></Ic>
);
export const IcSun = ({ size = 16 }: IconProps) => (
  <Ic size={size}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></Ic>
);

export function KindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  if (kind === 'note') return <IcNote size={size} />;
  if (kind === 'pdf') return <IcPdf size={size} />;
  if (kind === 'image') return <IcImage size={size} />;
  return <IcLink size={size} />;
}
