import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ScenarioResult from './ScenarioResult';

const API = import.meta.env.VITE_API_URL || '/api';

async function fetchTemplates() {
  const res = await fetch(`${API}/scenarios/templates`);
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

async function fetchHistory() {
  const res = await fetch(`${API}/scenarios/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

async function analyzeScenario(question) {
  const res = await fetch(`${API}/scenarios/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Analysis failed');
  }
  return res.json();
}

export default function ScenarioEngine({ savedScenarios, onSaveForComparison }) {
  const [question, setQuestion] = useState('');
  const [activeResult, setActiveResult] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['scenario-templates'],
    queryFn: fetchTemplates,
    staleTime: Infinity,
  });

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['scenario-history'],
    queryFn: fetchHistory,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: analyzeScenario,
    onSuccess: (data) => {
      setActiveResult(data);
      refetchHistory();
    },
  });

  const filtered = question.length > 1
    ? templates.filter(t => t.toLowerCase().includes(question.toLowerCase()))
    : templates;

  const handleSubmit = (q) => {
    const text = (q || question).trim();
    if (!text) return;
    setShowSuggestions(false);
    mutation.mutate(text);
  };

  const handleTemplate = (t) => {
    setQuestion(t);
    setShowSuggestions(false);
    mutation.mutate(t);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!suggestionsRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isSaved = activeResult
    ? savedScenarios?.some(s => s.id === activeResult.id)
    : false;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-base">Scenario Analysis</h2>
              <p className="text-xs text-gray-500 mt-0.5">Model geopolitical outcomes and their market impact</p>
            </div>
            <button
              onClick={() => setHistoryOpen(h => !h)}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:border-gray-500 transition-colors"
            >
              📋 History ({history.length})
            </button>
          </div>

          {/* Input */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={e => { setQuestion(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setShowSuggestions(false); }}
                  placeholder="What if Iran closes the Strait of Hormuz?"
                  className="w-full bg-surface border border-border text-white text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
                  disabled={mutation.isPending}
                />
                {question && (
                  <button
                    onClick={() => { setQuestion(''); setShowSuggestions(false); inputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                  >✕</button>
                )}
              </div>
              <button
                onClick={() => handleSubmit()}
                disabled={!question.trim() || mutation.isPending}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-surface disabled:text-gray-600 disabled:border-border text-white text-sm font-medium rounded-lg border border-blue-500 disabled:border-border transition-colors whitespace-nowrap"
              >
                {mutation.isPending ? 'Analyzing…' : 'Analyze →'}
              </button>
            </div>

            {/* Autocomplete suggestions */}
            {showSuggestions && filtered.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-10 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden"
              >
                {filtered.slice(0, 6).map((t, i) => (
                  <button
                    key={i}
                    onMouseDown={() => handleTemplate(t)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-surface hover:text-white transition-colors border-b border-border/50 last:border-0"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preset chips */}
          <div className="flex gap-2 flex-wrap">
            {templates.slice(0, 5).map((t, i) => (
              <button
                key={i}
                onClick={() => handleTemplate(t)}
                disabled={mutation.isPending}
                className="text-[11px] text-gray-400 hover:text-white bg-surface hover:bg-card border border-border hover:border-gray-500 px-2.5 py-1 rounded-full transition-colors disabled:opacity-40"
              >
                {t.replace('What if ', '').replace('?', '')}
              </button>
            ))}
            <button
              onClick={() => setShowSuggestions(true)}
              className="text-[11px] text-blue-500 hover:text-blue-400 px-2.5 py-1 transition-colors"
            >
              +{templates.length - 5} more →
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* History sidebar */}
        {historyOpen && (
          <div className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto">
            <div className="px-3 py-2 border-b border-border text-[10px] text-gray-500 uppercase tracking-wider font-bold">
              Recent Scenarios
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-gray-600 p-4">No history yet.</p>
            ) : (
              history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setActiveResult(entry)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-surface transition-colors ${
                    activeResult?.id === entry.id ? 'bg-blue-950/30 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className="text-xs text-gray-300 leading-snug line-clamp-2 mb-1">
                    {entry.question}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${
                      (entry.result?.result?.probability ?? entry.result?.probability ?? 0) >= 60 ? 'text-red-400' :
                      (entry.result?.result?.probability ?? entry.result?.probability ?? 0) >= 30 ? 'text-amber-400' : 'text-green-400'
                    }`}>
                      {entry.result?.result?.probability ?? entry.result?.probability ?? '—'}%
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {new Date(entry.analyzed_at).toLocaleDateString()}
                    </span>
                    {entry.result?.fromCache && <span className="text-[10px] text-blue-600">cached</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {mutation.isPending && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🔮</div>
                </div>
                <div>
                  <p className="text-white font-medium text-center">Analyzing scenario…</p>
                  <p className="text-xs text-gray-500 text-center mt-1">Running geopolitical risk models</p>
                </div>
              </div>
            )}

            {mutation.isError && !mutation.isPending && (
              <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-300 max-w-lg mx-auto mt-8">
                <span className="font-bold">Analysis failed:</span> {mutation.error?.message}
              </div>
            )}

            {activeResult && !mutation.isPending && (
              <ScenarioResult
                entry={activeResult}
                onSaveForComparison={onSaveForComparison}
                isSaved={isSaved}
              />
            )}

            {!activeResult && !mutation.isPending && !mutation.isError && (
              <EmptyState onTemplate={handleTemplate} templates={templates.slice(5, 10)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onTemplate, templates }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">🔮</div>
      <h3 className="text-white font-bold text-lg mb-2">Model a Geopolitical Scenario</h3>
      <p className="text-gray-500 text-sm max-w-md mb-8">
        Ask "What if…" questions to get AI-powered probability estimates, market impact analysis across Base / Bull / Bear cases, historical analogues, and actionable hedging strategies.
      </p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-md">
        {templates.map((t, i) => (
          <button
            key={i}
            onClick={() => onTemplate(t)}
            className="text-left px-4 py-3 bg-surface border border-border hover:border-blue-600 hover:bg-blue-950/20 rounded-xl text-sm text-gray-300 hover:text-white transition-all"
          >
            <span className="text-blue-500 mr-2">→</span>{t}
          </button>
        ))}
      </div>
    </div>
  );
}
