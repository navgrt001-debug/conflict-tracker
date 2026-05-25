import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function cellColor(pct, tolerance) {
  if (pct == null) return 'bg-gray-800 text-gray-500';
  const abs = Math.abs(pct);
  if (pct < -tolerance) return 'bg-red-900/60 text-red-300 font-bold ring-1 ring-red-700';
  if (pct < -tolerance * 0.6) return 'bg-orange-900/40 text-orange-300';
  if (pct < 0) return 'bg-amber-900/30 text-amber-300';
  if (pct === 0) return 'bg-gray-800 text-gray-400';
  return 'bg-green-900/30 text-green-300';
}

function likelihoodDot(l) {
  return l === 'HIGH' ? '●●●' : l === 'MEDIUM' ? '●●○' : '●○○';
}

function fmt(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function AlternativeCard({ alt, currency = 'USD' }) {
  const riskColor = { LOW: 'text-green-400', MEDIUM: 'text-amber-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400' };
  const premiumColor = alt.estimated_cost_premium_pct < 0 ? 'text-green-400' : alt.estimated_cost_premium_pct < 5 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {alt.rank}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{alt.country}</div>
            <div className={`text-xs ${riskColor[alt.risk_level] || 'text-gray-400'}`}>Risk: {alt.risk_level}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-blue-400">{alt.score}/100</div>
          <div className="text-[10px] text-gray-500">match score</div>
        </div>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed">{alt.reasoning}</p>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-card rounded-lg p-2">
          <div className={`text-sm font-bold ${premiumColor}`}>
            {alt.estimated_cost_premium_pct > 0 ? '+' : ''}{alt.estimated_cost_premium_pct?.toFixed(1)}%
          </div>
          <div className="text-[9px] text-gray-600">Cost vs current</div>
        </div>
        <div className="bg-card rounded-lg p-2">
          <div className="text-sm font-bold text-white">{alt.transition_time_months}mo</div>
          <div className="text-[9px] text-gray-600">Transition time</div>
        </div>
      </div>

      {(alt.key_advantages || []).length > 0 && (
        <div className="space-y-0.5">
          {alt.key_advantages.map((a, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] text-green-400"><span>✓</span><span>{a}</span></div>
          ))}
        </div>
      )}
      {(alt.considerations || []).length > 0 && (
        <div className="space-y-0.5">
          {alt.considerations.map((c, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] text-amber-400"><span>⚠</span><span>{c}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SensitivityGrid({ companyId, company }) {
  const tolerance = company?.risk_tolerance?.max_profit_drop_pct || 15;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['pl-analysis', companyId],
    queryFn: () => fetch(`${API}/supply-chain/companies/${companyId}/pl-analysis`).then(r => {
      if (!r.ok) throw new Error('Failed');
      return r.json();
    }),
    staleTime: 30 * 60_000,
    enabled: !!companyId,
    retry: 1,
  });

  if (isLoading || isFetching) return (
    <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading sensitivity grid…
      </div>
    </div>
  );

  if (isError || !data) return (
    <div className="text-center py-12 text-red-400 text-sm">
      Failed to load. <button onClick={refetch} className="underline">Retry</button>
    </div>
  );

  const grid = data.sensitivity_grid || [];
  const quarters = data.quarters || ['Q1', 'Q2', 'Q3', 'Q4'];
  const alternatives = data.material_alternatives || [];

  const SCENARIO_ICONS = {
    stress: '💥', bear: '🐻', base: '📊', bull: '🐂', recovery: '🌱', upside: '🚀',
  };

  const scenarioIcon = (name) => {
    const key = name.toLowerCase().split(' ')[0];
    return SCENARIO_ICONS[key] || '📋';
  };

  return (
    <div className="space-y-6">
      {/* ── Sensitivity Grid ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">CFO Sensitivity Grid</div>
            <div className="text-[10px] text-gray-500">Net profit % impact by scenario & quarter · 🚨 = breach {tolerance}% tolerance</div>
          </div>
          <div className="text-[10px] text-gray-600">
            Likelihood: <span className="text-gray-400">●●● High · ●●○ Med · ●○○ Low</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-[10px] text-gray-500 uppercase tracking-wider w-48">Scenario</th>
                <th className="text-center px-3 py-2.5 text-[10px] text-gray-500 uppercase tracking-wider">Cost Δ</th>
                <th className="text-center px-3 py-2.5 text-[10px] text-gray-500 uppercase tracking-wider">Likelihood</th>
                {quarters.map(q => (
                  <th key={q} className="text-center px-3 py-2.5 text-[10px] text-gray-500 uppercase tracking-wider min-w-[80px]">{q}</th>
                ))}
                <th className="text-center px-3 py-2.5 text-[10px] text-gray-500 uppercase tracking-wider">Annual Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {grid.map((row, i) => {
                const impacts = row.quarterly_net_profit_impacts || [];
                const anyBreach = row.breach_tolerance || impacts.some(v => Math.abs(v || 0) > tolerance);
                return (
                  <tr key={i} className={`hover:bg-white/[0.02] transition-colors ${anyBreach ? 'bg-red-950/10' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{scenarioIcon(row.scenario)}</span>
                        <div>
                          <div className="font-semibold text-white">{row.scenario}</div>
                          <div className="text-[10px] text-gray-600 leading-tight">{row.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`font-mono font-medium ${
                        row.commodity_cost_change_pct > 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {row.commodity_cost_change_pct > 0 ? '+' : ''}{row.commodity_cost_change_pct}%
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`${
                        row.likelihood === 'HIGH' ? 'text-red-400' :
                        row.likelihood === 'MEDIUM' ? 'text-amber-400' : 'text-green-400'
                      } font-mono text-[11px]`}>
                        {likelihoodDot(row.likelihood)}
                      </span>
                    </td>
                    {quarters.map((q, qi) => {
                      const val = impacts[qi];
                      return (
                        <td key={q} className="text-center px-3 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-mono ${cellColor(val, tolerance)}`}>
                            {val != null ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%` : '—'}
                            {val != null && Math.abs(val) > tolerance && ' 🚨'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-3">
                      <span className={`font-mono text-xs font-medium ${
                        (row.annual_net_profit_impact_abs || 0) < 0 ? 'text-red-300' : 'text-green-300'
                      }`}>
                        {fmt(row.annual_net_profit_impact_abs)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-4 flex-wrap">
          <div className="text-[9px] text-gray-600 uppercase tracking-wider">Legend:</div>
          {[
            { color: 'bg-red-900/60 text-red-300', label: `Breach (>${tolerance}%)` },
            { color: 'bg-orange-900/40 text-orange-300', label: 'High impact' },
            { color: 'bg-amber-900/30 text-amber-300', label: 'Moderate' },
            { color: 'bg-gray-800 text-gray-400', label: 'Neutral' },
            { color: 'bg-green-900/30 text-green-300', label: 'Positive' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-8 h-4 rounded text-[8px] flex items-center justify-center ${l.color}`}>+0%</div>
              <span className="text-[9px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alternative Sources ───────────────────────────────────────────── */}
      {alternatives.length > 0 && (
        <div className="space-y-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
            Alternative Commodity Sources — Ranked by Safety & Cost
          </div>
          {alternatives.map((mat, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{mat.material}</div>
                    {mat.risk_driver && (
                      <div className="text-xs text-red-400 mt-0.5">⚠ {mat.risk_driver}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{(mat.alternatives || []).length} alternatives ranked</div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(mat.alternatives || []).map((alt, j) => (
                  <AlternativeCard key={j} alt={alt} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
