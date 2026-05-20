import { useState } from 'react';
import { flagEmoji, findCountry } from './countries';

function riskColor(score) {
  if (score >= 81) return { bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-800', bg: 'bg-red-950/30' };
  if (score >= 61) return { bar: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-800', bg: 'bg-orange-950/30' };
  if (score >= 31) return { bar: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-700', bg: 'bg-amber-950/30' };
  return { bar: 'bg-green-500', text: 'text-green-400', border: 'border-green-800', bg: 'bg-green-950/30' };
}

export default function CountryRiskBadge({ iso3, riskScore, riskData, supplyPct, compact = false }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const country = findCountry(iso3);
  const flag = country ? flagEmoji(country.iso2) : '🌍';
  const name = country?.name || iso3;
  const score = riskScore ?? riskData?.risk_score ?? 0;
  const colors = riskColor(score);
  const topEvents = riskData?.top_events || [];
  const trend = riskData?.trend || 'stable';

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${colors.border} ${colors.bg} transition-colors`}
        >
          <span className="text-sm">{flag}</span>
          <span className="text-[11px] text-gray-300 font-medium">{name}</span>
          <span className={`text-[10px] font-bold ${colors.text}`}>{score}</span>
          {supplyPct !== undefined && (
            <span className="text-[10px] text-gray-500">{supplyPct}%</span>
          )}
        </button>

        {tooltipOpen && topEvents.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-card border border-border rounded-xl p-3 shadow-xl z-50">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">
              Recent Events in {name}
            </div>
            <div className="space-y-1.5">
              {topEvents.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className={`text-[9px] font-bold mt-0.5 ${e.severity >= 7 ? 'text-red-400' : 'text-amber-400'}`}>
                    {e.severity}/10
                  </span>
                  <p className="text-[11px] text-gray-300 leading-snug">{e.title}</p>
                </div>
              ))}
            </div>
            {trend !== 'stable' && (
              <div className={`mt-2 text-[10px] font-medium ${trend === 'increasing' ? 'text-red-400' : 'text-green-400'}`}>
                Trend: {trend === 'increasing' ? '↑ Escalating' : '↓ De-escalating'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${colors.border} ${colors.bg}`}>
      <span className="text-2xl">{flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-white">{name}</span>
          <span className={`text-sm font-bold ${colors.text}`}>{score}/100</span>
        </div>
        <div className="h-1.5 bg-black/30 rounded overflow-hidden">
          <div className={`h-full ${colors.bar} rounded`} style={{ width: `${score}%` }} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          {riskData?.event_count > 0 && (
            <span className="text-[10px] text-gray-500">{riskData.event_count} events</span>
          )}
          {trend !== 'stable' && (
            <span className={`text-[10px] font-medium ${trend === 'increasing' ? 'text-red-400' : 'text-green-400'}`}>
              {trend === 'increasing' ? '↑ escalating' : '↓ de-escalating'}
            </span>
          )}
          {supplyPct !== undefined && (
            <span className="text-[10px] text-blue-400 ml-auto">{supplyPct}% of supply</span>
          )}
        </div>
        {topEvents.slice(0, 1).map((e, i) => (
          <p key={i} className="text-[10px] text-gray-500 mt-1 line-clamp-1">{e.title}</p>
        ))}
      </div>
    </div>
  );
}
