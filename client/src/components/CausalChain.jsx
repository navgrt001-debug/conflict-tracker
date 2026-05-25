import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const SENTIMENT_STYLE = {
  'risk-off': { label: 'RISK-OFF', cls: 'bg-red-900 border-red-700 text-red-300' },
  'risk-on':  { label: 'RISK-ON',  cls: 'bg-green-900 border-green-700 text-green-300' },
  'neutral':  { label: 'NEUTRAL',  cls: 'bg-gray-800 border-gray-600 text-gray-300' },
};

const DIR_STYLE = {
  up:   { arrow: '↑', cls: 'text-green-400', bar: 'bg-green-500' },
  down: { arrow: '↓', cls: 'text-red-400',   bar: 'bg-red-500' },
};

export default function CausalChain({ event }) {
  const { data: chain, isLoading, error, isFetching } = useQuery({
    queryKey: ['causal-chain', event?.id],
    queryFn: () => fetch(`${API}/feed/causal-chain/${event.id}`).then(r => {
      if (!r.ok) return r.json().then(e => Promise.reject(e));
      return r.json();
    }),
    enabled: !!event,
    staleTime: 3600_000,
    retry: 1,
  });

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm p-4 text-center">
        <div>
          <div className="text-3xl mb-2">⛓️</div>
          <div>Click any event in the feed to see its causal chain</div>
        </div>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-6 text-center">
        {/* Spinning ring */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-gray-800" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-blue-400 animate-spin [animation-duration:1.4s]" />
          <div className="absolute inset-0 flex items-center justify-center text-lg">⛓️</div>
        </div>

        {/* Label */}
        <div>
          <div className="text-sm font-semibold text-white mb-1">Analysing causal chain…</div>
          <div className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
            AI is tracing market &amp; geopolitical ripple effects. This usually takes 10–20 seconds.
          </div>
        </div>

        {/* Animated dots row */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-500"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>

        {/* Skeleton preview — gives context while waiting */}
        <div className="w-full space-y-2 mt-2 opacity-30">
          <div className="h-3 bg-surface rounded animate-pulse w-5/6 mx-auto" />
          <div className="h-3 bg-surface rounded animate-pulse w-3/4 mx-auto" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm">
        <div className="text-red-400 font-bold mb-1">Causal chain error</div>
        <div className="text-red-500 text-xs">{error.error || String(error)}</div>
        <div className="text-gray-600 text-xs mt-2">Check DEEPSEEK_API_KEY in server/.env</div>
      </div>
    );
  }

  if (!chain) return null;

  const sentiment = SENTIMENT_STYLE[chain.overall_market_sentiment] || SENTIMENT_STYLE.neutral;

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-3 space-y-3">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-xs font-bold text-white leading-snug flex-1">{chain.event || event.title}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${sentiment.cls}`}>
              {sentiment.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBar value={chain.severity} />
            <span className="text-xs text-gray-500">Severity {chain.severity}/10</span>
          </div>
        </div>

        {/* Chain steps */}
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Causal Chain</div>
          <div className="space-y-2">
            {(chain.chain || []).map((step, i) => {
              const dir = DIR_STYLE[step.direction] || DIR_STYLE.up;
              return (
                <div key={i} className="relative">
                  {i < (chain.chain.length - 1) && (
                    <div className="absolute left-4 top-full w-px h-2 bg-gray-700 z-10" />
                  )}
                  <div className="bg-surface border border-border rounded-lg p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 leading-snug mb-1.5">{step.what}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[10px] font-bold text-blue-300 bg-blue-950 px-1.5 py-0.5 rounded">
                            {step.affects}
                          </span>
                          <span className={`text-xs font-bold ${dir.cls}`}>
                            {dir.arrow} {step.magnitude}
                          </span>
                          <span className="text-[10px] text-gray-600">{step.timeframe}</span>
                        </div>
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-gray-600">Confidence</span>
                            <span className="text-[10px] text-gray-400">{step.confidence}%</span>
                          </div>
                          <div className="h-1 bg-gray-800 rounded overflow-hidden">
                            <div
                              className={`h-full rounded ${dir.bar} opacity-70`}
                              style={{ width: `${step.confidence}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historical analogues */}
        {chain.historical_analogues?.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Historical Analogues</div>
            <div className="space-y-2">
              {chain.historical_analogues.map((a, i) => {
                // Support both old string format and new object format
                if (typeof a === 'string') {
                  return (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-gray-400 bg-surface border border-border rounded-lg px-2.5 py-2">
                      <span className="text-blue-500 shrink-0 mt-0.5">▸</span>
                      <span>{a}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className="bg-surface border border-border rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <span className="text-blue-500 shrink-0 mt-0.5 text-xs">▸</span>
                      <span className="text-xs font-semibold text-blue-300">{a.event}</span>
                    </div>
                    {a.similarity && (
                      <p className="text-[11px] text-gray-400 leading-relaxed pl-3.5">
                        <span className="text-gray-600 font-medium">Why similar: </span>{a.similarity}
                      </p>
                    )}
                    {a.outcome && (
                      <p className="text-[11px] text-amber-400/80 leading-relaxed pl-3.5">
                        <span className="text-gray-600 font-medium">Outcome: </span>{a.outcome}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBar({ value }) {
  const pct = (value / 10) * 100;
  const color = value >= 8 ? 'bg-red-500' : value >= 6 ? 'bg-orange-500' : value >= 4 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex-1 h-1.5 bg-gray-800 rounded overflow-hidden">
      <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
