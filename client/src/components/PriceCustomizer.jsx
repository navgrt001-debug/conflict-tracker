import { useState, useRef, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

// Comprehensive commodity catalog with Yahoo Finance symbols
export const COMMODITY_CATALOG = [
  // Energy
  { symbol: 'CL=F',    name: 'WTI Crude Oil',     category: 'Energy' },
  { symbol: 'BZ=F',    name: 'Brent Crude',        category: 'Energy' },
  { symbol: 'NG=F',    name: 'Natural Gas',         category: 'Energy' },
  { symbol: 'HO=F',    name: 'Heating Oil',         category: 'Energy' },
  { symbol: 'RB=F',    name: 'Gasoline RBOB',       category: 'Energy' },
  // Precious metals
  { symbol: 'GC=F',    name: 'Gold',                category: 'Precious Metals' },
  { symbol: 'SI=F',    name: 'Silver',              category: 'Precious Metals' },
  { symbol: 'PA=F',    name: 'Palladium',           category: 'Precious Metals' },
  { symbol: 'PL=F',    name: 'Platinum',            category: 'Precious Metals' },
  // Industrial metals
  { symbol: 'HG=F',    name: 'Copper',              category: 'Industrial Metals' },
  { symbol: 'ALI=F',   name: 'Aluminum',            category: 'Industrial Metals' },
  // Grains
  { symbol: 'ZW=F',    name: 'Wheat',               category: 'Grains' },
  { symbol: 'ZC=F',    name: 'Corn',                category: 'Grains' },
  { symbol: 'ZS=F',    name: 'Soybeans',            category: 'Grains' },
  { symbol: 'ZM=F',    name: 'Soybean Meal',        category: 'Grains' },
  { symbol: 'ZL=F',    name: 'Soybean Oil',         category: 'Grains' },
  { symbol: 'ZO=F',    name: 'Oats',                category: 'Grains' },
  { symbol: 'ZR=F',    name: 'Rough Rice',          category: 'Grains' },
  // Softs
  { symbol: 'CC=F',    name: 'Cocoa',               category: 'Softs' },
  { symbol: 'KC=F',    name: 'Coffee',              category: 'Softs' },
  { symbol: 'CT=F',    name: 'Cotton',              category: 'Softs' },
  { symbol: 'SB=F',    name: 'Sugar',               category: 'Softs' },
  { symbol: 'OJ=F',    name: 'Orange Juice',        category: 'Softs' },
  { symbol: 'LBS=F',   name: 'Lumber',              category: 'Softs' },
  // Livestock
  { symbol: 'LE=F',    name: 'Live Cattle',         category: 'Livestock' },
  { symbol: 'GF=F',    name: 'Feeder Cattle',       category: 'Livestock' },
  { symbol: 'HE=F',    name: 'Lean Hogs',           category: 'Livestock' },
  // Crypto
  { symbol: 'BTC-USD', name: 'Bitcoin',             category: 'Crypto' },
  { symbol: 'ETH-USD', name: 'Ethereum',            category: 'Crypto' },
  { symbol: 'SOL-USD', name: 'Solana',              category: 'Crypto' },
  { symbol: 'BNB-USD', name: 'BNB',                 category: 'Crypto' },
  { symbol: 'XRP-USD', name: 'XRP',                 category: 'Crypto' },
  { symbol: 'ADA-USD', name: 'Cardano',             category: 'Crypto' },
  { symbol: 'DOGE-USD',name: 'Dogecoin',            category: 'Crypto' },
  { symbol: 'AVAX-USD',name: 'Avalanche',           category: 'Crypto' },
];

export const DEFAULT_PREFS = {
  commodities: ['CL=F', 'BZ=F', 'GC=F', 'ZW=F', 'NG=F'],
  fx: ['EUR', 'GBP', 'JPY', 'TRY', 'ZAR', 'BRL', 'NGN', 'EGP'],
  custom: [], // user-added Yahoo Finance symbols not in catalog
};

const LS_KEY = 'price_board_prefs_v2';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    const merged = { ...DEFAULT_PREFS, ...p };
    // If everything is empty (e.g. user accidentally cleared all), restore defaults
    if (!merged.commodities.length && !merged.fx.length && !(merged.custom || []).length) {
      return DEFAULT_PREFS;
    }
    return merged;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs));
}

// --- Currency section (all currencies from API) ---
function CurrencyPanel({ allFX, selected, search, onToggle }) {
  const filtered = allFX.filter(f =>
    f.symbol.toLowerCase().includes(search.toLowerCase()) ||
    f.name?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.symbol.localeCompare(b.symbol));

  if (!filtered.length) return <div className="text-xs text-gray-600 py-2">No currencies match "{search}"</div>;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
      {filtered.map(f => {
        const isOn = selected.includes(f.symbol);
        return (
          <button
            key={f.symbol}
            onClick={() => onToggle(f.symbol)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left ${
              isOn
                ? 'bg-blue-600/20 border border-blue-600 text-blue-300'
                : 'bg-surface border border-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${isOn ? 'bg-blue-600 border-blue-500' : 'border-gray-600'}`}>
              {isOn && <span className="text-white text-[8px] leading-none">✓</span>}
            </span>
            <span className="font-mono font-bold">{f.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Commodity section ---
function CommodityPanel({ batchSymbols, selected, search, onToggle }) {
  const categories = [...new Set(COMMODITY_CATALOG.map(c => c.category))];

  const filtered = COMMODITY_CATALOG.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const byCategory = categories.map(cat => ({
    cat,
    items: filtered.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-3">
      {byCategory.map(({ cat, items }) => (
        <div key={cat}>
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">{cat}</div>
          <div className="grid grid-cols-2 gap-1">
            {items.map(c => {
              const isOn = selected.includes(c.symbol);
              const inBatch = batchSymbols.has(c.symbol);
              return (
                <button
                  key={c.symbol}
                  onClick={() => onToggle(c.symbol)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                    isOn
                      ? 'bg-blue-600/20 border border-blue-600 text-blue-300'
                      : 'bg-surface border border-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${isOn ? 'bg-blue-600 border-blue-500' : 'border-gray-600'}`}>
                    {isOn && <span className="text-white text-[8px] leading-none">✓</span>}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-600 font-mono">{c.symbol}</span>
                      {!inBatch && <span className="text-[9px] text-amber-600">on-demand</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Custom symbol adder ---
function CustomSymbolAdder({ customSymbols, onAdd, onRemove }) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null); // null | 'loading' | {ok, name} | 'error'

  const handleLookup = async () => {
    const sym = input.toUpperCase().trim();
    if (!sym) return;
    setStatus('loading');
    try {
      const r = await fetch(`${API}/feed/prices/lookup?symbol=${encodeURIComponent(sym)}`);
      if (!r.ok) {
        const e = await r.json();
        setStatus({ ok: false, msg: e.error || 'Not found' });
        return;
      }
      const data = await r.json();
      onAdd(sym, data.name || sym);
      setInput('');
      setStatus({ ok: true, name: data.name || sym });
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus({ ok: false, msg: 'Network error' });
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        Add any Yahoo Finance symbol
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => { setInput(e.target.value.toUpperCase()); setStatus(null); }}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          placeholder="e.g. AAPL, SI=F, USDINR=X…"
          className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        <button
          onClick={handleLookup}
          disabled={!input.trim() || status === 'loading'}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs rounded transition-colors whitespace-nowrap"
        >
          {status === 'loading' ? '...' : '+ Add'}
        </button>
      </div>
      {status && status !== 'loading' && (
        <div className={`text-xs ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
          {status.ok ? `✓ Added "${status.name}"` : `✕ ${status.msg}`}
        </div>
      )}
      {customSymbols.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {customSymbols.map(({ symbol, name }) => (
            <div key={symbol} className="flex items-center gap-1 bg-surface border border-border rounded px-2 py-1">
              <span className="text-xs font-mono text-gray-300">{symbol}</span>
              {name !== symbol && <span className="text-[10px] text-gray-500">({name})</span>}
              <button onClick={() => onRemove(symbol)} className="text-gray-600 hover:text-red-400 ml-1 text-xs leading-none">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main customizer ---
export default function PriceCustomizer({ prefs, onChange, allFX, batchCommodities, onClose }) {
  const [tab, setTab] = useState('commodities');
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const batchSymbols = new Set(batchCommodities.map(c => c.symbol));

  const toggleCommodity = (symbol) => {
    const next = prefs.commodities.includes(symbol)
      ? prefs.commodities.filter(s => s !== symbol)
      : [...prefs.commodities, symbol];
    onChange({ ...prefs, commodities: next });
  };

  const toggleFX = (symbol) => {
    const next = prefs.fx.includes(symbol)
      ? prefs.fx.filter(s => s !== symbol)
      : [...prefs.fx, symbol];
    onChange({ ...prefs, fx: next });
  };

  const addCustom = (symbol, name) => {
    if (prefs.custom.some(c => c.symbol === symbol)) return;
    onChange({ ...prefs, custom: [...prefs.custom, { symbol, name }] });
  };

  const removeCustom = (symbol) => {
    onChange({ ...prefs, custom: prefs.custom.filter(c => c.symbol !== symbol) });
  };

  const total = prefs.commodities.length + prefs.fx.length + prefs.custom.length;

  const TABS = [
    { id: 'commodities', label: `Commodities (${prefs.commodities.length})` },
    { id: 'currencies',  label: `Currencies (${prefs.fx.length})` },
    { id: 'custom',      label: `Custom (${prefs.custom.length})` },
  ];

  return (
    <div ref={ref} className="absolute top-full left-0 right-0 z-50 bg-card border-b border-x border-border shadow-2xl">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        {/* Tab switcher */}
        <div className="flex bg-surface rounded-lg overflow-hidden border border-border text-[10px] font-medium">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch(''); }}
              className={`px-3 py-1.5 transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'custom' && (
          <div className="relative flex-1 max-w-xs">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'commodities' ? 'Search commodities…' : 'Search currencies…'}
              className="w-full bg-surface border border-border rounded px-3 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-xs">✕</button>
            )}
          </div>
        )}

        <span className="text-[10px] text-gray-600 ml-auto">{total} selected</span>
        <button
          onClick={() => onChange(DEFAULT_PREFS)}
          className="text-[10px] text-gray-500 hover:text-gray-300 border border-border hover:border-gray-500 rounded px-2 py-1 transition-colors whitespace-nowrap"
        >
          Reset
        </button>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-sm">✕</button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 max-h-80 overflow-y-auto">
        {tab === 'commodities' && (
          <CommodityPanel
            batchSymbols={batchSymbols}
            selected={prefs.commodities}
            search={search}
            onToggle={toggleCommodity}
          />
        )}
        {tab === 'currencies' && (
          <CurrencyPanel
            allFX={allFX}
            selected={prefs.fx}
            search={search}
            onToggle={toggleFX}
          />
        )}
        {tab === 'custom' && (
          <CustomSymbolAdder
            customSymbols={prefs.custom}
            onAdd={addCustom}
            onRemove={removeCustom}
          />
        )}
      </div>

      {tab === 'commodities' && (
        <div className="px-4 pb-2 text-[10px] text-gray-600">
          Items marked <span className="text-amber-600">on-demand</span> are fetched individually when selected — not in the 5-min batch.
        </div>
      )}
    </div>
  );
}
