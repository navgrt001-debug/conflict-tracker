import { jsPDF } from 'jspdf';

const CASE_CONFIG = {
  base_case: {
    label: 'BASE CASE',
    bg: 'bg-blue-950/40',
    border: 'border-blue-800',
    badge: 'bg-blue-900 text-blue-300 border-blue-700',
    bar: 'bg-blue-500',
    heading: 'text-blue-300',
  },
  bull_case: {
    label: 'BULL CASE',
    bg: 'bg-green-950/40',
    border: 'border-green-800',
    badge: 'bg-green-900 text-green-300 border-green-700',
    bar: 'bg-green-500',
    heading: 'text-green-300',
  },
  bear_case: {
    label: 'BEAR CASE',
    bg: 'bg-red-950/40',
    border: 'border-red-900',
    badge: 'bg-red-900 text-red-300 border-red-700',
    bar: 'bg-red-500',
    heading: 'text-red-300',
  },
};

function exportToPDF(entry) {
  const { question, result, analyzed_at } = entry;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 190;
  let y = 20;

  const line = (txt, size = 10, bold = false, color = [220, 220, 220]) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(String(txt), W);
    lines.forEach(l => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(l, 10, y);
      y += size * 0.45;
    });
    y += 2;
  };

  const section = (title) => {
    y += 3;
    doc.setFillColor(30, 41, 59);
    doc.rect(10, y - 4, W, 8, 'F');
    line(title, 11, true, [148, 163, 184]);
  };

  // Cover
  doc.setFillColor(10, 14, 26);
  doc.rect(0, 0, 210, 297, 'F');

  line('GEOPOLITICAL SCENARIO ANALYSIS', 16, true, [255, 255, 255]);
  line(result.result?.scenario || question, 13, false, [147, 197, 253]);
  y += 4;
  line(`Overall Probability: ${result.result?.probability ?? '—'}%  |  Timeframe: ${result.result?.timeframe ?? '—'}`, 10, false, [156, 163, 175]);
  line(`Analyzed: ${new Date(analyzed_at).toLocaleString()}`, 9, false, [107, 114, 128]);
  y += 6;

  // Cases
  ['base_case', 'bull_case', 'bear_case'].forEach(key => {
    const c = result.result?.scenarios?.[key];
    if (!c) return;
    section(`${CASE_CONFIG[key].label}  (${c.probability}%)`);
    line(c.description, 9, false, [209, 213, 219]);
    y += 2;
    (c.market_impacts || []).forEach(imp => {
      line(`  ${imp.direction === 'up' ? '↑' : '↓'} ${imp.asset}: ${imp.magnitude} — ${imp.reasoning}`, 8, false, [156, 163, 175]);
    });
  });

  // Historical analogues
  section('HISTORICAL ANALOGUES');
  (result.result?.historical_analogues || []).forEach(a => {
    line(`${a.event} (${a.year}) — Similarity: ${a.similarity}%`, 9, true, [250, 204, 21]);
    line(`  ${a.outcome}`, 9, false, [209, 213, 219]);
  });

  // Hedges
  section('RECOMMENDED HEDGES');
  (result.result?.recommended_hedges || []).forEach(h => line(`  • ${h}`, 9, false, [209, 213, 219]));

  // Signals
  section('MONITORING SIGNALS');
  (result.result?.monitoring_signals || []).forEach(s => line(`  ⚑ ${s}`, 9, false, [209, 213, 219]));

  doc.save(`scenario-${Date.now()}.pdf`);
}

function ImpactRow({ impact }) {
  const up = impact.direction === 'up';
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className={`text-sm font-bold shrink-0 ${up ? 'text-green-400' : 'text-red-400'}`}>
        {up ? '↑' : '↓'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-white">{impact.asset}</span>
          <span className={`text-xs font-bold ${up ? 'text-green-400' : 'text-red-400'}`}>{impact.magnitude}</span>
        </div>
        <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{impact.reasoning}</p>
      </div>
    </div>
  );
}

function CaseColumn({ caseKey, data }) {
  const cfg = CASE_CONFIG[caseKey];
  if (!data) return null;

  return (
    <div className={`flex-1 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col overflow-hidden`}>
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${cfg.heading} tracking-wider`}>{cfg.label}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cfg.badge}`}>
            {data.probability}%
          </span>
        </div>
        <div className="h-1.5 bg-black/30 rounded overflow-hidden">
          <div className={`h-full ${cfg.bar} rounded`} style={{ width: `${data.probability}%` }} />
        </div>
      </div>
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <p className="text-xs text-gray-300 leading-relaxed mb-3">{data.description}</p>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Market Impacts</div>
        <div>
          {(data.market_impacts || []).map((imp, i) => (
            <ImpactRow key={i} impact={imp} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScenarioResult({ entry, onSaveForComparison, isSaved }) {
  if (!entry?.result) return null;
  const { result, question, analyzed_at } = entry;
  const r = result.result || result; // handle both cached and fresh

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-bold text-white leading-snug mb-1">{r.scenario || question}</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Analyzed {new Date(analyzed_at).toLocaleString()}</span>
            {result.fromCache && <span className="text-blue-600">· cached</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              r.probability >= 60 ? 'text-red-400' :
              r.probability >= 30 ? 'text-amber-400' : 'text-green-400'
            }`}>{r.probability}%</div>
            <div className="text-[10px] text-gray-600">Scenario<br/>Probability</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-blue-300">{r.timeframe}</div>
            <div className="text-[10px] text-gray-600">Timeframe</div>
          </div>
        </div>
      </div>

      {/* 3-column case layout */}
      <div className="flex gap-3" style={{ minHeight: 300 }}>
        <CaseColumn caseKey="base_case" data={r.scenarios?.base_case} />
        <CaseColumn caseKey="bull_case" data={r.scenarios?.bull_case} />
        <CaseColumn caseKey="bear_case" data={r.scenarios?.bear_case} />
      </div>

      {/* Bottom sections */}
      <div className="grid grid-cols-2 gap-4">
        {/* Historical analogues */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Historical Analogues</div>
          <div className="space-y-3">
            {(r.historical_analogues || []).map((a, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-400">{a.event} ({a.year})</span>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1 bg-gray-800 rounded overflow-hidden">
                      <div className="h-full bg-amber-500 rounded" style={{ width: `${a.similarity}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">{a.similarity}%</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-snug">{a.outcome}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Recommended hedges */}
          <div className="bg-surface border border-border rounded-xl p-4 flex-1">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recommended Hedges</div>
            <ul className="space-y-1">
              {(r.recommended_hedges || []).map((h, i) => (
                <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                  <span className="text-green-500 shrink-0">▸</span>{h}
                </li>
              ))}
            </ul>
          </div>

          {/* Key triggers */}
          <div className="bg-surface border border-border rounded-xl p-4 flex-1">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Watch For These Signals</div>
            <ul className="space-y-1">
              {(r.monitoring_signals || []).map((s, i) => (
                <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                  <span className="text-blue-400 shrink-0">⚑</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Key triggers */}
      {r.key_triggers?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Key Triggers</div>
          <div className="flex flex-wrap gap-2">
            {r.key_triggers.map((t, i) => (
              <span key={i} className="text-[11px] bg-card border border-border text-gray-300 px-2 py-1 rounded-lg">
                ⚡ {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-2">
        <button
          onClick={() => exportToPDF(entry)}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-gray-400 hover:text-white hover:border-gray-500 text-xs rounded-lg transition-colors"
        >
          ↓ Export PDF
        </button>
        <button
          onClick={() => onSaveForComparison?.(entry)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${
            isSaved
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-surface border-border text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          {isSaved ? '✓ Saved for comparison' : '⊕ Compare'}
        </button>
      </div>
    </div>
  );
}
