import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MarginForecast from './MarginForecast';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function fmt(n, currency = 'USD') {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n) {
  if (n == null) return '—';
  const s = n >= 0 ? '+' : '';
  return `${s}${n.toFixed(1)}%`;
}

const SCENARIO_META = {
  maintain_target:  { label: 'Maintain Target Margin', color: 'border-green-700 bg-green-950/20', badge: 'bg-green-700 text-green-100', recommended: true },
  maintain_minimum: { label: 'Maintain Minimum Margin', color: 'border-blue-700 bg-blue-950/20', badge: 'bg-blue-700 text-blue-100', recommended: false },
  absorb_half:      { label: 'Absorb Half',  color: 'border-amber-700 bg-amber-950/20', badge: 'bg-amber-700 text-amber-100', recommended: false },
  absorb_all:       { label: 'Absorb All — Not Recommended', color: 'border-red-800 bg-red-950/10', badge: 'bg-red-900 text-red-200', recommended: false },
};

const URGENCY_STYLES = {
  immediate:        'bg-red-900/40 border-red-700 text-red-300',
  within_30_days:   'bg-amber-900/40 border-amber-700 text-amber-300',
  within_90_days:   'bg-blue-900/40 border-blue-700 text-blue-300',
};

const SENSITIVITY_COLORS = {
  low:    'text-green-400',
  medium: 'text-amber-400',
  high:   'text-red-400',
};

function ScenarioCard({ scenario, currency }) {
  const meta = SCENARIO_META[scenario.scenario] || {};
  return (
    <div className={`border rounded-xl p-4 flex flex-col gap-2 ${meta.color}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-white leading-tight">{meta.label}</span>
        {meta.recommended && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-700 text-green-100 shrink-0">RECOMMENDED</span>
        )}
      </div>
      <div className="space-y-1.5 mt-1">
        <Metric label="New price" value={fmt(scenario.new_price, currency)} bold />
        <Metric label="Increase" value={fmtPct(scenario.price_increase_pct)} color={scenario.price_increase_pct > 0 ? 'text-red-300' : 'text-green-300'} />
        <Metric label="Resulting margin" value={`${scenario.resulting_margin_pct?.toFixed(1)}%`} />
        <Metric label="Annual revenue Δ" value={fmt(scenario.annual_revenue_impact, currency)} color={scenario.annual_revenue_impact > 0 ? 'text-green-300' : 'text-red-300'} />
      </div>
      <p className="text-[10px] text-gray-500 mt-1 italic">{scenario.recommendation}</p>
    </div>
  );
}

function Metric({ label, value, bold, color = 'text-gray-200' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold text-white' : color}`}>{value}</span>
    </div>
  );
}

function StrategySection({ strategy, currency }) {
  const [tipsOpen, setTipsOpen] = useState(false);

  if (!strategy) return null;
  const urgencyStyle = URGENCY_STYLES[strategy.urgency] || URGENCY_STYLES.within_90_days;

  return (
    <div className="space-y-4">
      {/* Overall recommendation */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">AI Pricing Strategy</div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${urgencyStyle}`}>
            {strategy.urgency?.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{strategy.overall_recommendation}</p>
      </div>

      {/* Market strategies table */}
      {strategy.market_strategies?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-[10px] text-gray-500 uppercase tracking-wider font-bold">
            Market-by-Market Strategy
          </div>
          <div className="divide-y divide-border">
            {strategy.market_strategies.map((ms, i) => (
              <div key={i} className="px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-start">
                <div>
                  <div className="text-sm font-medium text-white">{ms.market}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{ms.rationale}</div>
                  {ms.competitor_context && (
                    <div className="text-[10px] text-gray-600 mt-0.5">{ms.competitor_context}</div>
                  )}
                  {ms.risk && <div className="text-[10px] text-amber-500 mt-0.5">⚠ {ms.risk}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-green-300">{fmtPct(ms.recommended_increase_pct)}</div>
                  <div className="text-[10px] text-gray-600">increase</div>
                </div>
                <div className="text-right shrink-0 text-[10px] text-gray-500 whitespace-nowrap">{ms.timing}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phasing plan */}
      {strategy.phasing_plan?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-3">Phasing Plan</div>
          <div className="relative pl-5">
            <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
            <div className="space-y-4">
              {strategy.phasing_plan.map((phase, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[14px] w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-card mt-0.5" />
                  <div className="text-[10px] text-blue-400 font-bold mb-0.5">Phase {phase.phase} · {phase.timing}</div>
                  <div className="text-xs text-gray-300">
                    Markets: <span className="text-white">{(phase.markets || []).join(', ')}</span>
                    <span className="mx-2 text-gray-600">·</span>
                    <span className="text-green-300 font-medium">{fmtPct(phase.increase_pct)}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{phase.rationale}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Communication tips */}
      {strategy.communication_tips?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setTipsOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Communication Tips</span>
            <span className="text-gray-500 text-xs">{tipsOpen ? '▲' : '▼'}</span>
          </button>
          {tipsOpen && (
            <ul className="px-4 pb-4 space-y-2">
              {strategy.communication_tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-blue-400 shrink-0">→</span> {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Risks to monitor */}
      {strategy.risks_to_monitor?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Risks to Monitor</div>
          <ul className="space-y-1.5">
            {strategy.risks_to_monitor.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                <span className="text-red-400 shrink-0">⚠</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PriceOptimizer({ product, companyId, onBack }) {
  const [showStrategy, setShowStrategy] = useState(false);
  const [activeTab, setActiveTab] = useState('scenarios'); // 'scenarios' | 'strategy' | 'forecast'

  const { data: scenarioData, isLoading: scenLoading } = useQuery({
    queryKey: ['pricing-scenarios', companyId, product.id],
    queryFn: async () => {
      const res = await fetch(`${API}/pricing/scenarios/${companyId}/${product.id}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: strategyData, isLoading: stratLoading, refetch: refetchStrategy } = useQuery({
    queryKey: ['pricing-strategy', companyId, product.id],
    queryFn: async () => {
      const res = await fetch(`${API}/pricing/optimize/${companyId}/${product.id}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: activeTab === 'strategy',
    staleTime: 30 * 60_000,
  });

  const costImpact = scenarioData?.cost_impact;
  const currency = product.currency || 'USD';

  return (
    <div className="space-y-4">
      {/* Product header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-200 text-sm">← Back</button>
        <div>
          <h3 className="text-white font-bold text-base">{product.name}</h3>
          {product.sku && <span className="text-xs text-gray-500">{product.sku} · </span>}
          <span className="text-xs text-gray-500">{fmt(product.current_selling_price, currency)} current price</span>
        </div>
      </div>

      {/* Cost pressure banner */}
      {costImpact && (
        <div className={`rounded-xl border p-4 ${
          Math.abs(costImpact.increase_pct) > 10 ? 'border-red-800 bg-red-950/20' :
          Math.abs(costImpact.increase_pct) > 3  ? 'border-amber-800 bg-amber-950/20' :
          'border-green-800 bg-green-950/20'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium mb-1">
                Raw material costs are{' '}
                <span className={costImpact.increase_pct > 0 ? 'text-red-300 font-bold' : 'text-green-300 font-bold'}>
                  {costImpact.increase_pct > 0 ? 'up' : 'down'} {Math.abs(costImpact.increase_pct).toFixed(1)}%
                </span>
                {' '}from conflict exposure
              </p>
              {costImpact.drivers?.length > 0 && (
                <ul className="space-y-0.5 mt-1">
                  {costImpact.drivers.map((d, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className={d.effective_change_pct > 0 ? 'text-red-400' : 'text-green-400'}>●</span>
                      <span className="text-white">{d.material}</span>
                      <span>{fmtPct(d.effective_change_pct)}</span>
                      {d.most_at_risk_country && <span className="text-gray-600">· {d.most_at_risk_country}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {scenarioData && (
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-red-300">
                  +{fmt(scenarioData.cost_increase_per_unit, currency)}
                </div>
                <div className="text-[10px] text-gray-500">per unit cost increase</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Margin → <span className="text-amber-300">{scenarioData.compressed_margin_pct?.toFixed(1)}%</span> if no action
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'scenarios', label: '📊 Scenarios' },
          { id: 'strategy',  label: '🤖 AI Strategy' },
          { id: 'forecast',  label: '📈 Forecast' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scenarios tab */}
      {activeTab === 'scenarios' && (
        scenLoading
          ? <LoadingSpinner text="Calculating pricing scenarios…" />
          : scenarioData && (
            <div className="grid grid-cols-2 gap-3">
              {scenarioData.scenarios.map(s => (
                <ScenarioCard key={s.scenario} scenario={s} currency={currency} />
              ))}
            </div>
          )
      )}

      {/* AI Strategy tab */}
      {activeTab === 'strategy' && (
        stratLoading
          ? <LoadingSpinner text="Generating AI pricing strategy…" />
          : strategyData
            ? <StrategySection strategy={strategyData.strategy} currency={currency} />
            : <div className="text-center py-8 text-gray-500 text-sm">Failed to load strategy</div>
      )}

      {/* Forecast tab */}
      {activeTab === 'forecast' && (
        <MarginForecast companyId={companyId} productId={product.id} />
      )}
    </div>
  );
}

function LoadingSpinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
