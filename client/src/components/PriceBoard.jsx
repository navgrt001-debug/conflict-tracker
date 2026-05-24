import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SparklineChart } from './SparklineChart';
import PriceCustomizer, { loadPrefs, savePrefs } from './PriceCustomizer';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function PriceCard({ item }) {
  const up = item.changePct >= 0;
  const isFX = item.type === 'fx';
  const bullish = isFX ? !up : up;

  // Display name: strip "USD/" prefix for FX, use name for commodities
  const displayName = isFX
    ? (item.name?.replace('USD/', '') || item.symbol)
    : (item.name || item.symbol);

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="text-xs font-bold text-white truncate max-w-[100px]">{displayName}</div>
          <div className="text-[10px] text-gray-600">{item.symbol}</div>
        </div>
        <span className={`text-[10px] font-bold px-1 py-0.5 rounded shrink-0 ${bullish ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
          {up ? '↑' : '↓'} {Math.abs(item.changePct ?? 0).toFixed(2)}%
        </span>
      </div>

      <div className={`text-lg font-bold font-mono ${bullish ? 'text-green-400' : 'text-red-400'}`}>
        {isFX ? item.price?.toFixed(4) : item.price?.toFixed(2)}
      </div>

      {item.sparkline?.length > 1 && (
        <SparklineChart data={item.sparkline} up={bullish} />
      )}
    </div>
  );
}

export default function PriceBoard() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customData, setCustomData] = useState({}); // symbol → price data

  // Batch prices (commodities + all FX)
  const { data, isLoading } = useQuery({
    queryKey: ['feed-prices'],
    queryFn: () => fetch(`${API}/feed/prices`).then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const allFX = data?.fx || [];
  const batchCommodities = data?.commodities || [];

  // For custom symbols + catalog items NOT in batch, fetch individually
  useEffect(() => {
    const batchSymbolSet = new Set(batchCommodities.map(c => c.symbol));
    const allSelected = [
      ...prefs.commodities,
      ...(prefs.custom || []).map(c => c.symbol),
    ];
    const needLookup = allSelected.filter(s => !batchSymbolSet.has(s));
    if (!needLookup.length) return;

    needLookup.forEach(async (sym) => {
      if (customData[sym]) return; // already fetched
      try {
        const r = await fetch(`${API}/feed/prices/lookup?symbol=${encodeURIComponent(sym)}`);
        if (!r.ok) return;
        const item = await r.json();
        setCustomData(prev => ({ ...prev, [sym]: item }));
      } catch { /* ignore */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.commodities, prefs.custom, batchCommodities.length]);

  const lastUpdated = data?.updatedAt
    ? Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 60000)
    : null;

  // Build visible items in order: commodities → fx → custom
  const batchSymbolSet = new Set(batchCommodities.map(c => c.symbol));

  const visibleCommodities = prefs.commodities.map(sym =>
    batchCommodities.find(c => c.symbol === sym) || customData[sym]
  ).filter(Boolean);

  const visibleFX = prefs.fx.map(sym =>
    allFX.find(f => f.symbol === sym)
  ).filter(Boolean);

  const visibleCustom = (prefs.custom || []).map(({ symbol }) =>
    batchCommodities.find(c => c.symbol === symbol) ||
    allFX.find(f => f.symbol === symbol) ||
    customData[symbol]
  ).filter(Boolean);

  const visible = [...visibleCommodities, ...visibleFX, ...visibleCustom];

  const handlePrefsChange = useCallback((next) => {
    setPrefs(next);
    savePrefs(next);
    // Clear cached custom data for removed symbols to allow re-fetch
    const keep = new Set([
      ...next.commodities,
      ...(next.custom || []).map(c => c.symbol),
    ]);
    setCustomData(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => keep.has(k))));
  }, []);

  return (
    <div className="bg-surface border-b border-border shrink-0 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
            Live Prices — Commodities & FX vs USD
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated !== null && (
            <span className="text-[10px] text-gray-600 hidden sm:block">
              updated {lastUpdated === 0 ? 'just now' : `${lastUpdated}m ago`}
            </span>
          )}
          <button
            onClick={() => setCustomizerOpen(o => !o)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
              customizerOpen
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-border text-gray-500 hover:text-gray-300 hover:border-gray-500'
            }`}
          >
            ⚙ Customize
          </button>
        </div>
      </div>

      {/* Customizer */}
      {customizerOpen && (
        <PriceCustomizer
          prefs={prefs}
          onChange={handlePrefsChange}
          allFX={allFX}
          batchCommodities={batchCommodities}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

      {/* Ticker */}
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-thin">
        {isLoading && visible.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-w-[140px] h-24 bg-card border border-border rounded-lg animate-pulse shrink-0" />
            ))
          : visible.length === 0
          ? (
            <div className="flex items-center gap-2 text-xs text-gray-600 py-2">
              No symbols selected.
              <button onClick={() => setCustomizerOpen(true)} className="text-blue-400 underline">
                Open customizer
              </button>
            </div>
          )
          : visible.map(item => (
              <div key={item.symbol} className="shrink-0">
                <PriceCard item={item} />
              </div>
            ))
        }
      </div>
    </div>
  );
}
