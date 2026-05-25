import { useState, useRef } from 'react';
import { streamPrediction } from '../../services/api';

export default function PredictionPanel({ conflict, marketData, tradeData }) {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [finalScores, setFinalScores] = useState(null);
  const reportRef = useRef(null);

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

  const handleExportPDF = () => {
    if (!text || !conflict) return;
    const scores = conflict.scores || {};

    // Convert markdown text to basic HTML for the print window
    const htmlBody = text.split('\n').map(line => {
      if (line.startsWith('## '))  return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return `<li>${inlineToHtml(line.slice(2))}</li>`;
      }
      if (line.trim() === '') return '<br/>';
      return `<p>${inlineToHtml(line)}</p>`;
    }).join('\n');

    const scoreRow = scores.combined != null ? `
      <div class="scores">
        <div class="score"><span class="score-val">${scores.severity}</span><span class="score-lbl">Severity</span></div>
        <div class="score"><span class="score-val">${scores.economic}</span><span class="score-lbl">Economic</span></div>
        <div class="score"><span class="score-val">${scores.escalation}</span><span class="score-lbl">Escalation</span></div>
        <div class="score highlight"><span class="score-val">${scores.combined}</span><span class="score-lbl">Combined (${scores.label})</span></div>
      </div>` : '';

    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>AI Intelligence Report — ${conflict.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: #fff; padding: 32px 48px; max-width: 860px; margin: 0 auto; }
    .header { border-bottom: 2px solid #1a1a2e; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 18pt; color: #1a1a2e; margin-bottom: 4px; }
    .header .meta { font-size: 9pt; color: #555; }
    .header .tag { display: inline-block; background: #1a1a2e; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; margin-right: 6px; font-family: monospace; }
    .scores { display: flex; gap: 12px; margin: 16px 0; }
    .score { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; text-align: center; }
    .score.highlight { border-color: #1a3a8f; background: #f0f4ff; }
    .score-val { display: block; font-size: 16pt; font-weight: bold; color: #c0392b; }
    .score.highlight .score-val { color: #1a3a8f; }
    .score-lbl { display: block; font-size: 8pt; color: #666; margin-top: 2px; }
    h2 { font-size: 13pt; color: #1a1a2e; margin: 22px 0 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    h3 { font-size: 11pt; color: #2c3e70; margin: 14px 0 4px; }
    p  { margin: 5px 0; line-height: 1.6; }
    li { margin: 3px 0 3px 20px; line-height: 1.6; }
    strong { color: #1a1a2e; }
    em { font-style: italic; }
    .footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }
    .disclaimer { margin-top: 16px; padding: 10px 14px; background: #fafafa; border-left: 3px solid #aaa; font-size: 8.5pt; color: #666; line-height: 1.5; }
    @media print {
      body { padding: 20px 30px; }
      .no-print { display: none; }
    }
    .print-btn { display: block; margin: 0 auto 24px; padding: 10px 28px; background: #1a1a2e; color: #fff; border: none; border-radius: 6px; font-size: 11pt; cursor: pointer; }
    .print-btn:hover { background: #2c3e70; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 Save as PDF / Print</button>
  <div class="header">
    <div class="meta">
      <span class="tag">AI INTELLIGENCE REPORT</span>
      <span class="tag">CONFIDENTIAL — INTERNAL USE</span>
    </div>
    <h1>${conflict.name}</h1>
    <div class="meta" style="margin-top:6px">
      ${conflict.region ? `<strong>Region:</strong> ${conflict.region} &nbsp;|&nbsp; ` : ''}
      ${conflict.type ? `<strong>Type:</strong> ${conflict.type} &nbsp;|&nbsp; ` : ''}
      <strong>Generated:</strong> ${now} &nbsp;|&nbsp;
      <strong>Model:</strong> AI Intelligence Engine
    </div>
  </div>
  ${scoreRow}
  <div class="body">${htmlBody}</div>
  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is AI-generated and is intended for informational purposes only.
    All analysis, forecasts, and cited sources should be independently verified before making any financial, investment, or policy decisions.
    The model may contain inaccuracies. Citations refer to real organisations but specific documents should be confirmed directly with the source.
  </div>
  <div class="footer">
    <span>Global Conflict &amp; Market Intelligence Platform</span>
    <span>Generated ${now}</span>
  </div>
</body>
</html>`);
    win.document.close();
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
              AI Intelligence · Streaming
            </p>
          </div>
          <div className="flex items-center gap-2">
            {done && text && (
              <button
                onClick={handleExportPDF}
                className="px-3 py-2 rounded text-sm font-medium border border-border text-gray-400 hover:text-white hover:border-gray-400 transition-all flex items-center gap-1.5"
                title="Export as PDF"
              >
                <span>📄</span>
                <span className="hidden sm:inline">Export PDF</span>
              </button>
            )}
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

// Plain HTML version for PDF export (no Tailwind classes)
function inlineToHtml(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
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
