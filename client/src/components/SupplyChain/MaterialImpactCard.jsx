import { useState } from 'react';
import CountryRiskBadge from './CountryRiskBadge';
import AlternativeSuppliers from './AlternativeSuppliers';

const RISK_STYLES = {
  CRITICAL: { badge: 'bg-red-900/60 text-red-300 border-red-700', row: 'bg-red-950/10 border-red-900/30' },
  HIGH:     { badge: 'bg-orange-900/60 text-orange-300 border-orange-700', row: 'bg-orange-950/10 border-orange-900/30' },
  MEDIUM:   { badge: 'bg-amber-900/60 text-amber-300 border-amber-700', row: 'bg-amber-950/10 border-amber-900/30' },
  LOW:      { badge: 'bg-green-900/60 text-green-300 border-green-800', row: 'bg-green-950/10 border-green-900/30' },
};

const MATERIAL_ICONS = {
  oil: '🛢️', crude: '🛢️', gas: '⛽', wheat: '🌾', corn: '🌽', soy: '🫘',
  coffee: '☕', sugar: '🍬', cotton: '🧵', palm: '🌴', copper: '🔩',
  aluminum: '⚙️', nickel: '⚙️', lithium: '🔋', gold: '🥇', silver: '🥈',
  steel: '🏗️', lumber: '🪵', rubber: '⚫', coal: '⬛', default: '📦',
};

function getMaterialIcon(name = '') {
  const n = name.toLowerCase();
  return Object.entries(MATERIAL_ICONS).find(([k]) => n.includes(k))?.[1] || MATERIAL_ICONS.default;
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function MaterialImpactCard({ impact, expanded: initExpanded = false }) {
  const [expanded, setExpanded] = useState(initExpanded);
  const [showAlternatives, setShowAlternatives] = useState(false);
  if (!impact) return null;

  // Build current sources list from source_risks for the ranker
  const currentSources = (impact.source_risks || []).map(s => ({ country_iso3: s.iso3 }));

  const styles = RISK_STYLES[impact.risk_level] || RISK_STYLES.LOW;
  const pct = impact.effective_price_impact_pct ?? impact.price_change_pct ?? 0;
  const isPositive = pct > 0;

  return (
    <div className={`border rounded-xl overflow-hidden ${styles.row}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-xl shrink-0">{getMaterialIcon(impact.material_name)}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white">{impact.material_name}</span>
            {impact.symbol && <span className="text-[10px] text-gray-600">{impact.symbol}</span>}
          </div>
          <div className="text-[10px] text-gray-500">
            {impact.monthly_volume?.toLocaleString()} {impact.unit}/mo · baseline {fmt(impact.baseline_monthly_cost)}/mo
          </div>
        </div>

        {/* Risk badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${styles.badge}`}>
          {impact.risk_level}
        </span>

        {/* Price impact */}
        <div className="text-right shrink-0 w-28">
          <div className={`text-sm font-bold ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
            {isPositive ? '+' : ''}{pct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500">
            {isPositive ? '+' : ''}{fmt(impact.annual_cost_increase)}/yr
          </div>
        </div>

        {/* Disruption risk */}
        <div className="text-right shrink-0 w-16">
          <div className="text-xs font-bold text-gray-300">{impact.disruption_risk_pct}%</div>
          <div className="text-[10px] text-gray-600">disruption</div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setShowAlternatives(s => !s); }}
          className={`text-[10px] px-2 py-1 rounded border shrink-0 transition-colors ${
            showAlternatives
              ? 'bg-blue-800 border-blue-600 text-blue-200'
              : 'border-border text-gray-500 hover:text-gray-300'
          }`}
        >
          {showAlternatives ? '▲ Alts' : '⇄ Alts'}
        </button>

        <span className="text-gray-600 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 space-y-3 pt-3">
          {/* Cost breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Baseline / mo', value: fmt(impact.baseline_monthly_cost) },
              { label: 'Increase / mo', value: `+${fmt(impact.monthly_cost_increase)}`, red: impact.monthly_cost_increase > 0 },
              { label: 'Annual exposure', value: `+${fmt(impact.annual_cost_increase)}`, red: impact.annual_cost_increase > 0 },
            ].map(k => (
              <div key={k.label} className="bg-black/20 rounded-lg p-2 text-center">
                <div className={`text-sm font-bold ${k.red ? 'text-red-400' : 'text-gray-200'}`}>{k.value}</div>
                <div className="text-[10px] text-gray-600">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Price change detail */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">Market price change:</span>
            <span className={`font-bold ${impact.price_change_pct > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {impact.price_change_pct > 0 ? '+' : ''}{impact.price_change_pct?.toFixed(2)}%
            </span>
            {impact.effective_price_impact_pct !== impact.price_change_pct && (
              <>
                <span className="text-gray-600">→ risk-adjusted:</span>
                <span className={`font-bold ${impact.effective_price_impact_pct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {impact.effective_price_impact_pct > 0 ? '+' : ''}{impact.effective_price_impact_pct?.toFixed(2)}%
                </span>
              </>
            )}
          </div>

          {/* Source country risks */}
          {impact.source_risks?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Source Countries</div>
              <div className="space-y-2">
                {impact.source_risks.map((sc, i) => (
                  <CountryRiskBadge
                    key={i}
                    iso3={sc.iso3}
                    riskScore={sc.risk_score}
                    riskData={sc}
                    supplyPct={sc.supply_percentage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {impact.suppliers?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Suppliers</div>
              <div className="space-y-1">
                {impact.suppliers.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium text-white">{s.name}</span>
                    <span className="text-gray-600">·</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                      s.contract_type === 'long-term' ? 'border-green-800 text-green-400' :
                      s.contract_type === 'forward' ? 'border-blue-800 text-blue-400' :
                      'border-gray-700 text-gray-400'
                    }`}>{s.contract_type}</span>
                    <span>Lead: {s.lead_time_days}d</span>
                    <span>Reliability: {s.reliability_score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alternative suppliers panel */}
      {showAlternatives && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Alternative Suppliers</div>
          <AlternativeSuppliers
            materialName={impact.material_name}
            currentSources={currentSources}
          />
        </div>
      )}
    </div>
  );
}
