import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SparklineChart } from './SparklineChart';
import PriceCustomizer, { loadPrefs, savePrefs } from './PriceCustomizer';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const FX_NAMES = {
  TRY: 'Turkish Lira', ZAR: 'S. African Rand', BRL: 'Brazilian Real',
  NGN: 'Nigerian Naira', EGP: 'Egyptian Pound', EUR: 'Euro',
  GBP: 'Brit. Pound', JPY: 'Japanese Yen', CAD: 'Canadian Dollar',
  AUD: 'Aus. Dollar', CHF: 'Swiss Franc', CNY: 'Chinese Yuan',
  INR: 'Indian Rupee', MXN: 'Mexican Peso', KRW: 'South Korean Won',
  SAR: 'Saudi Riyal', AED: 'UAE Dirham', RUB: 'Russian Ruble',
  HUF: 'Hungarian Forint', PLN: 'Polish Zloty',
};

function PriceCard({ item }) {
  const up = item.changePct >= 0;
  const isFX = item.type === 'fx';
  const bullish = isFX ? !up : up;

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="text-xs font-bold text-white truncate">
            {isFX ? (FX_NAMES[item.symbol] || item.symbol) : item.name}
          </div>
          <div className="text-[10px] text-gray-600">{item.symbol}</div>
        </div>
        <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${bullish ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
          {up ? '↑' : '↓'} {Math.abs(item.changePct).toFixed(2)}%
        </span>
      </div>

      <div className={`text-lg font-bold font-mono ${bullish ? 'text-green-400' : 'text-red-400'}`}>
        {isFX ? item.price?.toFixed(3) : item.price?.toFixed(2)}
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

  const { data, isLoading } = useQuery({
    queryKey: ['feed-prices'],
    queryFn: () => fetch(`${API}/feed/prices`).then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const lastUpdated = data?.updatedAt
    ? Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 60000)
    : null;

  const allCommodities = data?.commodities || [];
  const allFX = data?.fx || [];

  // Filter to user's selected symbols, preserving order
  const visibleCommodities = allCommodities.filter(c => prefs.commodities.includes(c.symbol));
  const visibleFX = allFX.filter(f => prefs.fx.includes(f.symbol));
  const visible = [...visibleCommodities, ...visibleFX];

  const handlePrefsChange = useCallback((next) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  return (
    <div className="bg-surface border-b border-border shrink-0 relative">
      {/* Header row */}
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
            title="Customize symbols"
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

      {/* Customizer panel */}
      {customizerOpen && (
        <PriceCustomizer
          prefs={prefs}
          onChange={handlePrefsChange}
          availableCommodities={allCommodities}
          availableFX={allFX}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

      {/* Price ticker */}
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-thin">
        {isLoading && visible.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-w-[140px] h-24 bg-card border border-border rounded-lg animate-pulse shrink-0" />
            ))
          : visible.length === 0
          ? (
            <div className="flex items-center gap-2 text-xs text-gray-600 py-2">
              <span>No symbols selected.</span>
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
