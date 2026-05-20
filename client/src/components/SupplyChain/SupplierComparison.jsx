import { useQuery } from '@tanstack/react-query';
import { flagEmoji, findCountry } from './countries';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const CURRENCY_COLORS = { low: 'text-green-400', medium: 'text-amber-400', high: 'text-red-400' };

function flag(iso3) {
  const country = findCountry(iso3);
  return country ? flagEmoji(country.iso2) : '🏳';
}

function WinnerBadge({ winner, side }) {
  if (winner === 'tie') return <span className="text-[9px] text-gray-500">TIE</span>;
  if (winner === side) return <span className="text-[9px] font-bold text-green-400">WIN ✓</span>;
  return null;
}

function CompareRow({ label, a, b, winner, format = v => v, higherIsBetter = true }) {
  const aWins = winner === 'A';
  const bWins = winner === 'B';
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 px-4 border-b border-border last:border-0 ${
      winner !== 'tie' ? 'hover:bg-surface/30' : ''
    }`}>
      {/* A value */}
      <div className={`text-right text-sm font-medium ${aWins ? 'text-green-400' : 'text-gray-300'}`}>
        {format(a)}
        {aWins && <span className="ml-1 text-xs">✓</span>}
      </div>

      {/* Dimension label */}
      <div className="text-center px-2">
        <div className="text-[10px] text-gray-500 whitespace-nowrap">{label}</div>
      </div>

      {/* B value */}
      <div className={`text-left text-sm font-medium ${bWins ? 'text-green-400' : 'text-gray-300'}`}>
        {bWins && <span className="mr-1 text-xs">✓</span>}
        {format(b)}
      </div>
    </div>
  );
}

function ScoreDimRow({ label, a, b, winner }) {
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 px-4 border-b border-border last:border-0`}>
      {/* A bar */}
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-xs font-bold ${winner === 'A' ? 'text-green-400' : 'text-gray-400'}`}>{a}</span>
        <div className="w-24 bg-surface rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${winner === 'A' ? 'bg-green-500' : 'bg-blue-600'}`}
            style={{ width: `${a}%` }}
          />
        </div>
      </div>

      <div className="text-[10px] text-gray-500 text-center whitespace-nowrap px-2">{label}</div>

      {/* B bar */}
      <div className="flex items-center gap-2">
        <div className="w-24 bg-surface rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${winner === 'B' ? 'bg-green-500' : 'bg-blue-600'}`}
            style={{ width: `${b}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${winner === 'B' ? 'text-green-400' : 'text-gray-400'}`}>{b}</span>
      </div>
    </div>
  );
}

export default function SupplierComparison({ material, isoA, isoB, onClose }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['compare', material, isoA, isoB],
    queryFn: async () => {
      const res = await fetch(
        `${API}/supply-chain/compare?material=${encodeURIComponent(material)}&a=${isoA}&b=${isoB}`
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Comparison failed');
      return res.json();
    },
    staleTime: 10 * 60_000,
  });

  const sa = data?.supplier_a;
  const sb = data?.supplier_b;
  const overallWinner = data?.overall_winner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Supplier Comparison</h2>
            <p className="text-xs text-blue-400 mt-0.5">{material}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {isError && (
            <div className="text-center py-8 text-red-400 text-sm">{error?.message}</div>
          )}

          {data && sa && sb && (
            <>
              {/* Country headers */}
              <div className="grid grid-cols-3 px-4 py-4 border-b border-border">
                <div className={`text-center p-3 rounded-xl ${overallWinner === 'A' ? 'bg-green-950/30 border border-green-800' : ''}`}>
                  <div className="text-3xl mb-1">{flag(isoA)}</div>
                  <div className="text-white font-bold text-sm">{sa.country_name}</div>
                  <div className={`text-lg font-bold mt-1 ${overallWinner === 'A' ? 'text-green-400' : 'text-gray-300'}`}>
                    {sa.scores.total}
                  </div>
                  <div className="text-[10px] text-gray-500">Overall score</div>
                  {overallWinner === 'A' && (
                    <div className="mt-1.5 text-[10px] font-bold text-green-400 bg-green-950/50 rounded px-2 py-0.5">RECOMMENDED</div>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-lg">vs</span>
                </div>

                <div className={`text-center p-3 rounded-xl ${overallWinner === 'B' ? 'bg-green-950/30 border border-green-800' : ''}`}>
                  <div className="text-3xl mb-1">{flag(isoB)}</div>
                  <div className="text-white font-bold text-sm">{sb.country_name}</div>
                  <div className={`text-lg font-bold mt-1 ${overallWinner === 'B' ? 'text-green-400' : 'text-gray-300'}`}>
                    {sb.scores.total}
                  </div>
                  <div className="text-[10px] text-gray-500">Overall score</div>
                  {overallWinner === 'B' && (
                    <div className="mt-1.5 text-[10px] font-bold text-green-400 bg-green-950/50 rounded px-2 py-0.5">RECOMMENDED</div>
                  )}
                </div>
              </div>

              {/* Score dimension bars */}
              <div className="border-b border-border">
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Score breakdown</span>
                </div>
                {(data.comparison || []).map(row => (
                  <ScoreDimRow key={row.dimension} label={row.dimension} a={row.a} b={row.b} winner={row.winner} />
                ))}
              </div>

              {/* Key metrics */}
              <div className="border-b border-border">
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Key metrics</span>
                </div>
                <CompareRow
                  label="Price premium"
                  a={`${sa.typical_price_premium >= 0 ? '+' : ''}${sa.typical_price_premium}%`}
                  b={`${sb.typical_price_premium >= 0 ? '+' : ''}${sb.typical_price_premium}%`}
                  winner={sa.typical_price_premium <= sb.typical_price_premium ? 'A' : 'B'}
                />
                <CompareRow
                  label="Lead time"
                  a={`${sa.avg_lead_time_days}d`}
                  b={`${sb.avg_lead_time_days}d`}
                  winner={sa.avg_lead_time_days <= sb.avg_lead_time_days ? 'A' : 'B'}
                />
                <CompareRow
                  label="Quality"
                  a={sa.quality_score}
                  b={sb.quality_score}
                  winner={sa.quality_score >= sb.quality_score ? 'A' : 'B'}
                />
                <CompareRow
                  label="Political stability"
                  a={sa.political_stability_score}
                  b={sb.political_stability_score}
                  winner={sa.political_stability_score >= sb.political_stability_score ? 'A' : 'B'}
                />
                <CompareRow
                  label="Infrastructure"
                  a={sa.infrastructure_score}
                  b={sb.infrastructure_score}
                  winner={sa.infrastructure_score >= sb.infrastructure_score ? 'A' : 'B'}
                />
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 px-4 border-b border-border last:border-0">
                  <div className={`text-right text-sm font-medium ${CURRENCY_COLORS[sa.currency_risk]}`}>{sa.currency_risk?.toUpperCase()}</div>
                  <div className="text-[10px] text-gray-500 text-center px-2">Currency risk</div>
                  <div className={`text-left text-sm font-medium ${CURRENCY_COLORS[sb.currency_risk]}`}>{sb.currency_risk?.toUpperCase()}</div>
                </div>
                <CompareRow
                  label="Live conflict score"
                  a={sa.live_conflict_risk?.risk_score ?? '—'}
                  b={sb.live_conflict_risk?.risk_score ?? '—'}
                  winner={(sa.live_conflict_risk?.risk_score ?? 999) <= (sb.live_conflict_risk?.risk_score ?? 999) ? 'A' : 'B'}
                />
              </div>

              {/* Notes */}
              <div className="grid grid-cols-2 gap-4 px-4 py-4">
                {[sa, sb].map((s, i) => s.notes && (
                  <div key={i}>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.country_name} notes</div>
                    <p className="text-xs text-gray-400 leading-relaxed italic">{s.notes}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
