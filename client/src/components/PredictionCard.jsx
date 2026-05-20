import { useState, useEffect } from 'react';

function useCountdown(resolveDate) {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = new Date(resolveDate).getTime() - Date.now();
      if (ms <= 0) { setDisplay('Expired'); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setDisplay(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [resolveDate]);
  return display;
}

const STATUS_STYLE = {
  pending:  { label: 'PENDING',  cls: 'bg-yellow-900 text-yellow-300 border-yellow-700' },
  resolved: { label: null,       cls: null },
  expired:  { label: 'EXPIRED',  cls: 'bg-gray-800 text-gray-500 border-gray-700' },
};

function resolvedStyle(score) {
  if (score === 100) return { label: 'CORRECT ✓',    cls: 'bg-green-900 text-green-300 border-green-700' };
  if (score === 60)  return { label: 'DIRECTION ✓',  cls: 'bg-blue-900 text-blue-300 border-blue-700' };
  return               { label: 'WRONG ✗',           cls: 'bg-red-900 text-red-400 border-red-700' };
}

export default function PredictionCard({ prediction, onResolve, compact = false }) {
  const countdown = useCountdown(prediction.resolve_date);
  const isUp = prediction.direction === 'up';

  let badge;
  if (prediction.status === 'resolved') {
    badge = resolvedStyle(prediction.accuracy_score);
  } else {
    badge = STATUS_STYLE[prediction.status] || STATUS_STYLE.pending;
  }

  return (
    <div className={`bg-surface border border-border rounded-lg p-3 flex flex-col gap-2 ${
      prediction.status === 'resolved' && prediction.accuracy_score === 100 ? 'border-green-900' :
      prediction.status === 'resolved' && prediction.accuracy_score === 0   ? 'border-red-900' : ''
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white">{prediction.asset_label}</span>
            <span className="text-[10px] text-gray-600">{prediction.asset}</span>
          </div>
          <p className="text-[10px] text-gray-500 line-clamp-1">{prediction.conflict_event}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${badge.cls}`}>
          {badge.label || ''}
        </span>
      </div>

      {/* Direction + magnitude */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 text-lg font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          <span>{isUp ? '↑' : '↓'}</span>
          <span className="text-sm">{prediction.magnitude}</span>
        </div>
        <div className="text-xs text-gray-500">in {prediction.timeframe_days}d</div>
        {prediction.status === 'pending' && (
          <div className="ml-auto text-[10px] text-gray-600 font-mono">{countdown}</div>
        )}
      </div>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-600 mb-1">
          <span>Confidence</span>
          <span>{prediction.confidence}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
          <div
            className={`h-full rounded transition-all ${
              prediction.confidence >= 70 ? 'bg-green-500' :
              prediction.confidence >= 50 ? 'bg-yellow-500' : 'bg-orange-500'
            }`}
            style={{ width: `${prediction.confidence}%` }}
          />
        </div>
      </div>

      {/* Reasoning — hide in compact mode */}
      {!compact && prediction.reasoning && (
        <p className="text-[11px] text-gray-400 leading-relaxed border-t border-border pt-2">
          {prediction.reasoning}
        </p>
      )}

      {/* Actual outcome overlay */}
      {prediction.status === 'resolved' && prediction.actual_outcome && (
        <div className={`flex items-center justify-between text-xs rounded px-2 py-1.5 border ${
          prediction.accuracy_score >= 60 ? 'bg-green-950 border-green-800' : 'bg-red-950 border-red-900'
        }`}>
          <span className="text-gray-400">Actual outcome:</span>
          <span className={`font-bold ${prediction.actual_outcome.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {prediction.actual_outcome.direction === 'up' ? '↑' : '↓'} {prediction.actual_outcome.magnitude}
          </span>
          <span className="font-bold text-white">+{prediction.accuracy_score}pts</span>
        </div>
      )}

      {/* Historical basis */}
      {!compact && prediction.historical_basis && (
        <div className="text-[10px] text-gray-600 italic">
          Based on: {prediction.historical_basis}
        </div>
      )}

      {/* Key risks */}
      {!compact && prediction.key_risks?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {prediction.key_risks.map((r, i) => (
            <span key={i} className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
              ⚠ {r}
            </span>
          ))}
        </div>
      )}

      {/* Manual resolve button */}
      {onResolve && prediction.status === 'pending' && new Date(prediction.resolve_date) <= new Date() && (
        <button
          onClick={() => onResolve(prediction.id)}
          className="text-[11px] w-full py-1 bg-blue-900 hover:bg-blue-800 border border-blue-700 text-blue-300 rounded transition-colors"
        >
          Resolve now →
        </button>
      )}
    </div>
  );
}
