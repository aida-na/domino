'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { dominoApi, type ChatSource } from '@/features/domino/domino-api';
import { IcArrowUp, IcChevron, IcNote, IcLink } from '@/features/domino/domino-icons';
import posthog from 'posthog-js';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
}

const STARTERS = [
  'what did i save this week?',
  'summarize what i’ve been reading',
  'what are my recurring themes?',
];

function isLinkSource(source: ChatSource): boolean {
  const type = source.input_type ?? 'note';
  return (type === 'link' || type === 'pdf') && /^https?:\/\//i.test(source.raw_input ?? '');
}

function sourceLabel(source: ChatSource): string {
  return (source.summary || source.raw_input || 'saved item').slice(0, 80);
}

function domainOf(source: ChatSource): string | null {
  try {
    return new URL(source.raw_input ?? '').hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function Dots({ size = 7, tones }: { size?: number; tones: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: size < 9 ? 3 : 6, alignItems: 'center' }}>
      {tones.map((tone, i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: 9999, background: tone, flexShrink: 0 }} />
      ))}
    </span>
  );
}

function SourceCard({ source, onNoteTap }: { source: ChatSource; onNoteTap?: (s: ChatSource) => void }) {
  const isLink = isLinkSource(source);
  const domain = domainOf(source);

  const inner = (
    <>
      <span
        style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'var(--card-o)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--domino-accent)',
        }}
      >
        {isLink ? <IcLink size={19} /> : <IcNote size={19} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)' }}>
          {sourceLabel(source)}
        </span>
        {(domain || source.topic) && (
          <span style={{ fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)' }}>
            {[domain, source.topic].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      <span style={{ color: 'var(--ink-4)', flexShrink: 0, marginTop: 4 }}><IcChevron size={12} /></span>
    </>
  );

  const style: React.CSSProperties = {
    display: 'flex', gap: 14, width: '100%', textAlign: 'left',
    background: 'var(--paper)', border: '1px solid var(--dn-card-border)',
    borderRadius: 20, padding: 16,
    boxShadow: 'var(--dn-card-shadow)',
    color: 'inherit', textDecoration: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  };

  if (isLink) {
    return <a href={source.raw_input} target="_blank" rel="noreferrer" style={style}>{inner}</a>;
  }
  return <button type="button" onClick={() => onNoteTap?.(source)} style={style}>{inner}</button>;
}

function AskContent() {
  const { sessionToken } = useDominoAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleSourceTap(source: ChatSource) {
    setInput(`Tell me about: "${sourceLabel(source).slice(0, 80)}"`);
    inputRef.current?.focus();
  }

  async function handleSend() {
    if (!input.trim() || !sessionToken || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);
    try {
      const res = await dominoApi.chat(sessionToken, userMessage);
      posthog.capture('chat_question_sent');
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer, sources: res.sources }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: err instanceof Error ? err.message : 'Something went wrong.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const isEmpty = messages.length === 0 && !loading;

  return (
    <DominoAppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        {isEmpty ? (
          <div
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              gap: 22, padding: '0 22px',
            }}
          >
            <Dots size={11} tones={['var(--domino-accent)', 'var(--card-o)', 'var(--hairline)']} />
            <h1
              className="dn-wordmark"
              style={{ fontSize: 34, lineHeight: 1.1, margin: 0, textWrap: 'pretty' }}
            >
              ask for anything<br />you’ve ever saved.
            </h1>
            <p
              style={{
                fontSize: 'var(--dn-text-base)', lineHeight: 1.55, color: 'var(--ink-3)',
                margin: 0, maxWidth: 290, textWrap: 'pretty',
              }}
            >
              domino remembers every link and half-thought you sent it. try one of these:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => { setInput(starter); inputRef.current?.focus(); }}
                  style={{
                    background: 'var(--paper)', border: '1px solid var(--hairline-soft)',
                    borderRadius: 9999, padding: '12px 20px',
                    fontSize: 'var(--dn-text-sm)', color: 'var(--ink-2)',
                    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px 8px' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 20,
              minHeight: '100%', justifyContent: 'flex-end',
            }}>
              {messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <div
                    key={i}
                    style={{
                      alignSelf: 'flex-end', maxWidth: '78%',
                      background: 'var(--domino-accent)', color: 'white',
                      fontSize: 'var(--dn-text-base)', lineHeight: 1.4,
                      padding: '13px 20px', borderRadius: '22px 22px 6px 22px',
                    }}
                  >
                    {msg.text}
                  </div>
                ) : (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Dots tones={['var(--domino-accent)', 'var(--card-o)']} />
                        <span
                          style={{
                            fontSize: 'var(--dn-text-xs)', letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 600,
                          }}
                        >
                          {msg.sources.length} {msg.sources.length === 1 ? 'match' : 'matches'}
                        </span>
                      </div>
                    )}
                    <p
                      style={{
                        fontSize: 'var(--dn-text-md)', lineHeight: 1.5, margin: 0,
                        color: 'var(--ink)', maxWidth: '92%', textWrap: 'pretty',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.text}
                    </p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {msg.sources.map((source) => (
                          <SourceCard key={source.id} source={source} onNoteTap={handleSourceTap} />
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="animate-bounce"
                      style={{
                        width: 7, height: 7, borderRadius: 9999,
                        background: i === 0 ? 'var(--domino-accent)' : 'var(--card-o)',
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <div style={{ flexShrink: 0, padding: '8px 22px 12px' }}>
          <div
            style={{
              display: 'flex', alignItems: 'flex-end', gap: 10,
              background: 'var(--paper)', border: '1px solid var(--hairline-soft)',
              borderRadius: 26, padding: '6px 6px 6px 20px',
              boxShadow: '0 2px 10px oklch(0 0 0 / 0.04)',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isEmpty ? 'search or ask your domino…' : 'ask a follow-up…'}
              style={{
                flex: 1, resize: 'none', border: 0, outline: 'none', background: 'transparent',
                fontFamily: 'inherit', fontSize: 'var(--dn-text-base)', color: 'var(--ink)',
                lineHeight: 1.4, padding: '11px 0', maxHeight: 112, minHeight: 22,
              }}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              aria-label="Send"
              style={{
                width: 38, height: 38, borderRadius: 9999, flexShrink: 0, border: 0,
                background: input.trim() ? 'var(--domino-accent)' : 'var(--bg-deep)',
                color: input.trim() ? 'white' : 'var(--ink-4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                opacity: loading ? 0.5 : 1,
                transition: 'background 160ms ease, color 160ms ease',
              }}
            >
              <IcArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </DominoAppShell>
  );
}

export default function AskPage() {
  return (
    <DominoProtectedRoute>
      <AskContent />
    </DominoProtectedRoute>
  );
}
