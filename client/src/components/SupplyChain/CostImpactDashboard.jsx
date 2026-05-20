import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import MaterialImpactCard from './MaterialImpactCard';
import AlternativeSuppliers from './AlternativeSuppliers';
import PricingDashboard from './PricingDashboard';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const RISK_COLORS = {
  CRITICAL: { text: 'text-red-400', bg: 'bg-red-900/20', bar: '#ef4444', border: 'border-red-800', gauge: '#ef4444' },
  HIGH:     { text: 'text-orange-400', bg: 'bg-orange-900/20', bar: '#f97316', border: 'border-orange-700', gauge: '#f97316' },
  MEDIUM:   { text: 'text-amber-400', bg: 'bg-amber-900/20', bar: '#f59e0b', border: 'border-amber-700', gauge: '#f59e0b' },
  LOW:      { text: 'text-green-400', bg: 'bg-green-900/20', bar: '#22c55e', border: 'border-green-800', gauge: '#22c55e' },
};

function fmt(n) {
  if (!n && n !== 0) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function RiskGauge({ level }) {
  const scores = { LOW: 15, MEDIUM: 40, HIGH: 68, CRITICAL: 88 };
  const score = scores[level] || 0;
  const color = RISK_COLORS[level]?.gauge || '#22c55e';
  const angle = (score / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-14 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
          <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 141} 141`} opacity="0.85" />
          <g transform={`rotate(${angle}, 50, 50)`}>
            <line x1="50" y1="50" x2="50" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="50" r="3" fill="white" />
          </g>
        </svg>
      </div>
      <div className={`text-lg font-bold -mt-1 ${RISK_COLORS[level]?.text || 'text-gray-400'}`}>{level}</div>
    </div>
  );
}

function KPICard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 text-center">
      <div className={`text-xl font-bold ${color} mb-0.5`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

async function fetchImpact(companyId, narrative) {
  const url = `${API}/supply-chain/companies/${companyId}/impact${narrative ? '?narrative=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Impact fetch failed');
  return res.json();
}

async function fetchNarrative(companyId) {
  const res = await fetch(`${API}/supply-chain/companies/${companyId}/impact?narrative=true&refresh=true`);
  if (!res.ok) throw new Error('Narrative failed');
  const d = await res.json();
  return d.narrative;
}

export default function CostImpactDashboard({ companyId, company, onEdit }) {
  const [mainTab, setMainTab] = useState('impact'); // 'impact' | 'alternatives'
  const [altMaterial, setAltMaterial] = useState(null);
  const [sortBy, setSortBy] = useState('annual_cost_increase');
  const [sortDir, setSortDir] = useState('desc');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [narrative, setNarrative] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState('');

  const { data: impact, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['supply-impact', companyId],
    queryFn: () => fetchImpact(companyId, false),
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const loadNarrative = async () => {
    setNarrativeLoading(true);
    setNarrativeError('');
    try {
      const text = await fetchNarrative(companyId);
      setNarrative(text);
    } catch (e) {
      setNarrativeError(e.message);
    } finally {
      setNarrativeLoading(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Calculating impact across {company?.materials?.length || 0} materials…</p>
      </div>
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-red-400 text-sm">Failed to load impact data. <button onClick={refetch} className="underline">Retry</button></div>
    </div>
  );

  if (!impact) return null;

  // Sort and filter materials
  let materials = [...(impact.materials || [])];
  if (filterRisk !== 'ALL') materials = materials.filter(m => m.risk_level === filterRisk);
  materials.sort((a, b) => {
    const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const rlevel = impact.overall_risk_level || 'LOW';
  const rColors = RISK_COLORS[rlevel] || RISK_COLORS.LOW;

  // Bar chart data
  const barData = (impact.materials || [])
    .filter(m => m.annual_cost_increase !== 0)
    .sort((a, b) => Math.abs(b.annual_cost_increase) - Math.abs(a.annual_cost_increase))
    .slice(0, 8)
    .map(m => ({
      name: m.material_name.slice(0, 10),
      value: Math.round(m.annual_cost_increase),
      risk: m.risk_level,
    }));

  const sortHeader = (key) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">{company?.name || impact.company_name}</h2>
            <p className="text-xs text-gray-500">{company?.industry} · Supply Chain Risk Analysis</p>
          </div>
          <div className="flex gap-2">
            {/* Main tab toggle */}
            <div className="flex bg-surface border border-border rounded-lg overflow-hidden text-xs font-medium">
              {[
                { id: 'impact',       label: '📊 Cost Impact' },
                { id: 'alternatives', label: '⇄ Alternatives' },
                { id: 'pricing',      label: '💰 Pricing' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setMainTab(t.id)}
                  className={`px-3 py-1.5 transition-colors ${mainTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={onEdit} className="text-xs px-3 py-1.5 border border-border text-gray-500 hover:text-gray-300 rounded-lg transition-colors">
              ✏ Edit
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs px-3 py-1.5 border border-border text-gray-500 hover:text-gray-300 rounded-lg transition-colors disabled:opacity-40"
            >
              {isFetching ? '⟳ Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* Pricing tab content */}
        {mainTab === 'pricing' && (
          <PricingDashboard companyId={companyId} company={company} />
        )}

        {/* Alternatives tab content */}
        {mainTab === 'alternatives' && (
          <div className="space-y-4">
            {/* Material selector */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Select Material</div>
              <div className="flex flex-wrap gap-2">
                {(impact.materials || []).map(m => (
                  <button
                    key={m.material_id || m.material_name}
                    onClick={() => setAltMaterial(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      altMaterial?.material_name === m.material_name
                        ? 'bg-blue-700 border-blue-500 text-white'
                        : 'border-border text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    }`}
                  >
                    {m.material_name}
                    <span className={`ml-1.5 text-[10px] ${
                      m.risk_level === 'CRITICAL' ? 'text-red-400' :
                      m.risk_level === 'HIGH' ? 'text-orange-400' :
                      m.risk_level === 'MEDIUM' ? 'text-amber-400' : 'text-green-400'
                    }`}>● {m.risk_level}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Alternatives for selected material */}
            {altMaterial ? (
              <AlternativeSuppliers
                materialName={altMaterial.material_name}
                currentSources={(altMaterial.source_risks || []).map(s => ({ country_iso3: s.iso3 }))}
              />
            ) : (
              <div className="text-center py-12 text-gray-600 text-sm">
                Select a material above to see ranked alternative suppliers
              </div>
            )}
          </div>
        )}

        {/* Cost Impact tab content */}
        {mainTab === 'impact' && <>

        {/* Top section: gauge + KPIs + exposure */}
        <div className="grid grid-cols-4 gap-4">
          {/* Annual exposure — spans 1 col */}
          <div className={`col-span-1 border rounded-xl p-4 flex flex-col items-center justify-center text-center ${rColors.border} ${rColors.bg}`}>
            <div className={`text-2xl font-bold ${rColors.text} mb-1`}>{fmt(impact.total_annual_increase)}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Additional annual cost</div>
            <div className={`text-xs font-medium mt-1 ${rColors.text}`}>
              +{impact.increase_pct?.toFixed(1)}% above baseline
            </div>
          </div>

          {/* Risk gauge */}
          <div className="col-span-1 bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center">
            <RiskGauge level={rlevel} />
            <div className="text-[10px] text-gray-500 mt-1">Overall Risk</div>
          </div>

          {/* KPIs */}
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <KPICard
              label="Monthly baseline"
              value={fmt(impact.total_monthly_baseline)}
              sub={`${impact.materials?.length || 0} materials`}
            />
            <KPICard
              label="Monthly increase"
              value={`+${fmt(impact.total_monthly_increase)}`}
              sub={`+${impact.increase_pct?.toFixed(1)}%`}
              color={impact.total_monthly_increase > 0 ? 'text-red-400' : 'text-green-400'}
            />
            {impact.most_at_risk_material && (
              <KPICard
                label="Most at risk"
                value={impact.most_at_risk_material.material_name}
                sub={impact.most_at_risk_material.risk_level}
                color={RISK_COLORS[impact.most_at_risk_material.risk_level]?.text || 'text-gray-300'}
              />
            )}
            {impact.most_at_risk_country && (
              <KPICard
                label="Riskiest source"
                value={impact.most_at_risk_country.country_name || impact.most_at_risk_country.iso3}
                sub={`Risk score: ${impact.most_at_risk_country.risk_score}`}
                color="text-orange-400"
              />
            )}
          </div>
        </div>

        {/* Bar chart */}
        {barData.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Annual Cost Impact by Material</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v/1000).toFixed(0)+'K' : v}`} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip
                  formatter={v => [fmt(v), 'Annual impact']}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={RISK_COLORS[d.risk]?.bar || '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Material breakdown */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* Table controls */}
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Material Breakdown</span>
            <div className="flex gap-1 ml-auto">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(r => (
                <button
                  key={r}
                  onClick={() => setFilterRisk(r)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    filterRisk === r
                      ? r === 'ALL' ? 'bg-blue-700 border-blue-500 text-white' : `${RISK_COLORS[r]?.bg} ${RISK_COLORS[r]?.border} ${RISK_COLORS[r]?.text}`
                      : 'border-border text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-border">
            <button onClick={() => sortHeader('material_name')} className="text-left hover:text-gray-300">
              Material {sortBy === 'material_name' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button onClick={() => sortHeader('baseline_monthly_cost')} className="w-28 text-right hover:text-gray-300">
              Baseline {sortBy === 'baseline_monthly_cost' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button onClick={() => sortHeader('effective_price_impact_pct')} className="w-20 text-right hover:text-gray-300">
              Price Δ {sortBy === 'effective_price_impact_pct' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button onClick={() => sortHeader('annual_cost_increase')} className="w-28 text-right hover:text-gray-300">
              Annual +Cost {sortBy === 'annual_cost_increase' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <div className="w-8" />
          </div>

          {/* Material rows */}
          <div className="divide-y divide-border">
            {materials.length === 0 ? (
              <p className="text-xs text-gray-500 p-4 text-center">No materials match filter.</p>
            ) : materials.map((m, i) => (
              <MaterialImpactCard key={m.material_id || i} impact={m} />
            ))}
          </div>
        </div>

        {/* AI Narrative */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Executive Summary</div>
            <div className="flex items-center gap-2">
              {impact.calculated_at && (
                <span className="text-[10px] text-gray-600">
                  Updated {new Date(impact.calculated_at).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={loadNarrative}
                disabled={narrativeLoading}
                className="text-xs px-3 py-1.5 bg-blue-900/30 border border-blue-800 text-blue-300 hover:text-blue-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {narrativeLoading ? '⟳ Generating…' : narrative ? '↻ Regenerate' : '✦ Generate AI Summary'}
              </button>
            </div>
          </div>

          {narrativeError && (
            <p className="text-xs text-red-400 mb-2">{narrativeError}</p>
          )}

          {narrative ? (
            <p className="text-sm text-gray-300 leading-relaxed">{narrative}</p>
          ) : !narrativeLoading && (
            <p className="text-xs text-gray-600 italic">
              Click "Generate AI Summary" for a CFO-level executive summary with specific financial exposure and recommended actions.
            </p>
          )}
        </div>

        </> /* end mainTab === 'impact' */}
      </div>
    </div>
  );
}
