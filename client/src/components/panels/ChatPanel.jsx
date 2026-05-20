import { useState, useRef, useEffect } from 'react';
import { streamChat } from '../../services/api';

const SUGGESTIONS = [
  'Why is petrol so expensive in Thailand?',
  'Why has my grocery bill gone up so much?',
  'Why is the Egyptian pound collapsing?',
  'Why are shipping costs still so high?',
  'Why is wheat flour expensive in Africa?',
  'Why is gold hitting record highs?',
];

export default function ChatPanel({ sessionId, portfolio, conversationCount, onSetupPortfolio }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const hasPortfolio = portfolio?.assets?.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

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
          content: `Error: ${err}. Check that DEEPSEEK_API_KEY is set in server/.env.`,
          isError: true,
        }]);
        setStreamingText('');
        setStreaming(false);
      },
      sessionId,
    );
  };

  const reset = () => {
    if (streaming) return;
    setMessages([]);
    setStreamingText('');
    setInput('');
  };

  const exchangeCount = messages.filter(m => m.role === 'assistant').length;
  const showSummaryBtn = exchangeCount >= 2 && !streaming;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Geopolitical Intelligence Chat</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasPortfolio
                ? `Personalized for your ${portfolio.assets.length}-asset portfolio`
                : 'Describe any problem — get conflict context + scenarios'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={reset} disabled={streaming} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Portfolio memory indicator */}
        {hasPortfolio && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-800 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-blue-400">💼</span>
              <span className="text-[10px] text-blue-300 font-medium">
                {portfolio.assets.slice(0, 3).map(a => a.symbol).join(', ')}
                {portfolio.assets.length > 3 ? ` +${portfolio.assets.length - 3} more` : ''}
              </span>
            </div>
            {conversationCount > 0 && (
              <span className="text-[10px] text-gray-600">
                📝 {conversationCount} previous conversation{conversationCount !== 1 ? 's' : ''} remembered
              </span>
            )}
          </div>
        )}

        {/* Setup prompt if no portfolio */}
        {!hasPortfolio && onSetupPortfolio && (
          <button
            onClick={onSetupPortfolio}
            className="mt-2 w-full text-left text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/20 border border-blue-900 rounded-lg px-3 py-2 transition-colors"
          >
            💼 Set up your portfolio for personalized analysis →
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <EmptyState onSuggest={send} hasPortfolio={hasPortfolio} portfolio={portfolio} />
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* Streaming bubble */}
        {streaming && (
          <div className="flex gap-2 items-start">
            <BotAvatar hasPortfolio={hasPortfolio} />
            <div className="flex-1 bg-surface border border-border rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[88%]">
              {streamingText
                ? <FormattedMessage text={streamingText} streaming />
                : <ThinkingState hasPortfolio={hasPortfolio} />
              }
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick reply — portfolio context */}
      {exchangeCount >= 1 && !streaming && hasPortfolio && (
        <div className="px-3 pb-1 shrink-0">
          <button
            onClick={() => send('How does this specifically affect my portfolio positions?')}
            className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/20 border border-blue-800 rounded-lg px-3 py-1.5 transition-colors"
          >
            💼 How does this affect my portfolio? →
          </button>
        </div>
      )}

      {/* Summary button */}
      {showSummaryBtn && (
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => send('Please give me the full intelligence summary now with the three scenarios.')}
            className="w-full py-2 text-xs font-medium bg-amber-950 border border-amber-700 text-amber-300 rounded-lg hover:bg-amber-900 transition-colors"
          >
            Generate 3-Scenario Summary →
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 shrink-0 border-t border-border pt-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={hasPortfolio ? 'Ask about any conflict, market, or risk…' : 'e.g. Why is petrol so expensive in Thailand?'}
            rows={2}
            disabled={streaming}
            className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none leading-snug disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            className="p-2.5 bg-blue-600 rounded-xl text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <SendIcon />
          </button>
        </div>
        <div className="text-[10px] text-gray-700 mt-1 text-center">Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <BotAvatar />}
      <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
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

function FormattedMessage({ text, streaming }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line === '---') return <hr key={i} className="border-border my-2" />;
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-blue-400 font-bold text-sm mt-3 mb-1 border-b border-border pb-1">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          const m = line.match(/^### (.+?)\s*\|\s*Probability:\s*~?(\d+)%/);
          if (m) return <ScenarioHeader key={i} title={m[1]} probability={parseInt(m[2])} />;
          return <h3 key={i} className="text-blue-300 font-semibold text-sm mt-2 mb-0.5">{line.slice(4)}</h3>;
        }
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} className="text-amber-400 font-semibold text-sm">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-gray-600 shrink-0 mt-0.5">·</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
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
  const barColor = probability >= 50 ? 'bg-red-500' : probability >= 25 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className={`mt-3 mb-1 rounded-lg border px-3 py-2 ${color}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm">{title}</span>
        <span className="text-xs font-bold">~{probability}%</span>
      </div>
      <div className="h-1 bg-black/30 rounded overflow-hidden">
        <div className={`h-full rounded ${barColor}`} style={{ width: `${probability}%` }} />
      </div>
    </div>
  );
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-200">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded text-xs text-green-300">$1</code>');
}

function EmptyState({ onSuggest, hasPortfolio, portfolio }) {
  const portfolioSuggestions = hasPortfolio
    ? portfolio.assets.slice(0, 3).map(a =>
        `How does the current conflict situation affect my ${a.symbol} ${a.position}?`
      )
    : [];

  const suggestions = hasPortfolio
    ? [...portfolioSuggestions, ...SUGGESTIONS.slice(0, 3)]
    : SUGGESTIONS;

  return (
    <div className="py-4">
      <div className="text-center mb-5">
        <div className="text-3xl mb-2">{hasPortfolio ? '💼' : '💬'}</div>
        <p className="text-sm text-gray-400 font-medium">
          {hasPortfolio ? 'Ask about your portfolio risk' : 'Ask about any economic problem'}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {hasPortfolio
            ? 'Get personalized conflict-driven analysis for your positions'
            : 'The AI will connect it to a global conflict and walk you through the causal chain'}
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider px-1 mb-2">Try asking</p>
        {suggestions.map(s => (
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

function ThinkingState({ hasPortfolio }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-gray-500"
            style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      {hasPortfolio && (
        <span className="text-[10px] text-gray-500">Analyzing for your portfolio…</span>
      )}
    </div>
  );
}

function BotAvatar({ hasPortfolio }) {
  return (
    <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs shrink-0 mt-0.5 ${
      hasPortfolio ? 'bg-blue-900 border-blue-600' : 'bg-blue-900 border-blue-700'
    }`}>
      {hasPortfolio ? '💼' : '🌐'}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
