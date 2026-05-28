'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { dominoApi, type DominoItem } from '@/features/domino/domino-api';
import { ArrowLeft, Search } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: { id: string; summary: string; created_at: string | null }[];
}

// ── Demo seed data (shown when user has fewer than 5 items) ───────────────────

const DEMO_ITEMS: DominoItem[] = [
  { id: 'd1',  topic: 'ambient computing',    summary: 'Mark Weiser\'s vision: computers woven invisibly into everyday life',          raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd2',  topic: 'ambient computing',    summary: 'Calm technology principles — devices that inform without demanding attention',   raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd3',  topic: 'ambient computing',    summary: 'How ambient displays change peripheral awareness in smart offices',              raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd4',  topic: 'IoT sensors',          summary: 'Thread protocol and the new generation of low-power mesh networks',              raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd5',  topic: 'IoT sensors',          summary: 'Sensor fusion: combining accelerometer, gyro, and barometer data',               raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd6',  topic: 'wearables',            summary: 'Apple Watch health API and passive data collection without user friction',       raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd7',  topic: 'wearables',            summary: 'Oura ring vs Whoop: continuous health monitoring compared',                      raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd8',  topic: 'smart home',           summary: 'Matter standard finally unifies Apple, Google, and Amazon ecosystems',           raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd9',  topic: 'smart home',           summary: 'Occupancy detection without cameras: radar and thermal sensors',                 raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd10', topic: 'edge computing',       summary: 'Running LLMs on device: Apple Neural Engine vs Snapdragon NPU benchmarks',      raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd11', topic: 'edge computing',       summary: 'WebAssembly at the edge: serverless functions that run on any hardware',         raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd12', topic: 'spatial computing',    summary: 'Apple Vision Pro developer notes: visionOS windowing and eye tracking',          raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd13', topic: 'spatial computing',    summary: 'Hand-tracking without controllers: lessons from Meta Quest 3',                   raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd14', topic: 'HCI research',         summary: 'Tangible bits: Hiroshi Ishii\'s work on physical-digital interfaces at MIT',    raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd15', topic: 'HCI research',         summary: 'Fitts\'s law in 2024: touch targets on foldables and curved displays',          raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd16', topic: 'context-aware AI',     summary: 'On-device intent prediction using location, time, and activity patterns',       raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd17', topic: 'context-aware AI',     summary: 'Proactive notifications done right: the design of Google Now',                  raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd18', topic: 'pervasive computing',  summary: 'Ubicomp 2024 conference highlights: presence, privacy, and infrastructure',     raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd19', topic: 'pervasive computing',  summary: 'The disappearing interface: when software becomes invisible infrastructure',     raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd20', topic: 'privacy & sensing',    summary: 'Differential privacy in ambient sensing: what Google and Apple are doing',      raw_input: '', input_type: 'link', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
  { id: 'd21', topic: 'privacy & sensing',    summary: 'The ethics of always-on microphones: Alexa, Siri, and consent frameworks',      raw_input: '', input_type: 'note', extracted_text: null, key_ideas: [], created_at: null, digest_sent: false, is_pinned: false, is_favorited: false },
];

// ── Map constants ──────────────────────────────────────────────────────────────

const TOPIC_COLORS = ['#ED4715', '#B169B7', '#80A2C7', '#D326BF', '#5DBE7A', '#E6A817', '#6B8CFF'];
const VIEW_W = 420;
const NODE_SPACING = 52;
const TOP_PAD = 18;
const CN_X = 28;
const CN_W = 96;
const CN_H = 48;
const BRANCH_X = CN_X + CN_W;
const DOT_X = 230;
const TEXT_X = DOT_X + 11;

function wrapLabel(text: string): [string, string | null] {
  if (text.length <= 22) return [text, null];
  const words = text.split(' ');
  if (words.length === 1) return [text.slice(0, 22) + '…', null];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(
      words.slice(0, i).join(' ').length - words.slice(i).join(' ').length,
    );
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

// ── Topic map (root view) ──────────────────────────────────────────────────────

interface TopicNode {
  topic: string;
  count: number;
  color: string;
}

function TopicMap({
  nodes,
  onSelect,
}: {
  nodes: TopicNode[];
  onSelect: (topic: string) => void;
}) {
  const N = nodes.length;
  const TOTAL_H = TOP_PAD * 2 + N * NODE_SPACING;
  const CENTER_Y = TOTAL_H / 2;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${TOTAL_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full max-w-md"
      style={{ height: Math.min(TOTAL_H, 480) }}
      aria-label="your topics"
    >
      {/* Branch curves */}
      {nodes.map((node, i) => {
        const y = TOP_PAD + NODE_SPACING * i + NODE_SPACING / 2;
        const d = `M ${BRANCH_X} ${CENTER_Y} C ${BRANCH_X + 90} ${CENTER_Y} ${DOT_X - 40} ${y} ${DOT_X} ${y}`;
        return (
          <motion.path
            key={`path-${node.topic}`}
            d={d}
            fill="none"
            stroke={node.color}
            strokeWidth={2}
            strokeOpacity={0.35}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.06 + i * 0.04, duration: 0.45, ease: 'easeOut' }}
          />
        );
      })}

      {/* Center node */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{ transformOrigin: `${CN_X + CN_W / 2}px ${CENTER_Y}px` }}
      >
        <rect
          x={CN_X - 5} y={CENTER_Y - CN_H / 2 - 5}
          width={CN_W + 10} height={CN_H + 10}
          rx={17} fill="#ED4715" fillOpacity={0.1}
          stroke="#ED4715" strokeWidth={1} strokeOpacity={0.25}
        />
        <rect
          x={CN_X} y={CENTER_Y - CN_H / 2}
          width={CN_W} height={CN_H}
          rx={12} fill="#ED4715"
        />
        <text
          x={CN_X + CN_W / 2} y={CENTER_Y - 6}
          textAnchor="middle" fill="white"
          fontSize={11} fontWeight="800"
          fontFamily="Figtree, system-ui, sans-serif"
        >my</text>
        <text
          x={CN_X + CN_W / 2} y={CENTER_Y + 9}
          textAnchor="middle" fill="white"
          fontSize={11} fontWeight="800"
          fontFamily="Figtree, system-ui, sans-serif"
        >notes</text>
      </motion.g>

      {/* Topic nodes */}
      {nodes.map((node, i) => {
        const y = TOP_PAD + NODE_SPACING * i + NODE_SPACING / 2;
        const [line1, line2] = wrapLabel(node.topic);
        const textY1 = line2 ? y - 4 : y + 5;

        return (
          <motion.g
            key={node.topic}
            onClick={() => onSelect(node.topic)}
            role="button"
            aria-label={`${node.topic}, ${node.count} items`}
            style={{ cursor: 'pointer' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }}
          >
            <rect
              x={DOT_X - 6} y={y - NODE_SPACING / 2}
              width={VIEW_W - DOT_X + 6} height={NODE_SPACING}
              fill="transparent"
            />
            <circle cx={DOT_X} cy={y} r={4} fill={node.color} fillOpacity={0.7} />
            <text
              x={TEXT_X} y={textY1}
              fontSize={13} fontWeight="600"
              fill="currentColor" opacity={0.85}
              fontFamily="Figtree, system-ui, sans-serif"
            >{line1}</text>
            {line2 && (
              <text
                x={TEXT_X} y={y + 12}
                fontSize={12} fontWeight="500"
                fill="currentColor" opacity={0.7}
                fontFamily="Figtree, system-ui, sans-serif"
              >{line2}</text>
            )}
            <text
              x={VIEW_W - 8} y={y + 5}
              fontSize={10} fontWeight="500"
              textAnchor="end"
              fill={node.color} opacity={0.6}
              fontFamily="Figtree, system-ui, sans-serif"
            >{node.count}</text>
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Item map (zoomed view) ─────────────────────────────────────────────────────

interface ItemNode {
  item: DominoItem;
  label: string;
  color: string;
}

function ItemMap({
  topic,
  nodes,
  topicColor,
  onBack,
  onItemTap,
}: {
  topic: string;
  nodes: ItemNode[];
  topicColor: string;
  onBack: () => void;
  onItemTap: (item: DominoItem) => void;
}) {
  const N = Math.max(nodes.length, 1);
  const TOTAL_H = TOP_PAD * 2 + N * NODE_SPACING;
  const CENTER_Y = TOTAL_H / 2;

  const [topLine, bottomLine] = wrapLabel(topic);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${TOTAL_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full max-w-md"
      style={{ height: Math.min(TOTAL_H, 480) }}
      aria-label={`items in ${topic}`}
    >
      {/* Branch curves */}
      {nodes.map((node, i) => {
        const y = TOP_PAD + NODE_SPACING * i + NODE_SPACING / 2;
        const d = `M ${BRANCH_X} ${CENTER_Y} C ${BRANCH_X + 90} ${CENTER_Y} ${DOT_X - 40} ${y} ${DOT_X} ${y}`;
        return (
          <motion.path
            key={`path-${node.item.id}`}
            d={d}
            fill="none"
            stroke={topicColor}
            strokeWidth={1.5}
            strokeOpacity={0.3}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.05 + i * 0.04, duration: 0.4, ease: 'easeOut' }}
          />
        );
      })}

      {/* Center node (topic) */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{ transformOrigin: `${CN_X + CN_W / 2}px ${CENTER_Y}px`, cursor: 'pointer' }}
        onClick={onBack}
        role="button"
        aria-label="back to topics"
      >
        <rect
          x={CN_X - 5} y={CENTER_Y - CN_H / 2 - 5}
          width={CN_W + 10} height={CN_H + 10}
          rx={17} fill={topicColor} fillOpacity={0.1}
          stroke={topicColor} strokeWidth={1} strokeOpacity={0.3}
        />
        <rect
          x={CN_X} y={CENTER_Y - CN_H / 2}
          width={CN_W} height={CN_H}
          rx={12} fill={topicColor}
        />
        {bottomLine ? (
          <>
            <text
              x={CN_X + CN_W / 2} y={CENTER_Y - 6}
              textAnchor="middle" fill="white"
              fontSize={10} fontWeight="800"
              fontFamily="Figtree, system-ui, sans-serif"
            >{topLine}</text>
            <text
              x={CN_X + CN_W / 2} y={CENTER_Y + 8}
              textAnchor="middle" fill="white"
              fontSize={10} fontWeight="800"
              fontFamily="Figtree, system-ui, sans-serif"
            >{bottomLine}</text>
          </>
        ) : (
          <text
            x={CN_X + CN_W / 2} y={CENTER_Y + 5}
            textAnchor="middle" fill="white"
            fontSize={11} fontWeight="800"
            fontFamily="Figtree, system-ui, sans-serif"
          >{topLine}</text>
        )}
      </motion.g>

      {/* Item nodes */}
      {nodes.map((node, i) => {
        const y = TOP_PAD + NODE_SPACING * i + NODE_SPACING / 2;
        const [l1, l2] = wrapLabel(node.label);
        const textY1 = l2 ? y - 4 : y + 5;

        return (
          <motion.g
            key={node.item.id}
            onClick={() => onItemTap(node.item)}
            role="button"
            aria-label={node.label}
            style={{ cursor: 'pointer' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.04, duration: 0.3 }}
          >
            <rect
              x={DOT_X - 6} y={y - NODE_SPACING / 2}
              width={VIEW_W - DOT_X + 6} height={NODE_SPACING}
              fill="transparent"
            />
            <circle cx={DOT_X} cy={y} r={3} fill={topicColor} fillOpacity={0.6} />
            <text
              x={TEXT_X} y={textY1}
              fontSize={12} fontWeight="500"
              fill="currentColor" opacity={0.8}
              fontFamily="Figtree, system-ui, sans-serif"
            >{l1}</text>
            {l2 && (
              <text
                x={TEXT_X} y={y + 12}
                fontSize={11} fontWeight="400"
                fill="currentColor" opacity={0.6}
                fontFamily="Figtree, system-ui, sans-serif"
              >{l2}</text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Main content ───────────────────────────────────────────────────────────────

function MapContent() {
  const { sessionToken } = useDominoAuth();
  const [items, setItems] = useState<DominoItem[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load items — fall back to demo data when user has fewer than 5 saved items
  useEffect(() => {
    if (!sessionToken) return;
    dominoApi.getItems(sessionToken, 200, 0)
      .then((data) => setItems(data.length >= 5 ? data : DEMO_ITEMS))
      .catch(() => setItems(DEMO_ITEMS));
  }, [sessionToken]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build topic nodes (all, for stable color assignment)
  const allTopicNodes: TopicNode[] = (() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.topic) counts[item.topic] = (counts[item.topic] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count], i) => ({
        topic,
        count,
        color: TOPIC_COLORS[i % TOPIC_COLORS.length],
      }));
  })();

  // Filter by search query (topics view only)
  const q = search.trim().toLowerCase();
  const topicNodes = q
    ? allTopicNodes.filter((n) => n.topic.toLowerCase().includes(q))
    : allTopicNodes;

  const selectedTopicNode = allTopicNodes.find((n) => n.topic === selectedTopic);

  // Build item nodes for selected topic
  const itemNodes: ItemNode[] = selectedTopic
    ? items
        .filter((it) => it.topic === selectedTopic)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .map((item) => ({
          item,
          label: (item.summary ?? item.extracted_text ?? item.raw_input).slice(0, 40),
          color: selectedTopicNode?.color ?? '#80A2C7',
        }))
    : [];

  // Handle item tap → pre-fill search bar
  function handleItemTap(item: DominoItem) {
    const label = item.summary ?? item.extracted_text ?? item.raw_input;
    setSearch(`Tell me about: "${label.slice(0, 80)}"`);
    inputRef.current?.focus();
  }

  // Chat send
  async function handleSend() {
    if (!search.trim() || !sessionToken || loading) return;
    const userMessage = search.trim();
    setSearch('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);
    try {
      const res = await dominoApi.chat(sessionToken, userMessage);
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <DominoAppShell>

      {/* ── Map area — fills all available space ── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden pb-16">
        {/* Back button */}
        <AnimatePresence>
          {selectedTopic && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedTopic(null)}
              className="absolute top-4 left-4 z-10 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
            >
              <ArrowLeft className="size-3.5" />
              all topics
            </motion.button>
          )}
        </AnimatePresence>

        {topicNodes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center px-8 py-20">
            save content via WhatsApp and your topics will appear here.
          </p>
        ) : (
          <AnimatePresence mode="wait">
            {selectedTopic ? (
              <motion.div
                key={`items-${selectedTopic}`}
                className="flex items-center justify-center w-full px-2 py-4"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
              >
                <ItemMap
                  topic={selectedTopic}
                  nodes={itemNodes}
                  topicColor={selectedTopicNode?.color ?? '#80A2C7'}
                  onBack={() => setSelectedTopic(null)}
                  onItemTap={handleItemTap}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`topics-${q}`}
                className="flex items-center justify-center w-full px-2 py-4"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
              >
                <TopicMap nodes={topicNodes} onSelect={(t) => { setSelectedTopic(t); setSearch(''); }} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ── Chat messages + search bar — fixed above nav ── */}
      <div
        className="fixed left-0 right-0 z-10 bottom-14"
      >
        {/* Messages */}
        <AnimatePresence>
          {hasMessages && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-sm"
            >
              <div className="max-h-36 overflow-y-auto px-4 py-2 space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm border border-border bg-card text-foreground'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-1 animate-bounce rounded-full bg-muted-foreground/50"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search bar */}
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 py-3">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="search or ask your domino…"
              className="min-h-[44px] w-full touch-manipulation rounded-full border border-border bg-card pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="absolute right-3 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-80 disabled:opacity-40 touch-manipulation"
                aria-label="Send"
              >
                {loading
                  ? <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  : <Search className="size-3" />
                }
              </button>
            )}
          </div>
        </div>
      </div>

    </DominoAppShell>
  );
}

export default function DominoMapPage() {
  return (
    <DominoProtectedRoute>
      <MapContent />
    </DominoProtectedRoute>
  );
}
