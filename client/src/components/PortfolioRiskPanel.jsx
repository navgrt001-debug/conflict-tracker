import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

async function fetchRisk(sessionId) {
  const res = await fetch(`${API}/portfolio/${sessionId}/risk`);
  if (!res.ok) throw new Error('Risk assessment failed');
  return res.json();
}

function RiskGauge({ score }) {
  const angle = (score / 100) * 180 - 90; // -90 to 90 degrees
  const color = score >= 70 ? '#f87171' : score >= 40 ? '#fbbf24' : '#4ade80';
  const label = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  const labelColor = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-amber-400' : 'text-green-400';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Background arc */}
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
          {/* Colored arc */}
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 141} 141`}
            opacity="0.8"
          />
          {/* Needle */}
          <g transform={`rotate(${angle}, 50, 50)`}>
            <line x1="50" y1="50" x2="50" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="50" r="3" fill="white" />
          </g>
        </svg>
      </div>
      <div className={`text-2xl font-bold ${labelColor} -mt-2`}>{score}</div>
      <div className={`text-[10px] font-bold ${labelColor} uppercase tracking-wider`}>{label} RISK</div>
    </div>
  );
}

function ImpactBar({ score, direction }) {
  const isPositive = direction === 'positive';
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1.5 bg-black/30 rounded overflow-hidden">
        <div
          className={`h-full rounded ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold w-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '↑' : '↓'}
      </span>
    </div>
  );
}

export default function PortfolioRiskPanel({ sessionId, hasPortfolio, onSetupPortfolio }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['portfolio-risk', sessionId],
    queryFn: () => fetchRisk(sessionId),
    enabled: hasPortfolio,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!hasPortfolio) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 text-center">
        <div className="text-2xl mb-2">💼</div>
        <p className="text-xs text-gray-400 mb-3">Set up your portfolio to see personalized risk analysis</p>
        <button
          onClick={onSetupPortfolio}
          className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          + Setup Portfolio
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Portfolio vs Current Conflicts</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
        >
          {isFetching ? '⟳ Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {isLoading ? (
        <div className="p-6 flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Calculating risk exposure…</p>
        </div>
      ) : isError || data?.error ? (
        <div className="p-4 text-xs text-red-400">
          {data?.error || 'Risk assessment unavailable'}
        </div>
      ) : data ? (
        <div className="p-4 space-y-4">
          {/* Gauge + summary */}
          <div className="flex items-start gap-4">
            <RiskGauge score={data.overall_risk_score ?? 0} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-300 leading-snug">{data.summary}</p>
              {data.fromCache && (
                <span className="text-[10px] text-blue-600 mt-1 block">· cached result</span>
              )}
            </div>
          </div>

          {/* Asset impacts */}
          {data.asset_impacts?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Position Impacts</div>
              <div className="space-y-2">
                {data.asset_impacts.map((imp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-24 shrink-0">
                      <div className="text-[11px] font-bold text-white">{imp.symbol}</div>
                      <div className={`text-[9px] font-medium ${imp.position === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                        {imp.position?.toUpperCase()}
                      </div>
                    </div>
                    <ImpactBar score={imp.impact_score ?? 50} direction={imp.direction} />
                    <div className="w-28 shrink-0">
                      <p className="text-[9px] text-gray-500 leading-tight line-clamp-2">{imp.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top threat + action */}
          {data.top_threat && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">Top Threat</div>
              <p className="text-[11px] text-red-300">{data.top_threat}</p>
            </div>
          )}
          {data.recommended_action && (
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-3">
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">Recommended Action</div>
              <p className="text-[11px] text-blue-300">{data.recommended_action}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
