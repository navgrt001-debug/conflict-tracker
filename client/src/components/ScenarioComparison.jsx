const CASE_COLORS = {
  base_case: { label: 'BASE', bg: 'bg-blue-950/40', border: 'border-blue-800', badge: 'bg-blue-900 text-blue-300 border-blue-700', bar: 'bg-blue-500', heading: 'text-blue-300' },
  bull_case: { label: 'BULL', bg: 'bg-green-950/40', border: 'border-green-800', badge: 'bg-green-900 text-green-300 border-green-700', bar: 'bg-green-500', heading: 'text-green-300' },
  bear_case: { label: 'BEAR', bg: 'bg-red-950/40', border: 'border-red-900', badge: 'bg-red-900 text-red-300 border-red-700', bar: 'bg-red-500', heading: 'text-red-300' },
};

function extractResult(entry) {
  return entry?.result?.result || entry?.result || {};
}

function getAllAssets(scenarios) {
  const set = new Set();
  Object.values(scenarios || {}).forEach(c => {
    (c?.market_impacts || []).forEach(i => set.add(i.asset));
  });
  return [...set];
}

function getImpactForAsset(scenarios, asset) {
  const out = {};
  Object.entries(scenarios || {}).forEach(([key, c]) => {
    const hit = (c?.market_impacts || []).find(i => i.asset === asset);
    if (hit) out[key] = hit;
  });
  return out;
}

function isConflicting(impactMap) {
  const directions = Object.values(impactMap).map(i => i.direction);
  if (directions.length < 2) return false;
  return new Set(directions).size > 1;
}

function isCross(impactMapA, impactMapB) {
  const allKeys = [...new Set([...Object.keys(impactMapA), ...Object.keys(impactMapB)])];
  return allKeys.length > 0 && Object.keys(impactMapA).length > 0 && Object.keys(impactMapB).length > 0;
}

function DirectionBadge({ direction, magnitude }) {
  const up = direction === 'up';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '↑' : '↓'} {magnitude}
    </span>
  );
}

function ScenarioColumn({ entry, label, onRemove }) {
  if (!entry) {
    return (
      <div className="flex-1 border border-dashed border-border rounded-xl flex items-center justify-center text-gray-600 text-sm min-h-[200px]">
        No scenario selected
      </div>
    );
  }
  const r = extractResult(entry);
  return (
    <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
          <p className="text-xs font-bold text-white leading-snug line-clamp-2">{r.scenario || entry.question}</p>
        </div>
        <button onClick={onRemove} className="text-gray-600 hover:text-gray-400 text-xs shrink-0 mt-0.5">✕</button>
      </div>
      {/* Meta */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3">
        <div className={`text-xl font-bold ${
          r.probability >= 60 ? 'text-red-400' : r.probability >= 30 ? 'text-amber-400' : 'text-green-400'
        }`}>{r.probability}%</div>
        <div>
          <div className="text-[10px] text-gray-500">Probability</div>
          <div className="text-[10px] text-blue-300 font-medium">{r.timeframe}</div>
        </div>
      </div>
    </div>
  );
}

export default function ScenarioComparison({ scenarios, onRemove }) {
  const [a, b] = scenarios;
  const ra = a ? extractResult(a) : null;
  const rb = b ? extractResult(b) : null;

  const allAssetsA = getAllAssets(ra?.scenarios);
  const allAssetsB = getAllAssets(rb?.scenarios);
  const sharedAssets = allAssetsA.filter(asset => allAssetsB.includes(asset));
  const uniqueA = allAssetsA.filter(asset => !allAssetsB.includes(asset));
  const uniqueB = allAssetsB.filter(asset => !allAssetsA.includes(asset));

  return (
    <div className="space-y-5">
      {/* Column headers */}
      <div className="flex gap-4">
        <ScenarioColumn entry={a} label="Scenario A" onRemove={() => onRemove(0)} />
        <ScenarioColumn entry={b} label="Scenario B" onRemove={() => onRemove(1)} />
      </div>

      {(!a || !b) ? (
        <div className="text-center py-12 text-gray-600 text-sm">
          Save two scenarios using "⊕ Compare" to compare them side by side.
        </div>
      ) : (
        <>
          {/* Case probabilities */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-border text-[10px] text-gray-500 uppercase tracking-wider font-bold">
              Case Probabilities
            </div>
            <div className="divide-y divide-border">
              {['base_case', 'bull_case', 'bear_case'].map(key => {
                const cfg = CASE_COLORS[key];
                const pA = ra?.scenarios?.[key]?.probability ?? 0;
                const pB = rb?.scenarios?.[key]?.probability ?? 0;
                return (
                  <div key={key} className="px-4 py-3 flex items-center gap-4">
                    <span className={`text-[10px] font-bold ${cfg.heading} w-10`}>{cfg.label}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-black/30 rounded overflow-hidden">
                        <div className={`h-full ${cfg.bar} rounded`} style={{ width: `${pA}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{pA}%</span>
                    </div>
                    <div className="text-gray-600 text-xs">vs</div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-8">{pB}%</span>
                      <div className="flex-1 h-1.5 bg-black/30 rounded overflow-hidden">
                        <div className={`h-full ${cfg.bar} rounded`} style={{ width: `${pB}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared asset impacts */}
          {sharedAssets.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Shared Assets</span>
                <span className="text-[10px] text-gray-600">{sharedAssets.length} asset{sharedAssets.length !== 1 ? 's' : ''} affected by both</span>
              </div>
              <div className="divide-y divide-border">
                {sharedAssets.map(asset => {
                  const mapA = getImpactForAsset(ra?.scenarios, asset);
                  const mapB = getImpactForAsset(rb?.scenarios, asset);
                  const conflicting = isConflicting({ ...mapA, ...mapB });
                  return (
                    <div key={asset} className={`px-4 py-3 ${conflicting ? 'bg-amber-950/20' : ''}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-white">{asset}</span>
                        {conflicting && (
                          <span className="text-[10px] bg-amber-900/50 border border-amber-700 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                            ⚠ Conflict
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Scenario A */}
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-gray-600 mb-1">Scenario A</div>
                          {['base_case', 'bull_case', 'bear_case'].map(key => {
                            const imp = mapA[key];
                            if (!imp) return null;
                            return (
                              <div key={key} className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold ${CASE_COLORS[key].heading}`}>{CASE_COLORS[key].label}</span>
                                <DirectionBadge direction={imp.direction} magnitude={imp.magnitude} />
                              </div>
                            );
                          })}
                        </div>
                        {/* Scenario B */}
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-gray-600 mb-1">Scenario B</div>
                          {['base_case', 'bull_case', 'bear_case'].map(key => {
                            const imp = mapB[key];
                            if (!imp) return null;
                            return (
                              <div key={key} className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold ${CASE_COLORS[key].heading}`}>{CASE_COLORS[key].label}</span>
                                <DirectionBadge direction={imp.direction} magnitude={imp.magnitude} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unique assets */}
          {(uniqueA.length > 0 || uniqueB.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {[{ assets: uniqueA, r: ra, label: 'Only in Scenario A' }, { assets: uniqueB, r: rb, label: 'Only in Scenario B' }].map(({ assets, r: rr, label }) => (
                assets.length > 0 && (
                  <div key={label} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-border text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      {label}
                    </div>
                    <div className="px-4 py-2 flex flex-wrap gap-1.5">
                      {assets.map(asset => {
                        const impMap = getImpactForAsset(rr?.scenarios, asset);
                        const dirs = Object.values(impMap).map(i => i.direction);
                        const up = dirs.filter(d => d === 'up').length;
                        const down = dirs.filter(d => d === 'down').length;
                        return (
                          <span key={asset} className="text-[11px] bg-card border border-border text-gray-300 px-2 py-1 rounded-lg flex items-center gap-1">
                            {asset}
                            {up > 0 && <span className="text-green-400 text-[9px]">↑{up}</span>}
                            {down > 0 && <span className="text-red-400 text-[9px]">↓{down}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Overlapping monitoring signals */}
          {(() => {
            const sigA = new Set(ra?.monitoring_signals || []);
            const sigB = new Set(rb?.monitoring_signals || []);
            const shared = [...sigA].filter(s => sigB.has(s));
            if (!shared.length) return null;
            return (
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">
                  Shared Monitoring Signals
                </div>
                <div className="space-y-1">
                  {shared.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                      <span className="text-blue-400 shrink-0">⚑</span>{s}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
