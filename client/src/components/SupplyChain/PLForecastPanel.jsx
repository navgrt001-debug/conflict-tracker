import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const RISK_COLORS = {
  CRITICAL: { bg: 'bg-red-900/30', border: 'border-red-700', text: 'text-red-400', badge: 'bg-red-900 text-red-300' },
  HIGH:     { bg: 'bg-orange-900/20', border: 'border-orange-700', text: 'text-orange-400', badge: 'bg-orange-900 text-orange-300' },
  MEDIUM:   { bg: 'bg-amber-900/20', border: 'border-amber-700', text: 'text-amber-400', badge: 'bg-amber-900 text-amber-300' },
  LOW:      { bg: 'bg-green-900/20', border: 'border-green-700', text: 'text-green-400', badge: 'bg-green-900 text-green-300' },
};

const CONFIDENCE_COLORS = { HIGH: 'text-green-400', MEDIUM: 'text-amber-400', LOW: 'text-red-400' };

function fmt(n, currency = 'USD') {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function ImpactBar({ value, max = 30 }) {
  const clamped = Math.min(Math.abs(value || 0), max);
  const pct = (clamped / max) * 100;
  const isNeg = (value || 0) < 0;
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${isNeg ? 'bg-red-500' : 'bg-green-500'}`}
        style={{ width: `${pct}%` }} />
    </div>
  );
}

function QuarterCard({ q, tolerance }) {
  const breach = q.breach_tolerance;
  const netImpact = q.net_profit_impact_pct;
  const cogsChange = q.cogs_impact_pct;
  const revChange = q.revenue_impact_pct;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      breach ? 'bg-red-950/20 border-red-700' : 'bg-surface border-border'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {q.quarter}
            {breach && <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded font-medium">🚨 BREACH</span>}
          </div>
          <div className={`text-[10px] mt-0.5 ${CONFIDENCE_COLORS[q.confidence] || 'text-gray-500'}`}>
            {q.confidence} confidence
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold font-mono ${
            netImpact < -20 ? 'text-red-400' :
            netImpact < -10 ? 'text-orange-400' :
            netImpact < 0 ? 'text-amber-400' : 'text-green-400'
          }`}>
            {netImpact > 0 ? '+' : ''}{netImpact?.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500">Net profit Δ</div>
        </div>
      </div>

      {/* Mini metric row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-card rounded-lg p-2">
          <div className={`text-sm font-bold ${cogsChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {cogsChange > 0 ? '+' : ''}{cogsChange?.toFixed(1)}%
          </div>
          <div className="text-[9px] text-gray-600">COGS change</div>
          <ImpactBar value={-cogsChange} />
        </div>
        <div className="bg-card rounded-lg p-2">
          <div className={`text-sm font-bold ${revChange < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {revChange > 0 ? '+' : ''}{revChange?.toFixed(1)}%
          </div>
          <div className="text-[9px] text-gray-600">Revenue Δ</div>
          <ImpactBar value={revChange} />
        </div>
        <div className="bg-card rounded-lg p-2">
          <div className="text-sm font-bold text-blue-400">{q.gross_margin_new_pct?.toFixed(1)}%</div>
          <div className="text-[9px] text-gray-600">Gross margin</div>
        </div>
      </div>

      {/* Net profit dollar impact */}
      {q.net_profit_impact_abs != null && (
        <div className={`text-xs rounded px-2 py-1 text-center font-mono ${
          q.net_profit_impact_abs < 0 ? 'bg-red-900/20 text-red-300' : 'bg-green-900/20 text-green-300'
        }`}>
          {fmt(q.net_profit_impact_abs)} on net profit
        </div>
      )}

      {/* Key drivers */}
      {(q.key_drivers || []).length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] text-gray-600 uppercase tracking-wider">Key drivers</div>
          {q.key_drivers.map((d, i) => (
            <div key={i} className="flex gap-1.5 text-xs text-gray-400">
              <span className="text-gray-600 shrink-0">·</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risk flags */}
      {(q.risk_flags || []).length > 0 && (
        <div className="space-y-1">
          {q.risk_flags.map((f, i) => (
            <div key={i} className="text-[10px] bg-red-900/20 border border-red-800/40 text-red-300 rounded px-2 py-1">⚠ {f}</div>
          ))}
        </div>
      )}

      {/* Inflation note */}
      {q.inflation_note && (
        <div className="text-[10px] text-gray-500 italic border-t border-border pt-2">
          {q.inflation_note}
        </div>
      )}
    </div>
  );
}

function BuyerImpactRow({ b }) {
  const flagMap = { improving: '↑', stable: '→', declining: '↓', sharply_declining: '↓↓' };
  const trendColor = {
    improving: 'text-green-400', stable: 'text-gray-400',
    declining: 'text-amber-400', sharply_declining: 'text-red-400',
  };
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-white">{b.country} <span className="text-gray-500 font-normal text-xs">({b.percentage}% of sales)</span></div>
          <div className={`text-xs mt-0.5 ${RISK_COLORS[b.revenue_risk]?.text || 'text-gray-400'}`}>
            Revenue risk: {b.revenue_risk}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${trendColor[b.purchasing_power_trend] || 'text-gray-400'}`}>
            {flagMap[b.purchasing_power_trend]} {b.demand_impact_pct > 0 ? '+' : ''}{b.demand_impact_pct?.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500">Demand outlook</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-2 text-center">
        <div>
          <div className="text-sm font-bold text-white">{b.inflation_rate_pct?.toFixed(1)}%</div>
          <div className="text-[9px] text-gray-600">Inflation</div>
        </div>
        <div>
          <div className={`text-sm font-bold ${(b.real_wage_growth_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(b.real_wage_growth_pct || 0) > 0 ? '+' : ''}{b.real_wage_growth_pct?.toFixed(1) || '?'}%
          </div>
          <div className="text-[9px] text-gray-600">Real wage growth</div>
        </div>
        <div>
          <div className={`text-sm font-bold ${b.fx_risk === 'HIGH' ? 'text-red-400' : b.fx_risk === 'MEDIUM' ? 'text-amber-400' : 'text-green-400'}`}>
            {b.fx_risk}
          </div>
          <div className="text-[9px] text-gray-600">FX risk</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{b.analysis}</p>
    </div>
  );
}

function RecommendationRow({ r, i }) {
  const priorityStyle = {
    URGENT: 'bg-red-900 text-red-300 border-red-700',
    HIGH: 'bg-orange-900 text-orange-300 border-orange-700',
    MEDIUM: 'bg-amber-900/50 text-amber-300 border-amber-700',
  };
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 mt-0.5 ${priorityStyle[r.priority] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
          {r.priority}
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-1">{r.action}</div>
          <div className="text-xs text-gray-400">{r.rationale}</div>
          {r.estimated_benefit && (
            <div className="text-xs text-green-400 mt-1">💡 {r.estimated_benefit}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PLForecastPanel({ companyId, company }) {
  const [subTab, setSubTab] = useState('quarters');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['pl-analysis', companyId],
    queryFn: () => fetch(`${API}/supply-chain/companies/${companyId}/pl-analysis`).then(r => {
      if (!r.ok) throw new Error('Analysis failed');
      return r.json();
    }),
    staleTime: 30 * 60_000,
    enabled: !!companyId,
    retry: 1,
  });

  const tolerance = company?.risk_tolerance?.max_profit_drop_pct || 15;

  if (isLoading || isFetching) return (
    <div className="flex flex-col items-center justify-center h-64 w-full gap-4 text-center p-6">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-gray-800" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-blue-400 animate-spin [animation-duration:1.4s]" />
        <div className="absolute inset-0 flex items-center justify-center text-base">📈</div>
      </div>
      <div>
        <div className="text-sm font-semibold text-white mb-1">Generating P&L forecast…</div>
        <div className="text-xs text-gray-500 max-w-xs leading-relaxed">
          AI is modelling conflict exposure, inflation pass-through, and quarterly P&L impact. Takes 20–40 seconds.
        </div>
      </div>
    </div>
  );

  if (isError || !data) return (
    <div className="flex flex-col items-center justify-center h-64 w-full gap-3 text-center p-6">
      <div className="text-3xl">⚠️</div>
      <div className="text-sm text-red-400">Analysis failed to generate</div>
      <button onClick={() => refetch()} className="text-xs px-3 py-1.5 bg-blue-900/30 border border-blue-800 text-blue-300 rounded-lg">Retry</button>
    </div>
  );

  const qForecast = data.quarterly_forecast || [];
  const breachCount = qForecast.filter(q => q.breach_tolerance).length;
  const rColors = RISK_COLORS[data.overall_risk] || RISK_COLORS.LOW;

  const SUB_TABS = [
    { id: 'quarters', label: '📅 Quarterly Forecast' },
    { id: 'buyers', label: `🌍 Buyer Markets (${(data.buyer_market_impact || []).length})` },
    { id: 'actions', label: `⚡ Actions (${(data.key_recommendations || []).length})` },
  ];

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className={`rounded-xl border p-4 ${rColors.border} ${rColors.bg}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className={`text-lg font-bold ${rColors.text}`}>
              {data.overall_risk} RISK — Score {data.risk_score}/100
            </div>
            {breachCount > 0 && (
              <div className="text-xs text-red-300 mt-0.5">
                🚨 {breachCount} quarter{breachCount > 1 ? 's' : ''} breach your {tolerance}% profit tolerance
              </div>
            )}
          </div>
          <button onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs px-3 py-1.5 border border-border text-gray-500 hover:text-gray-300 rounded-lg transition-colors disabled:opacity-40">
            ↻ Refresh
          </button>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{data.executive_summary}</p>
        {data.generated_at && (
          <div className="text-[10px] text-gray-600 mt-2">Generated: {new Date(data.generated_at).toLocaleString()}</div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
              subTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Quarters */}
      {subTab === 'quarters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {qForecast.map((q, i) => <QuarterCard key={i} q={q} tolerance={tolerance} />)}
        </div>
      )}

      {/* Buyer markets */}
      {subTab === 'buyers' && (
        <div className="space-y-3">
          {(data.buyer_market_impact || []).length === 0
            ? <div className="text-sm text-gray-600 text-center py-8">No buyer market data available</div>
            : (data.buyer_market_impact || []).map((b, i) => <BuyerImpactRow key={i} b={b} />)
          }
        </div>
      )}

      {/* Recommendations */}
      {subTab === 'actions' && (
        <div className="space-y-3">
          {(data.key_recommendations || []).map((r, i) => <RecommendationRow key={i} r={r} i={i} />)}
        </div>
      )}
    </div>
  );
}
