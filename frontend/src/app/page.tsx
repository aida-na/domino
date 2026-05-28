'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { WaitlistModal } from '@/components/WaitlistModal';

const DISPLAY_NUMBER = '(650) 449-4254';

function PipHalf({ pattern }: { pattern: 1 | 2 | 3 | 4 | 5 | 6 }) {
  return (
    <div className={`d-half p${pattern}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className={`pip pos-${i + 1}`} />
      ))}
    </div>
  );
}

function DominoTile({
  top,
  bottom,
}: {
  top: 1 | 2 | 3 | 4 | 5 | 6;
  bottom: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  return (
    <div className="cell black">
      <div className="domino domino-anim">
        <PipHalf pattern={top} />
        <div className="d-line" />
        <PipHalf pattern={bottom} />
      </div>
    </div>
  );
}

export default function DominoLandingPage() {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    if (!isLoading && sessionToken) router.replace('/dashboard');
  }, [isLoading, sessionToken, router]);

  useEffect(() => {
    if (isLoading) return;
    const grid = gridRef.current;
    if (!grid) return;
    const dominos = grid.querySelectorAll<HTMLElement>('.domino-anim');
    let isAnimating = false;

    const triggerChain = () => {
      if (isAnimating) return;
      isAnimating = true;
      dominos.forEach((d) => {
        d.classList.remove('fall', 'rise');
        void d.offsetWidth;
      });
      dominos.forEach((d, i) => {
        setTimeout(() => d.classList.add('fall'), i * 100);
      });
      setTimeout(() => {
        dominos.forEach((d, i) => {
          setTimeout(() => {
            d.classList.remove('fall');
            d.classList.add('rise');
          }, i * 80);
        });
        setTimeout(() => {
          isAnimating = false;
        }, dominos.length * 80 + 500);
      }, dominos.length * 100 + 800);
    };

    grid.addEventListener('click', triggerChain);
    const t = setTimeout(triggerChain, 1000);
    const interval = setInterval(triggerChain, 4000);
    return () => {
      grid.removeEventListener('click', triggerChain);
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background bg-check-grid">
        <span className="w-5 h-5 rounded-full border-2 border-[#ED4715] border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background bg-check-grid text-[#1A1208] font-figtree lowercase overflow-x-hidden leading-snug relative flex flex-col">

      <style>{`
        .page-domino { max-width: 600px; margin: 0 auto; padding: 0 20px 60px; position: relative; z-index: 1; flex: 1; }
        .hero-domino { margin-bottom: 32px; }
        .headline-domino {
          font-size: clamp(28px, 7vw, 42px);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 16px;
          color: #1A1208;
        }
        .headline-domino em {
          font-style: normal;
          font-size: clamp(15px, 3.8vw, 20px);
          font-weight: 400;
          color: #1A1208;
          display: block;
          margin-top: 10px;
        }
        .cta-link-domino {
          font-size: 18px;
          font-weight: 700;
          color: #ED4715;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-bottom: 2px solid #ED4715;
          padding-bottom: 2px;
          transition: gap 0.2s;
        }
        .cta-link-domino:hover { gap: 12px; }
        .grid-domino {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          width: 100%;
          margin-top: 20px;
          cursor: pointer;
        }
        .cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          transition: transform 0.2s ease;
        }
        .cell.black {
          background: linear-gradient(145deg, #201810, #1A1208);
          perspective: 500px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .cell.cream {
          background: linear-gradient(145deg, #EFEBE0, #E8E4D8);
          border: 1px solid rgba(209,205,192,0.4);
          box-shadow: 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7);
        }
        .cell.orange {
          background: linear-gradient(145deg, #F45A20, #ED4715, #D93D0E);
          grid-column: span 2;
          box-shadow: 0 6px 24px rgba(237,71,21,0.35), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .cell.white {
          background: linear-gradient(145deg, #FFFFFF, #FAFAF8);
          border: 1px solid rgba(209,205,192,0.35);
          box-shadow: 0 2px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .domino {
          width: 36%;
          height: 76%;
          background: linear-gradient(160deg, #FFFDF9, #FFFCF7, #F8F5EF);
          border-radius: 5px;
          display: flex;
          flex-direction: column;
          box-shadow: 2px 4px 8px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8);
          position: relative;
          transform-origin: bottom center;
          transition: transform 0.1s;
        }
        .cell.cream .domino {
          background: linear-gradient(160deg, #201810, #1A1208);
          box-shadow: 2px 4px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .d-line {
          height: 1.5px;
          width: 65%;
          background: rgba(0,0,0,0.1);
          margin: auto;
        }
        .cell.cream .d-line { background: rgba(255,255,255,0.15); }
        .d-half {
          height: 48%;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          padding: 14%;
          align-items: center;
          justify-items: center;
        }
        .pip {
          width: 85%;
          height: 85%;
          background: #1A1208;
          border-radius: 50%;
          visibility: hidden;
        }
        .cell.cream .pip { background: #F2EFE8; }
        .p1 .pos-5 { visibility: visible; }
        .p2 .pos-1, .p2 .pos-9 { visibility: visible; }
        .p3 .pos-1, .p3 .pos-5, .p3 .pos-9 { visibility: visible; }
        .p4 .pos-1, .p4 .pos-3, .p4 .pos-7, .p4 .pos-9 { visibility: visible; }
        .p5 .pos-1, .p5 .pos-3, .p5 .pos-5, .p5 .pos-7, .p5 .pos-9 { visibility: visible; }
        .p6 .pos-1, .p6 .pos-3, .p6 .pos-4, .p6 .pos-6, .p6 .pos-7, .p6 .pos-9 { visibility: visible; }
        .text-cell {
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-end;
          padding: clamp(6px, 2vw, 12px);
          aspect-ratio: auto;
          min-height: 0;
        }
        .cell-label {
          font-size: clamp(8px, 2vw, 11px);
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #9A9080;
          margin-bottom: 2px;
        }
        .cell-text {
          font-size: clamp(10px, 2.8vw, 15px);
          font-weight: 700;
          line-height: 1.2;
          color: #1A1208;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        .cell.black.text-cell .cell-label { color: rgba(255,255,255,0.5); }
        .cell.black.text-cell .cell-text { color: #FFFFFF; }
        .cell.orange .cell-label { color: rgba(255,255,255,0.7); }
        .cell.orange .cell-text { color: #FFFFFF; font-size: clamp(14px, 3.8vw, 20px); }
        .phone-cell {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          gap: 4px;
        }
        .phone-num { font-size: clamp(16px, 4.2vw, 24px); font-weight: 900; color: white; letter-spacing: -0.02em; }
        .phone-sub { font-size: clamp(9px, 2.2vw, 11px); font-weight: 700; color: rgba(255,255,255,0.8); }
        .domino-anim.fall { animation: dominoFall 0.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards; }
        .domino-anim.rise { animation: dominoRise 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes dominoFall {
          0% { transform: rotateX(0deg) rotateZ(0deg); }
          100% { transform: rotateX(10deg) rotateZ(72deg) translate(12px, 8px); opacity: 0.8; }
        }
        @keyframes dominoRise {
          0% { transform: rotateX(10deg) rotateZ(72deg) translate(12px, 8px); opacity: 0.8; }
          100% { transform: rotateX(0deg) rotateZ(0deg) translate(0, 0); opacity: 1; }
        }
        @media (max-width: 480px) {
          .grid-domino { gap: 4px; }
        }
      `}</style>

      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-compagnon text-xl font-bold tracking-wider text-foreground">
          domino<span className="text-primary">.</span>
        </span>
        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px] inline-flex items-center justify-center -mr-1"
          >
            login
          </Link>
          <button
            type="button"
            onClick={() => setShowWaitlist(true)}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px] inline-flex items-center justify-center -ml-1"
          >
            waitlist
          </button>
        </div>
      </header>

      <div className="page-domino">
        <div className="hero-domino" style={{ marginTop: 40 }}>
          <h1 className="headline-domino font-black">
            you save things you never revisit.
            <em>domino turns everything you capture into something that actually compounds.</em>
          </h1>
        </div>

        <div className="grid-domino" id="grid" ref={gridRef}>
          <DominoTile top={3} bottom={5} />
          <div className="cell cream text-cell">
            <span className="cell-label">step 01</span>
            <span className="cell-text">share any link, thought, or screenshot — wherever you are.</span>
          </div>
          <DominoTile top={6} bottom={2} />
          <div className="cell white text-cell">
            <span className="cell-label">step 02</span>
            <span className="cell-text">we index it and extract the core ideas.</span>
          </div>

          <div className="cell white text-cell">
            <span className="cell-label">step 03</span>
            <span className="cell-text">get a weekly digest of your own brilliance.</span>
          </div>
          <DominoTile top={4} bottom={4} />
          <div className="cell cream text-cell">
            <span className="cell-label">step 04</span>
            <span className="cell-text">see connections between separate notes.</span>
          </div>
          <DominoTile top={1} bottom={6} />

          <div className="cell orange">
            <div className="phone-cell" style={{ pointerEvents: 'none' }}>
              <span className="phone-num" style={{ filter: 'blur(6px)', userSelect: 'none' }}>{DISPLAY_NUMBER}</span>
              <span className="phone-sub">start on whatsapp → more ways coming</span>
            </div>
          </div>
          <div className="cell black text-cell" style={{ gridColumn: 'span 2' }}>
            <span className="cell-label">the domino effect</span>
            <span className="cell-text">
              domino builds a taste profile from everything you capture and feeds it back as recommendations.
            </span>
          </div>
        </div>

      </div>

      <footer className="shrink-0 flex flex-col gap-2 px-4 py-3 border-t border-border/50 md:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">© 2026 daily labs</span>
          <div className="flex items-center gap-4">
            <Link href="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">faq</Link>
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">privacy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">terms</Link>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showWaitlist && (
          <WaitlistModal key="waitlist" onClose={() => setShowWaitlist(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
