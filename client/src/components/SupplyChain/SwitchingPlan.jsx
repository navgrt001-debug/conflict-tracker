import { useQuery } from '@tanstack/react-query';
import { flagEmoji, findCountry } from './countries';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const RISK_COLORS = {
  low: 'bg-green-900/30 border-green-800 text-green-400',
  medium: 'bg-amber-900/30 border-amber-800 text-amber-400',
  high: 'bg-red-900/30 border-red-800 text-red-400',
};

const PHASE_ICONS = {
  assess: '🔍', audit: '🔍', evaluation: '🔍',
  contract: '📝', negotiate: '📝', legal: '📝',
  trial: '🧪', pilot: '🧪', test: '🧪',
  transition: '🔄', switch: '🔄', migrate: '🔄',
  monitor: '📊', optimize: '📊', review: '📊',
};

function phaseIcon(phase) {
  const lower = (phase || '').toLowerCase();
  for (const [key, icon] of Object.entries(PHASE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '✅';
}

function flag(iso3) {
  const country = findCountry(iso3);
  return country ? flagEmoji(country.iso2) : '🏳';
}

export default function SwitchingPlan({ material, from, to, onClose }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['switching-plan', material, from, to],
    queryFn: async () => {
      const res = await fetch(
        `${API}/supply-chain/switching-plan?material=${encodeURIComponent(material)}&from=${from}&to=${to}`
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate plan');
      return res.json();
    },
    staleTime: 30 * 60_000,
    retry: 1,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Switching Plan</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {flag(from)} {data?.from?.country_name || from} → {flag(to)} {data?.to?.country_name || to}
              <span className="mx-1.5 text-gray-600">·</span>
              <span className="text-blue-400">{material}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Generating switching plan with AI…</p>
            </div>
          )}

          {isError && (
            <div className="text-center py-8 text-red-400 text-sm">{error?.message}</div>
          )}

          {data?.plan && (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-3">
                <KPI label="Timeline" value={`${data.plan.timeline_weeks} weeks`} />
                <KPI label="Transition cost" value={`~${data.plan.transition_cost_estimate_pct}% of annual spend`} />
                <KPI label="Break-even" value={`${data.plan.break_even_months} months`} />
              </div>

              {/* Recommendation */}
              {data.plan.recommendation && (
                <div className="bg-blue-950/30 border border-blue-900 rounded-xl px-4 py-3">
                  <p className="text-sm text-blue-200 leading-relaxed">{data.plan.recommendation}</p>
                </div>
              )}

              {/* Timeline */}
              {data.plan.steps?.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Implementation Timeline</div>
                  <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

                    <div className="space-y-4">
                      {data.plan.steps.map((step, i) => (
                        <div key={i} className="relative">
                          {/* Dot */}
                          <div className={`absolute -left-[18px] w-2.5 h-2.5 rounded-full border-2 border-card mt-1 ${
                            step.risk === 'high' ? 'bg-red-500' : step.risk === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                          }`} />

                          <div className={`border rounded-xl px-3 py-2.5 ${RISK_COLORS[step.risk] || 'bg-surface border-border'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] text-gray-500">Week {step.week}</span>
                                  <span className="text-[10px] font-medium">{phaseIcon(step.phase)} {step.phase}</span>
                                </div>
                                <p className="text-sm text-gray-200">{step.action}</p>
                                {step.owner && (
                                  <p className="text-[10px] text-gray-500 mt-0.5">Owner: {step.owner}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick wins + Risks */}
              <div className="grid grid-cols-2 gap-4">
                {data.plan.quick_wins?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Quick wins</div>
                    <ul className="space-y-1">
                      {data.plan.quick_wins.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                          <span className="text-green-400 shrink-0">✓</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.plan.key_risks?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Key risks</div>
                    <ul className="space-y-1">
                      {data.plan.key_risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                          <span className="text-red-400 shrink-0">⚠</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2.5 text-center">
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
