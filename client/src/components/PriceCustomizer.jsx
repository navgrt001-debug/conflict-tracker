import { useState, useRef, useEffect } from 'react';

export const COMMODITY_CATALOG = [
  { symbol: 'CL=F',    name: 'WTI Crude Oil' },
  { symbol: 'BZ=F',    name: 'Brent Crude' },
  { symbol: 'GC=F',    name: 'Gold' },
  { symbol: 'SI=F',    name: 'Silver' },
  { symbol: 'HG=F',    name: 'Copper' },
  { symbol: 'PA=F',    name: 'Palladium' },
  { symbol: 'PL=F',    name: 'Platinum' },
  { symbol: 'ZW=F',    name: 'Wheat' },
  { symbol: 'ZC=F',    name: 'Corn' },
  { symbol: 'ZS=F',    name: 'Soybeans' },
  { symbol: 'NG=F',    name: 'Natural Gas' },
  { symbol: 'HO=F',    name: 'Heating Oil' },
  { symbol: 'CC=F',    name: 'Cocoa' },
  { symbol: 'KC=F',    name: 'Coffee' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
];

export const FX_CATALOG = [
  { symbol: 'EUR', name: 'Euro' },
  { symbol: 'GBP', name: 'Brit. Pound' },
  { symbol: 'JPY', name: 'Japanese Yen' },
  { symbol: 'CAD', name: 'Canadian Dollar' },
  { symbol: 'AUD', name: 'Australian Dollar' },
  { symbol: 'CHF', name: 'Swiss Franc' },
  { symbol: 'CNY', name: 'Chinese Yuan' },
  { symbol: 'INR', name: 'Indian Rupee' },
  { symbol: 'TRY', name: 'Turkish Lira' },
  { symbol: 'ZAR', name: 'S. African Rand' },
  { symbol: 'BRL', name: 'Brazilian Real' },
  { symbol: 'NGN', name: 'Nigerian Naira' },
  { symbol: 'EGP', name: 'Egyptian Pound' },
  { symbol: 'MXN', name: 'Mexican Peso' },
  { symbol: 'KRW', name: 'South Korean Won' },
  { symbol: 'SAR', name: 'Saudi Riyal' },
  { symbol: 'AED', name: 'UAE Dirham' },
  { symbol: 'RUB', name: 'Russian Ruble' },
  { symbol: 'HUF', name: 'Hungarian Forint' },
  { symbol: 'PLN', name: 'Polish Zloty' },
];

export const DEFAULT_PREFS = {
  commodities: ['CL=F', 'BZ=F', 'GC=F', 'ZW=F', 'NG=F'],
  fx: ['EUR', 'GBP', 'JPY', 'TRY', 'ZAR', 'BRL', 'NGN', 'EGP'],
};

const LS_KEY = 'price_board_prefs';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs));
}

function CatalogSection({ title, catalog, selected, availableSymbols, onChange, search }) {
  const filtered = catalog.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (symbol) => {
    const next = selected.includes(symbol)
      ? selected.filter(s => s !== symbol)
      : [...selected, symbol];
    onChange(next);
  };

  return (
    <div>
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-1">
        {filtered.map(item => {
          const isSelected = selected.includes(item.symbol);
          const isAvailable = availableSymbols.has(item.symbol);
          return (
            <button
              key={item.symbol}
              onClick={() => isAvailable && toggle(item.symbol)}
              disabled={!isAvailable}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-xs ${
                !isAvailable
                  ? 'opacity-30 cursor-not-allowed'
                  : isSelected
                  ? 'bg-blue-600/20 border border-blue-600 text-blue-300'
                  : 'bg-surface border border-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                isSelected ? 'bg-blue-600 border-blue-500' : 'border-gray-600'
              }`}>
                {isSelected && <span className="text-white text-[8px] leading-none">✓</span>}
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{item.name}</div>
                <div className="text-[10px] text-gray-600">{item.symbol}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PriceCustomizer({ prefs, onChange, availableCommodities, availableFX, onClose }) {
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const availableSymbols = new Set([
    ...availableCommodities.map(c => c.symbol),
    ...availableFX.map(f => f.symbol),
  ]);

  const handleReset = () => {
    onChange(DEFAULT_PREFS);
  };

  const selectedCount = prefs.commodities.length + prefs.fx.length;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 right-0 z-50 bg-card border-b border-x border-border shadow-xl"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search commodities or currencies..."
            className="w-full bg-surface border border-border rounded px-3 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-xs">✕</button>
          )}
        </div>
        <span className="text-[10px] text-gray-500">{selectedCount} selected</span>
        <button
          onClick={handleReset}
          className="text-[10px] text-gray-500 hover:text-gray-300 border border-border hover:border-gray-500 rounded px-2 py-1 transition-colors"
        >
          Reset defaults
        </button>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 text-sm ml-auto"
        >✕</button>
      </div>

      {/* Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-3 max-h-72 overflow-y-auto">
        <CatalogSection
          title="Commodities"
          catalog={COMMODITY_CATALOG}
          selected={prefs.commodities}
          availableSymbols={availableSymbols}
          onChange={next => onChange({ ...prefs, commodities: next })}
          search={search}
        />
        <CatalogSection
          title="FX — vs USD"
          catalog={FX_CATALOG}
          selected={prefs.fx}
          availableSymbols={availableSymbols}
          onChange={next => onChange({ ...prefs, fx: next })}
          search={search}
        />
      </div>
    </div>
  );
}
