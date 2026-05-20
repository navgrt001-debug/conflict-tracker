import { useState } from 'react';

const ASSET_SUGGESTIONS = [
  { symbol: 'WTI', label: 'WTI Crude Oil', type: 'commodity' },
  { symbol: 'BRENT', label: 'Brent Crude Oil', type: 'commodity' },
  { symbol: 'GOLD', label: 'Gold', type: 'commodity' },
  { symbol: 'SILVER', label: 'Silver', type: 'commodity' },
  { symbol: 'NATGAS', label: 'Natural Gas', type: 'commodity' },
  { symbol: 'WHEAT', label: 'Wheat', type: 'commodity' },
  { symbol: 'CORN', label: 'Corn', type: 'commodity' },
  { symbol: 'COPPER', label: 'Copper', type: 'commodity' },
  { symbol: 'USDTRY', label: 'USD/TRY', type: 'fx' },
  { symbol: 'USDRUB', label: 'USD/RUB', type: 'fx' },
  { symbol: 'USDZAR', label: 'USD/ZAR', type: 'fx' },
  { symbol: 'USDBRL', label: 'USD/BRL', type: 'fx' },
  { symbol: 'USDNGN', label: 'USD/NGN', type: 'fx' },
  { symbol: 'EURUSD', label: 'EUR/USD', type: 'fx' },
  { symbol: 'USDJPY', label: 'USD/JPY', type: 'fx' },
  { symbol: 'GBPUSD', label: 'GBP/USD', type: 'fx' },
  { symbol: 'AAPL', label: 'Apple (AAPL)', type: 'equity' },
  { symbol: 'XOM', label: 'ExxonMobil (XOM)', type: 'equity' },
  { symbol: 'BP', label: 'BP plc (BP)', type: 'equity' },
  { symbol: 'LMT', label: 'Lockheed Martin (LMT)', type: 'equity' },
  { symbol: 'BA', label: 'Boeing (BA)', type: 'equity' },
  { symbol: 'RHM', label: 'Rheinmetall (RHM)', type: 'equity' },
  { symbol: 'SPY', label: 'S&P 500 ETF (SPY)', type: 'equity' },
  { symbol: 'EEM', label: 'Emerging Markets ETF (EEM)', type: 'equity' },
  { symbol: 'BTC', label: 'Bitcoin (BTC)', type: 'crypto' },
  { symbol: 'ETH', label: 'Ethereum (ETH)', type: 'crypto' },
];

const REGIONS = [
  { id: 'ME', label: 'Middle East', emoji: '🕌' },
  { id: 'EE', label: 'Eastern Europe', emoji: '🏛️' },
  { id: 'EA', label: 'East Asia', emoji: '🏯' },
  { id: 'SA', label: 'South Asia', emoji: '🕍' },
  { id: 'SEA', label: 'SE Asia', emoji: '🌴' },
  { id: 'SSA', label: 'Sub-Saharan Africa', emoji: '🌍' },
  { id: 'NA', label: 'North Africa', emoji: '🏜️' },
  { id: 'LAT', label: 'Latin America', emoji: '🌎' },
  { id: 'WE', label: 'Western Europe', emoji: '🏰' },
  { id: 'US', label: 'North America', emoji: '🗽' },
  { id: 'CA', label: 'Central Asia', emoji: '🏔️' },
  { id: 'OCE', label: 'Oceania', emoji: '🦘' },
];

const TYPE_COLORS = {
  commodity: 'text-amber-400 bg-amber-900/30 border-amber-700',
  fx: 'text-blue-400 bg-blue-900/30 border-blue-700',
  equity: 'text-green-400 bg-green-900/30 border-green-700',
  crypto: 'text-purple-400 bg-purple-900/30 border-purple-700',
};

export default function PortfolioSetup({ initialPortfolio, onSave, onClose, isSaving }) {
  const [step, setStep] = useState(1);
  const [assets, setAssets] = useState(initialPortfolio?.assets || []);
  const [riskProfile, setRiskProfile] = useState(initialPortfolio?.risk_profile || 'moderate');
  const [focusRegions, setFocusRegions] = useState(initialPortfolio?.focus_regions || []);
  const [baseCurrency, setBaseCurrency] = useState(initialPortfolio?.base_currency || 'USD');
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = search.length > 0
    ? ASSET_SUGGESTIONS.filter(a =>
        a.symbol.toLowerCase().includes(search.toLowerCase()) ||
        a.label.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : [];

  const addAsset = (suggestion) => {
    if (assets.some(a => a.symbol === suggestion.symbol)) return;
    setAssets(prev => [...prev, {
      symbol: suggestion.symbol,
      type: suggestion.type,
      position: 'long',
      size: 'medium',
      region_exposure: [],
    }]);
    setSearch('');
    setShowSuggestions(false);
  };

  const removeAsset = (symbol) => setAssets(prev => prev.filter(a => a.symbol !== symbol));

  const updateAsset = (symbol, key, value) => {
    setAssets(prev => prev.map(a => a.symbol === symbol ? { ...a, [key]: value } : a));
  };

  const toggleRegion = (id) => {
    setFocusRegions(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    onSave({ assets, risk_profile: riskProfile, base_currency: baseCurrency, focus_regions: focusRegions });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Portfolio Setup</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Personalize all analysis to your holdings</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg leading-none">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 py-3 gap-2 shrink-0 border-b border-border">
          {[1, 2, 3].map(s => (
            <button key={s} onClick={() => setStep(s)} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-700 text-white' : 'bg-surface text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-[11px] font-medium ${step === s ? 'text-white' : 'text-gray-600'}`}>
                {s === 1 ? 'Holdings' : s === 2 ? 'Risk Profile' : 'Regions'}
              </span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Step 1: Holdings */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Search and add assets</label>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="WTI, USDTRY, AAPL, BTC…"
                    className="w-full bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                      {filteredSuggestions.map(s => (
                        <button
                          key={s.symbol}
                          onMouseDown={() => addAsset(s)}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface transition-colors border-b border-border/40 last:border-0"
                        >
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[s.type]}`}>{s.type}</span>
                          <span className="text-sm text-white font-medium">{s.symbol}</span>
                          <span className="text-xs text-gray-500">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {assets.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">No assets added yet. Search above to add positions.</p>
              ) : (
                <div className="space-y-2">
                  {assets.map(asset => (
                    <div key={asset.symbol} className="bg-surface border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[asset.type]}`}>{asset.type}</span>
                          <span className="text-sm font-bold text-white">{asset.symbol}</span>
                        </div>
                        <button onClick={() => removeAsset(asset.symbol)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                      </div>
                      <div className="flex gap-2">
                        {/* Long/Short */}
                        <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                          {['long', 'short'].map(p => (
                            <button
                              key={p}
                              onClick={() => updateAsset(asset.symbol, 'position', p)}
                              className={`px-2.5 py-1 font-medium capitalize transition-colors ${
                                asset.position === p
                                  ? p === 'long' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'
                                  : 'text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {p === 'long' ? '▲ Long' : '▼ Short'}
                            </button>
                          ))}
                        </div>
                        {/* Size */}
                        <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                          {['small', 'medium', 'large'].map(sz => (
                            <button
                              key={sz}
                              onClick={() => updateAsset(asset.symbol, 'size', sz)}
                              className={`px-2 py-1 capitalize transition-colors ${
                                asset.size === sz ? 'bg-blue-700 text-blue-100' : 'text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {sz.charAt(0).toUpperCase() + sz.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Risk Profile */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-4">How should the AI frame its recommendations?</p>
              {[
                {
                  id: 'conservative',
                  label: 'Conservative',
                  icon: '🛡️',
                  desc: 'Capital preservation first. Alert me to downside risks and safe-haven opportunities.',
                  color: 'border-green-700 bg-green-950/30',
                  active: 'border-green-500 bg-green-900/40',
                },
                {
                  id: 'moderate',
                  label: 'Moderate',
                  icon: '⚖️',
                  desc: 'Balanced approach. Show both risks and opportunities with clear trade-offs.',
                  color: 'border-blue-700 bg-blue-950/30',
                  active: 'border-blue-500 bg-blue-900/40',
                },
                {
                  id: 'aggressive',
                  label: 'Aggressive',
                  icon: '⚡',
                  desc: 'Opportunity-focused. Highlight volatility plays, asymmetric bets, and momentum setups.',
                  color: 'border-red-700 bg-red-950/30',
                  active: 'border-red-500 bg-red-900/40',
                },
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setRiskProfile(r.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${riskProfile === r.id ? r.active + ' ring-1 ring-inset ring-white/10' : r.color + ' opacity-60 hover:opacity-90'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{r.icon}</span>
                    <span className="text-sm font-bold text-white">{r.label}</span>
                    {riskProfile === r.id && <span className="text-[10px] text-green-400 ml-auto">✓ Selected</span>}
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">{r.desc}</p>
                </button>
              ))}

              <div className="mt-4">
                <label className="text-xs text-gray-400 block mb-1.5">Base currency</label>
                <div className="flex gap-2 flex-wrap">
                  {['USD', 'EUR', 'GBP', 'JPY', 'CHF'].map(c => (
                    <button
                      key={c}
                      onClick={() => setBaseCurrency(c)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        baseCurrency === c ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface border-border text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Regions */}
          {step === 3 && (
            <div>
              <p className="text-xs text-gray-400 mb-4">Select regions you care about — the AI will prioritize conflicts in these areas.</p>
              <div className="grid grid-cols-3 gap-2">
                {REGIONS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggleRegion(r.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-all ${
                      focusRegions.includes(r.id)
                        ? 'bg-blue-900/40 border-blue-500 text-white'
                        : 'bg-surface border-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="text-sm">{r.emoji}</span>
                    <span className="leading-tight text-left">{r.label}</span>
                  </button>
                ))}
              </div>
              {focusRegions.length === 0 && (
                <p className="text-[11px] text-gray-600 mt-3 text-center">None selected = global coverage (default)</p>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isSaving ? 'Saving…' : '✓ Save Portfolio'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
