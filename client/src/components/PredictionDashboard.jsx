import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import PredictionCard from './PredictionCard';
import { AccuracyTimeline, AccuracyByAsset } from './AccuracyChart';

const ASSETS = [
  { asset: 'CL=F',   label: 'WTI Crude' },
  { asset: 'GC=F',   label: 'Gold' },
  { asset: 'ZW=F',   label: 'Wheat' },
  { asset: 'NG=F',   label: 'Natural Gas' },
  { asset: 'USDTRY', label: 'USD/TRY' },
  { asset: 'USDZAR', label: 'USD/ZAR' },
  { asset: 'USDBRL', label: 'USD/BRL' },
  { asset: 'USDEGP', label: 'USD/EGP' },
];

function StatCard({ value, label, sub, color = 'text-white' }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function PredictionDashboard() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('active');
  const [generating, setGenerating] = useState(false);
  const [genEventId, setGenEventId] = useState('');
  const [genAsset, setGenAsset] = useState('GC=F');
  const [genMsg, setGenMsg] = useState('');

  const { data: active = [], isLoading: activeLoading } = useQuery({
    queryKey: ['predictions-active'],
    queryFn: () => fetch('/api/predictions/active').then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['predictions-history'],
    queryFn: () => fetch('/api/predictions/history').then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: accuracy } = useQuery({
    queryKey: ['predictions-accuracy'],
    queryFn: () => fetch('/api/predictions/accuracy').then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: feedData } = useQuery({ queryKey: ['feed-conflicts'], staleTime: 0 });
  const feedEvents = feedData?.events || (Array.isArray(feedData) ? feedData : []);

  const resolveMutation = useMutation({
    mutationFn: (id) => fetch(`/api/predictions/resolve/${id}`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['predictions-active'] });
      qc.invalidateQueries({ queryKey: ['predictions-history'] });
      qc.invalidateQueries({ queryKey: ['predictions-accuracy'] });
    },
  });

  const handleGenerate = async () => {
    if (!genEventId) { setGenMsg('Select a conflict event first'); return; }
    setGenerating(true);
    setGenMsg('');
    try {
      const r = await fetch('/api/predictions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: genEventId, asset: genAsset }),
      });
      const data = await r.json();
      if (!r.ok) { setGenMsg(data.error || 'Failed'); }
      else {
        setGenMsg(`✓ Generated: ${data.asset_label} ${data.direction === 'up' ? '↑' : '↓'} ${data.magnitude}`);
        qc.invalidateQueries({ queryKey: ['predictions-active'] });
      }
    } catch (e) {
      setGenMsg(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const directionalPct = accuracy?.directional_pct ?? null;
  const benchmarkDelta = directionalPct !== null ? directionalPct - 50 : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Prediction Tracking & Scoring</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">AI-generated geopolitical market predictions with accuracy scoring</p>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {directionalPct !== null && (
              <span className={`px-2 py-1 rounded border font-bold ${
                benchmarkDelta >= 10 ? 'bg-green-900 border-green-700 text-green-300' :
                benchmarkDelta >= 0  ? 'bg-blue-900 border-blue-700 text-blue-300' :
                                       'bg-red-900 border-red-700 text-red-400'
              }`}>
                {benchmarkDelta >= 0 ? '+' : ''}{benchmarkDelta}% vs random
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Accuracy scorecard */}
        {accuracy && (
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <StatCard
                value={accuracy.total}
                label="Total Predictions"
                color="text-white"
              />
              <StatCard
                value={accuracy.directional_pct != null ? `${accuracy.directional_pct}%` : '—'}
                label="Directionally Correct"
                sub="vs 50% random baseline"
                color={accuracy.directional_pct >= 60 ? 'text-green-400' : accuracy.directional_pct >= 50 ? 'text-blue-400' : 'text-red-400'}
              />
              <StatCard
                value={accuracy.avg_score != null ? `${accuracy.avg_score}` : '—'}
                label="Avg Score / 100"
                color="text-blue-400"
              />
              <StatCard
                value={active.length}
                label="Active Predictions"
                color="text-yellow-400"
              />
            </div>

            {/* Charts side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Accuracy Over Time</div>
                <AccuracyTimeline timeline={accuracy.timeline || []} />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Accuracy by Asset</div>
                <AccuracyByAsset byAsset={accuracy.by_asset || {}} />
              </div>
            </div>

            {/* By-asset breakdown */}
            {Object.keys(accuracy.by_asset || {}).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(accuracy.by_asset).map(([label, stats]) => (
                  <div key={label} className="flex items-center gap-1.5 bg-surface border border-border rounded px-2 py-1">
                    <span className="text-[10px] text-gray-400">{label}</span>
                    <span className={`text-[10px] font-bold ${
                      stats.accuracy_pct >= 70 ? 'text-green-400' :
                      stats.accuracy_pct >= 50 ? 'text-blue-400' : 'text-red-400'
                    }`}>{stats.accuracy_pct}%</span>
                    <span className="text-[10px] text-gray-600">({stats.total})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual generate */}
        <div className="p-4 border-b border-border">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Generate New Prediction</div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="text-[10px] text-gray-600 block mb-1">Conflict Event</label>
              <select
                value={genEventId}
                onChange={e => setGenEventId(e.target.value)}
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
              >
                <option value="">Select event...</option>
                {feedEvents.filter(e => e.severity >= 6).map(e => (
                  <option key={e.id} value={e.id}>
                    [{e.severity}] {e.title.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 block mb-1">Asset</label>
              <select
                value={genAsset}
                onChange={e => setGenAsset(e.target.value)}
                className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
              >
                {ASSETS.map(a => <option key={a.asset} value={a.asset}>{a.label}</option>)}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !genEventId}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs rounded transition-colors shrink-0"
            >
              {generating ? '...' : 'Generate'}
            </button>
          </div>
          {genMsg && (
            <div className={`mt-2 text-[11px] ${genMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {genMsg}
            </div>
          )}
          <p className="text-[10px] text-gray-700 mt-1.5">
            High-severity (≥7) predictions are also auto-generated every 30 min
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[
            { id: 'active',  label: `Active (${active.length})` },
            { id: 'history', label: `History (${history.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Prediction cards */}
        <div className="p-3 space-y-2">
          {tab === 'active' && (
            activeLoading
              ? <Skeleton />
              : active.length === 0
                ? <Empty msg="No active predictions yet — they auto-generate for high-severity events" />
                : active.map(p => (
                    <PredictionCard
                      key={p.id}
                      prediction={p}
                      onResolve={(id) => resolveMutation.mutate(id)}
                    />
                  ))
          )}
          {tab === 'history' && (
            historyLoading
              ? <Skeleton />
              : history.length === 0
                ? <Empty msg="No resolved predictions yet" />
                : history.map(p => <PredictionCard key={p.id} prediction={p} />)
          )}
        </div>
      </div>
    </div>
  );
}

const Skeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3].map(i => <div key={i} className="h-32 bg-surface rounded-lg animate-pulse" />)}
  </div>
);

const Empty = ({ msg }) => (
  <div className="text-center py-8 text-gray-600 text-sm">{msg}</div>
);
