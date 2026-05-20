import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { flagEmoji, findCountry } from './countries';
import SwitchingPlan from './SwitchingPlan';
import SupplierComparison from './SupplierComparison';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const RANK_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600', 'text-gray-500', 'text-gray-600'];
const RANK_LABELS = ['#1 Best', '#2', '#3', '#4', '#5'];

const CURRENCY_RISK_COLORS = { low: 'text-green-400', medium: 'text-amber-400', high: 'text-red-400' };

function ScoreBar({ value, color = 'bg-blue-500', label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-gray-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-surface rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[9px] text-gray-400 w-6 text-right">{value}</span>
    </div>
  );
}

function AlternativeCard({ alt, rank, materialName, currentSources, onCompare, compareTarget, onSelectCompare }) {
  const [expanded, setExpanded] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const currentIso3 = currentSources?.[0]?.country_iso3 || currentSources?.[0] || null;

  const riskColor = alt.live_conflict_risk?.risk_score > 60 ? 'text-red-400'
    : alt.live_conflict_risk?.risk_score > 30 ? 'text-amber-400' : 'text-green-400';

  const premColor = alt.typical_price_premium > 5 ? 'text-red-400'
    : alt.typical_price_premium < 0 ? 'text-green-400' : 'text-gray-300';

  const isCompareSelected = compareTarget === alt.country_iso3;

  return (
    <>
      {planOpen && currentIso3 && (
        <SwitchingPlan
          material={materialName}
          from={currentIso3}
          to={alt.country_iso3}
          onClose={() => setPlanOpen(false)}
        />
      )}

      <div className={`border rounded-xl overflow-hidden transition-all ${
        rank === 0 ? 'border-yellow-700/50 bg-yellow-950/10' : 'border-border bg-surface/50'
      }`}>
        {/* Card header */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Rank + flag */}
          <div className="text-center shrink-0">
            <div className={`text-xs font-bold ${RANK_COLORS[rank]}`}>{RANK_LABELS[rank]}</div>
            <div className="text-2xl mt-0.5">{flagEmoji(findCountry(alt.country_iso3)?.iso2 || '')}</div>
          </div>

          {/* Name + scores summary */}
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">{alt.country_name}</div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={`text-xs font-bold ${RANK_COLORS[rank]}`}>
                Score: {alt.scores.total}
              </span>
              <span className={`text-xs ${premColor}`}>
                {alt.typical_price_premium >= 0 ? '+' : ''}{alt.typical_price_premium}% price
              </span>
              <span className="text-xs text-gray-500">{alt.avg_lead_time_days}d lead</span>
              <span className={`text-xs ${riskColor}`}>
                Risk {alt.live_conflict_risk?.risk_score ?? '—'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onSelectCompare(alt.country_iso3)}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                isCompareSelected
                  ? 'bg-purple-800 border-purple-600 text-purple-200'
                  : 'border-border text-gray-500 hover:text-gray-300'
              }`}
            >
              {isCompareSelected ? '✓ Compare' : '⚖ Compare'}
            </button>
            {currentIso3 && (
              <button
                onClick={() => setPlanOpen(true)}
                className="text-[10px] px-2 py-1 rounded border border-blue-700 text-blue-400 hover:text-blue-200 transition-colors"
              >
                → Plan
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] px-2 py-1 rounded border border-border text-gray-500 hover:text-gray-300 transition-colors"
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Score bars */}
        <div className="px-4 pb-3 space-y-1">
          <ScoreBar value={alt.scores.risk} color="bg-blue-500" label="Risk" />
          <ScoreBar value={alt.scores.price} color="bg-green-500" label="Price" />
          <ScoreBar value={alt.scores.lead_time} color="bg-amber-500" label="Lead time" />
          <ScoreBar value={alt.scores.quality} color="bg-purple-500" label="Quality" />
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border px-4 py-3 space-y-2.5 text-xs">
            {/* Notes */}
            {alt.notes && (
              <p className="text-gray-400 italic leading-relaxed">{alt.notes}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Left column */}
              <div className="space-y-1.5">
                <Detail label="Quality score" value={`${alt.quality_score}/100`} />
                <Detail label="Infrastructure" value={`${alt.infrastructure_score}/100`} />
                <Detail label="Political stability" value={`${alt.political_stability_score}/100`} />
                <Detail label="Currency risk">
                  <span className={CURRENCY_RISK_COLORS[alt.currency_risk] || 'text-gray-400'}>
                    {alt.currency_risk?.toUpperCase()}
                  </span>
                </Detail>
              </div>

              {/* Right column */}
              <div className="space-y-1.5">
                {alt.live_conflict_risk && (
                  <>
                    <Detail label="Live conflict score" value={alt.live_conflict_risk.risk_score} />
                    <Detail label="Conflict trend" value={alt.live_conflict_risk.trend} />
                    <Detail label="Recent events" value={alt.live_conflict_risk.event_count} />
                  </>
                )}
              </div>
            </div>

            {/* Trade routes */}
            {alt.trade_routes?.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Trade routes</div>
                <div className="flex flex-wrap gap-1">
                  {alt.trade_routes.map(r => (
                    <span key={r} className="text-[10px] px-1.5 py-0.5 bg-blue-950/40 border border-blue-900 rounded text-blue-300">{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Key risks */}
            {alt.key_risks?.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Key risks</div>
                <ul className="space-y-0.5">
                  {alt.key_risks.map(r => (
                    <li key={r} className="flex items-start gap-1 text-gray-400">
                      <span className="text-red-400 shrink-0">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top conflict events */}
            {alt.live_conflict_risk?.top_events?.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Recent conflict events</div>
                <ul className="space-y-0.5">
                  {alt.live_conflict_risk.top_events.map((ev, i) => (
                    <li key={i} className="text-gray-500 text-[10px] line-clamp-1">{ev.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Detail({ label, value, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{children ?? value}</span>
    </div>
  );
}

export default function AlternativeSuppliers({ materialName, currentSources = [] }) {
  const [compareTargets, setCompareTargets] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const sources = currentSources.map(s => typeof s === 'string' ? s : s.country_iso3).filter(Boolean);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['alternatives', materialName, sources.join(',')],
    queryFn: async () => {
      const res = await fetch(`${API}/supply-chain/alternatives/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_name: materialName, sources: currentSources }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load alternatives');
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!materialName,
  });

  const handleSelectCompare = (iso3) => {
    setCompareTargets(prev => {
      if (prev.includes(iso3)) return prev.filter(x => x !== iso3);
      if (prev.length >= 2) return [prev[1], iso3];
      return [...prev, iso3];
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isError) return (
    <div className="text-center py-8 text-red-400 text-sm">{error?.message || 'Failed to load alternatives'}</div>
  );

  if (!data?.found) return (
    <div className="text-center py-8 text-gray-500 text-sm">No alternative supplier data for "{materialName}"</div>
  );

  return (
    <div className="space-y-3">
      {/* Compare toolbar */}
      {compareTargets.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-purple-950/30 border border-purple-800 rounded-xl">
          <span className="text-xs text-purple-300">
            Comparing: {compareTargets.map(iso => {
              const alt = data.alternatives.find(a => a.country_iso3 === iso);
              return alt?.country_name || iso;
            }).join(' vs ')}
          </span>
          {compareTargets.length === 2 && (
            <button
              onClick={() => setShowComparison(true)}
              className="ml-auto text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              Compare ↗
            </button>
          )}
          <button
            onClick={() => setCompareTargets([])}
            className="text-xs text-purple-500 hover:text-purple-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* Compare hint */}
      {compareTargets.length === 0 && data.alternatives.length >= 2 && (
        <p className="text-[10px] text-gray-600 text-center">
          Select 2 suppliers with ⚖ Compare to compare them side-by-side
        </p>
      )}

      {/* Supplier cards */}
      {data.alternatives.map((alt, i) => (
        <AlternativeCard
          key={alt.country_iso3}
          alt={alt}
          rank={i}
          materialName={materialName}
          currentSources={currentSources}
          compareTarget={compareTargets.includes(alt.country_iso3) ? alt.country_iso3 : null}
          onSelectCompare={handleSelectCompare}
        />
      ))}

      {/* Comparison modal */}
      {showComparison && compareTargets.length === 2 && (
        <SupplierComparison
          material={materialName}
          isoA={compareTargets[0]}
          isoB={compareTargets[1]}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
