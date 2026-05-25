import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { streamChat } from '../services/api';

const SUGGESTIONS = [
  'Why is petrol so expensive in Thailand?',
  'Why has my grocery bill gone up so much?',
  'Why is the Egyptian pound collapsing?',
  'Why are shipping costs still so high?',
  'Why is wheat flour expensive in Africa?',
  'Why is gold hitting record highs?',
];

/* ── Humanoid avatar SVG ───────────────────────────────────────────── */
function HumanoidAvatar({ pulse }) {
  return (
    <div className="relative w-14 h-14">
      {/* Outer glow ring — pulses when idle */}
      {pulse && (
        <span className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping pointer-events-none" />
      )}
      {/* Avatar circle */}
      <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-900 border-2 border-blue-400 shadow-lg shadow-blue-600/50 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 48 52" fill="none" className="w-10 h-10" aria-hidden>
          {/* Head */}
          <circle cx="24" cy="15" r="9" fill="#bfdbfe" />
          {/* Hair */}
          <path d="M15 12 Q16 4 24 5 Q32 4 33 12 Q28 8 24 8 Q20 8 15 12Z" fill="#1e40af" />
          {/* Left eye */}
          <ellipse cx="20.5" cy="14" rx="1.5" ry="1.8" fill="#1e3a8a" />
          {/* Right eye */}
          <ellipse cx="27.5" cy="14" rx="1.5" ry="1.8" fill="#1e3a8a" />
          {/* Eye shine */}
          <circle cx="21.2" cy="13.2" r="0.5" fill="white" />
          <circle cx="28.2" cy="13.2" r="0.5" fill="white" />
          {/* Smile */}
          <path d="M20 18 Q24 21.5 28 18" stroke="#1e3a8a" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          {/* Neck */}
          <rect x="21.5" y="23" width="5" height="4" rx="1" fill="#bfdbfe" />
          {/* Collar / shirt */}
          <path d="M10 52 Q10 34 24 30 Q38 34 38 52Z" fill="#3b82f6" />
          {/* Collar v-neck */}
          <path d="M24 30 L20 38 L24 36 L28 38 Z" fill="#1d4ed8" />
        </svg>
      </div>
      {/* Online status dot */}
      <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#0f1117] shadow" />
    </div>
  );
}

/* ── Floating chat window ─────────────────────────────────────────── */
function ChatWindow({ onClose, sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0 });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    dragOrigin.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    setPos({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y });
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  const send = (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;

    const userMsg = { role: 'user', content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    let accumulated = '';
    streamChat(
      nextMessages,
      (chunk) => { accumulated += chunk; setStreamingText(accumulated); },
      () => {
        setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
        setStreamingText('');
        setStreaming(false);
        inputRef.current?.focus();
      },
      (err) => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${err}`,
          isError: true,
        }]);
        setStreamingText('');
        setStreaming(false);
      },
      sessionId,
    );
  };

  const exchangeCount = messages.filter(m => m.role === 'assistant').length;

  return (
    <div
      className="fixed flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-blue-800/60 bg-card"
      style={{
        zIndex: 100000,
        width: 360,
        height: 540,
        bottom: 88,
        right: 24,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
      }}
    >
      {/* Header / drag handle */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-900 to-indigo-900 border-b border-blue-800 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 28 30" fill="none" className="w-5 h-5" aria-hidden>
            <circle cx="14" cy="8" r="5.5" fill="#bfdbfe" />
            <path d="M5 30 Q5 19 14 17 Q23 19 23 30Z" fill="#60a5fa" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white leading-none">GCMI Intelligence</div>
          <div className="text-[10px] text-blue-300 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
            Online · Geopolitical AI
          </div>
        </div>
        {messages.length > 0 && !streaming && (
          <button
            onClick={() => { setMessages([]); setStreamingText(''); }}
            onPointerDown={e => e.stopPropagation()}
            className="text-[10px] text-blue-400 hover:text-blue-200 transition-colors px-1"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
          className="text-blue-400 hover:text-white transition-colors text-lg leading-none ml-1"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <EmptyState onSuggest={send} />
        )}

        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}

        {streaming && (
          <div className="flex gap-2 items-start">
            <MiniAvatar />
            <div className="flex-1 bg-surface border border-border rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[85%]">
              {streamingText
                ? <FormattedMessage text={streamingText} streaming />
                : <ThinkingDots />
              }
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick action */}
      {exchangeCount >= 2 && !streaming && (
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => send('Please give me the full intelligence summary with three scenarios.')}
            className="w-full py-1.5 text-xs font-medium bg-amber-950 border border-amber-700 text-amber-300 rounded-lg hover:bg-amber-900 transition-colors"
          >
            Generate 3-Scenario Summary →
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="e.g. Why is petrol so expensive in Thailand?"
            rows={2}
            disabled={streaming}
            className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none leading-snug disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            className="p-2.5 bg-blue-600 rounded-xl text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-gray-700 mt-1 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <MiniAvatar />}
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : msg.isError
            ? 'bg-red-950 border border-red-800 text-red-300 rounded-tl-sm'
            : 'bg-surface border border-border text-gray-200 rounded-tl-sm'
      }`}>
        {isUser ? <p>{msg.content}</p> : <FormattedMessage text={msg.content} />}
      </div>
    </div>
  );
}

function MiniAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 border border-blue-500 flex items-center justify-center shrink-0 mt-0.5">
      <svg viewBox="0 0 28 30" fill="none" className="w-4 h-4" aria-hidden>
        <circle cx="14" cy="8" r="5.5" fill="#bfdbfe" />
        <path d="M5 30 Q5 19 14 17 Q23 19 23 30Z" fill="#60a5fa" />
      </svg>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-blue-400"
          style={{ animation: `pulse 1.2s ease-in-out ${i * 0.22}s infinite` }} />
      ))}
    </div>
  );
}

function EmptyState({ onSuggest }) {
  return (
    <div className="py-3">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-300 font-semibold">Ask about any economic problem</p>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
          I'll connect it to global conflicts and walk you through the causal chain
        </p>
      </div>
      <p className="text-[10px] text-gray-600 uppercase tracking-wider px-1 mb-2">Try asking</p>
      <div className="space-y-1.5">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left text-xs text-gray-400 bg-surface hover:bg-gray-800 border border-border rounded-lg px-3 py-2 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormattedMessage({ text, streaming }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line === '---') return <hr key={i} className="border-border my-2" />;
        if (line.startsWith('## '))
          return <h2 key={i} className="text-blue-400 font-bold text-sm mt-3 mb-1 border-b border-border pb-1">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) {
          const m = line.match(/^### (.+?)\s*\|\s*Probability:\s*~?(\d+)%/);
          if (m) return <ScenarioHeader key={i} title={m[1]} probability={parseInt(m[2])} />;
          return <h3 key={i} className="text-blue-300 font-semibold text-sm mt-2 mb-0.5">{line.slice(4)}</h3>;
        }
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4)
          return <p key={i} className="text-amber-400 font-semibold text-sm">{line.slice(2, -2)}</p>;
        if (line.startsWith('- ') || line.startsWith('• '))
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-gray-600 shrink-0 mt-0.5">·</span>
              <span dangerouslySetInnerHTML={{ __html: fmtInline(line.slice(2)) }} />
            </div>
          );
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fmtInline(line) }} />;
      })}
      {streaming && <span className="pulse-dot" />}
    </div>
  );
}

function ScenarioHeader({ title, probability }) {
  const color = probability >= 50
    ? 'border-red-700 bg-red-950 text-red-300'
    : probability >= 25
      ? 'border-amber-700 bg-amber-950 text-amber-300'
      : 'border-green-800 bg-green-950 text-green-300';
  const bar = probability >= 50 ? 'bg-red-500' : probability >= 25 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className={`mt-3 mb-1 rounded-lg border px-3 py-2 ${color}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm">{title}</span>
        <span className="text-xs font-bold">~{probability}%</span>
      </div>
      <div className="h-1 bg-black/30 rounded overflow-hidden">
        <div className={`h-full rounded ${bar}`} style={{ width: `${probability}%` }} />
      </div>
    </div>
  );
}

function fmtInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-200">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded text-xs text-green-300">$1</code>');
}

/* ── Main export ──────────────────────────────────────────────────── */
export default function FloatingChat({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  const handleToggle = () => {
    setOpen(o => !o);
    setUnread(false);
  };

  return createPortal(
    <>
      {/* Chat window */}
      {open && (
        <ChatWindow
          onClose={() => setOpen(false)}
          sessionId={sessionId}
        />
      )}

      {/* Floating avatar button */}
      <button
        onClick={handleToggle}
        className="fixed bottom-6 right-6 focus:outline-none group"
        style={{ zIndex: 100001 }}
        aria-label="Open geopolitical intelligence chat"
        title="Geopolitical Intelligence Chat"
      >
        <HumanoidAvatar pulse={!open} />

        {/* Unread badge */}
        {unread && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold shadow">
            1
          </span>
        )}

        {/* Tooltip */}
        <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap text-[11px] bg-gray-900 text-white px-2.5 py-1 rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          {open ? 'Close chat' : 'Ask GCMI Intelligence'}
        </span>
      </button>
    </>,
    document.body
  );
}
