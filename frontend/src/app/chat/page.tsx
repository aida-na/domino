'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { dominoApi, type ChatSource } from '@/features/domino/domino-api';
import { IcLink } from '@/features/domino/domino-icons';
import posthog from 'posthog-js';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
}

function isLinkSource(source: ChatSource): boolean {
  const type = source.input_type ?? 'note';
  return (type === 'link' || type === 'pdf') && /^https?:\/\//i.test(source.raw_input ?? '');
}

function sourceLabel(source: ChatSource): string {
  return (source.summary || source.raw_input || 'saved item').slice(0, 80);
}

function SourceCards({
  sources,
  onNoteTap,
}: {
  sources: ChatSource[];
  onNoteTap?: (source: ChatSource) => void;
}) {
  if (!sources.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {sources.map((source) => {
        const label = sourceLabel(source);
        const isLink = isLinkSource(source);
        if (isLink) {
          return (
            <a
              key={source.id}
              href={source.raw_input}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 rounded-xl border border-border/70 bg-background/80 px-2.5 py-2 text-[11px] leading-snug text-foreground transition-colors hover:bg-muted/40"
            >
              <span className="mt-0.5 shrink-0 text-primary"><IcLink size={12} /></span>
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                {source.topic && <span className="block text-muted-foreground">{source.topic}</span>}
              </span>
            </a>
          );
        }
        return (
          <button
            key={source.id}
            type="button"
            onClick={() => onNoteTap?.(source)}
            className="flex w-full items-start gap-2 rounded-xl border border-border/70 bg-background/80 px-2.5 py-2 text-left text-[11px] leading-snug text-foreground transition-colors hover:bg-muted/40"
          >
            <span className="mt-0.5 shrink-0 opacity-70">📝</span>
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              {source.topic && <span className="block text-muted-foreground">{source.topic}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
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

  return (
    <DominoAppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border/50 px-4 py-3">
          <h1 className="dn-wordmark text-xl">ask</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              search or ask anything about what you&apos;ve saved via iMessage.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${msg.role === 'assistant' ? 'w-full' : ''}`}>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm border border-border bg-card text-foreground'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <SourceCards sources={msg.sources} onNoteTap={handleSourceTap} />
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border/50 bg-background px-4 py-3">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="search or ask your domino…"
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-80 disabled:opacity-40 touch-manipulation"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
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
