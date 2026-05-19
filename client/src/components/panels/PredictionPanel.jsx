import { useState } from 'react';
import { streamPrediction } from '../../services/api';

export default function PredictionPanel({ conflict, marketData, tradeData }) {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [finalScores, setFinalScores] = useState(null);

  const handleGenerate = () => {
    if (!conflict) return;
    setText('');
    setDone(false);
    setError(null);
    setFinalScores(null);
    setStreaming(true);

    streamPrediction(
      conflict.id,
      marketData,
      tradeData,
      (chunk) => setText(prev => prev + chunk),
      (scores) => { setFinalScores(scores); setStreaming(false); setDone(true); },
      (err) => { setError(err); setStreaming(false); }
    );
  };

  if (!conflict) return (
    <div className="flex items-center justify-center h-full text-gray-600 text-sm">
      Select a conflict to generate AI analysis
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">AI Intelligence Report</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              DeepSeek V4 Flash · Streaming
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={streaming}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${
              streaming
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {streaming ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> Analyzing...
              </span>
            ) : done ? 'Regenerate' : 'Generate Report'}
          </button>
        </div>

        {/* Heuristic scores */}
        {conflict.scores && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            <ScorePill label="Severity" value={conflict.scores.severity} />
            <ScorePill label="Economic" value={conflict.scores.economic} />
            <ScorePill label="Escalation" value={conflict.scores.escalation} />
            <ScorePill label="Combined" value={conflict.scores.combined} highlight />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-950 border border-red-800 rounded p-3 mb-4">
            <div className="text-red-400 font-bold text-sm mb-1">Analysis Error</div>
            <div className="text-red-500 text-xs">{error}</div>
            {error.includes('DEEPSEEK_API_KEY') && (
              <div className="text-gray-400 text-xs mt-2">
                Set <code className="bg-gray-800 px-1 rounded">DEEPSEEK_API_KEY</code> in <code className="bg-gray-800 px-1 rounded">server/.env</code>
              </div>
            )}
          </div>
        )}

        {!text && !streaming && !error && (
          <div className="text-center py-12 text-gray-600">
            <div className="text-4xl mb-3">🤖</div>
            <div className="text-sm">Click "Generate Report" for a deep AI intelligence analysis</div>
            <div className="text-xs mt-1 text-gray-700">Powered by DeepSeek V4 Flash</div>
          </div>
        )}

        {text && (
          <div className="prediction-text text-sm text-gray-300">
            <FormattedText text={text} />
            {streaming && <span className="pulse-dot" />}
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedText({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-blue-400 font-bold text-sm mt-4 mb-1 border-b border-border pb-1">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-blue-300 font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} className="text-amber-400 font-semibold text-sm">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-gray-600 shrink-0">·</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
      })}
    </div>
  );
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-200">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded text-xs text-green-300">$1</code>');
}

function ScorePill({ label, value, highlight }) {
  const color = value >= 80 ? 'text-red-400' : value >= 60 ? 'text-orange-400' : value >= 40 ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className={`rounded p-2 text-center ${highlight ? 'bg-blue-950 border border-blue-800' : 'bg-surface'}`}>
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
