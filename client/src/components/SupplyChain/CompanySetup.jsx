import { useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { COUNTRIES, flagEmoji } from './countries';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const INDUSTRIES = [
  'Food & Beverage','Agriculture','Automotive','Chemicals','Construction',
  'Consumer Goods','Defence','Electronics','Energy','Fashion & Apparel',
  'Healthcare','Logistics','Manufacturing','Mining','Packaging',
  'Pharmaceuticals','Retail','Semiconductor','Steel & Metals','Technology',
  'Textiles','Utilities','Other',
];
const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const UNITS = ['tonne','kg','litre','barrel','unit','m³','MWh','piece','kg CO2e'];
const CURRENCIES = ['USD','EUR','GBP','JPY','CHF','AUD','CAD','SGD'];

const STEP_LABELS = [
  { n: 1, label: 'Company' },
  { n: 2, label: 'Product' },
  { n: 3, label: 'Materials' },
  { n: 4, label: 'Sources' },
  { n: 5, label: 'Buyers' },
  { n: 6, label: 'Financials' },
];

// ── Reusable searchable dropdown ──────────────────────────────────────────────
function SearchSelect({ options, value, onChange, placeholder, getLabel, getValue }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = options.filter(o => getLabel(o).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const selected = value ? options.find(o => getValue(o) === value) : null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-surface border border-border text-sm px-3 py-2 rounded-lg text-left focus:outline-none focus:border-blue-500">
        <span className={selected ? 'text-white' : 'text-gray-600'}>{selected ? getLabel(selected) : placeholder}</span>
        <span className="text-gray-600 ml-2">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            className="w-full px-3 py-2 bg-surface text-sm text-white border-b border-border focus:outline-none placeholder-gray-600" />
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <div className="px-3 py-2 text-xs text-gray-500">No results</div>
              : filtered.map(o => (
                <button key={getValue(o)} type="button"
                  onMouseDown={() => { onChange(getValue(o)); setOpen(false); setQ(''); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white border-b border-border/40 last:border-0">
                  {getLabel(o)}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 1: Company info ──────────────────────────────────────────────────────
function StepCompany({ data, onChange, onNext }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Company name *</label>
        <input type="text" value={data.name} onChange={e => onChange({ name: e.target.value })}
          placeholder="Acme Corp"
          className="w-full bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600" />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Industry</label>
        <SearchSelect options={INDUSTRIES} value={data.industry} onChange={v => onChange({ industry: v })}
          placeholder="Select industry" getLabel={o => o} getValue={o => o} />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Reporting currency</label>
        <div className="flex gap-2 flex-wrap">
          {CURRENCIES.map(c => (
            <button key={c} type="button" onClick={() => onChange({ base_currency: c })}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                data.base_currency === c ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface border-border text-gray-500 hover:text-gray-300'
              }`}>{c}</button>
          ))}
        </div>
      </div>
      <button onClick={onNext} disabled={!data.name.trim()}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
        Continue →
      </button>
    </div>
  );
}

// ── Step 2: Final product + manufacturing location ────────────────────────────
function StepProduct({ data, onChange, onNext, onBack }) {
  const mfgCountry = data.manufacturing_country
    ? COUNTRIES.find(c => c.iso3 === data.manufacturing_country) : null;
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Tell us what you make and where — this determines manufacturing risk exposure and logistics analysis.</p>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Final product *</label>
        <input type="text" value={data.final_product || ''} onChange={e => onChange({ final_product: e.target.value })}
          placeholder="e.g. Packaged food products, Automotive components, Textiles…"
          className="w-full bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600" />
        <p className="text-[10px] text-gray-600 mt-1">Be specific — this shapes the entire AI analysis.</p>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Manufacturing / final import destination *</label>
        <SearchSelect
          options={COUNTRIES}
          value={data.manufacturing_country || ''}
          onChange={v => {
            const c = COUNTRIES.find(x => x.iso3 === v);
            onChange({ manufacturing_country: v, manufacturing_country_name: c?.name || v });
          }}
          placeholder="Where is your product made?"
          getLabel={o => `${flagEmoji(o.iso2)} ${o.name}`}
          getValue={o => o.iso3}
        />
        {mfgCountry && (
          <p className="text-[10px] text-green-500 mt-1">✓ {flagEmoji(mfgCountry.iso2)} {mfgCountry.name} selected</p>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button onClick={onNext} disabled={!data.final_product?.trim() || !data.manufacturing_country}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Materials ─────────────────────────────────────────────────────────
function StepMaterials({ materials, commodityMap, onAdd, onRemove, onNext, onBack }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [unit, setUnit] = useState('tonne');
  const [volume, setVolume] = useState('');
  const [cost, setCost] = useState('');
  const [showSugg, setShowSugg] = useState(false);

  const commodityList = Object.entries(commodityMap)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({ name: k, symbol: v }));
  const filtered = name.length > 0
    ? commodityList.filter(c => c.name.toLowerCase().includes(name.toLowerCase())).slice(0, 5)
    : [];

  const addMaterial = () => {
    if (!name.trim() || !volume || !cost) return;
    onAdd({ name: name.trim(), symbol: symbol || null, unit, monthly_volume: Number(volume), current_unit_cost: Number(cost), source_countries: [] });
    setName(''); setSymbol(''); setVolume(''); setCost('');
  };

  const monthlyTotal = materials.reduce((s, m) => s + (m.monthly_volume * m.current_unit_cost), 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Add every raw material or input commodity you purchase. Include current price per unit — this is the baseline for P&L impact modeling.</p>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="relative">
          <input type="text" value={name}
            onChange={e => { setName(e.target.value); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            placeholder="Commodity / material name (e.g. Wheat, Steel, Crude Oil)"
            className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600" />
          {showSugg && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
              {filtered.map(c => (
                <button key={c.name} type="button"
                  onMouseDown={() => { setName(c.name); setSymbol(c.symbol); setShowSugg(false); }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-surface border-b border-border/40 last:border-0">
                  <span className="text-white font-medium">{c.name}</span>
                  <span className="text-gray-500 text-xs">{c.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Monthly volume</label>
            <input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="500"
              className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Unit</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Price per unit ($)</label>
            <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="250"
              className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600" />
          </div>
        </div>
        <button type="button" onClick={addMaterial} disabled={!name.trim() || !volume || !cost}
          className="w-full py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
          + Add Material
        </button>
      </div>

      {materials.length > 0 && (
        <div className="space-y-2">
          {materials.map((m, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2">
              <span className="text-base">📦</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{m.name}</div>
                <div className="text-[10px] text-gray-600">
                  {m.monthly_volume?.toLocaleString()} {m.unit}/mo · ${m.current_unit_cost?.toLocaleString()}/{m.unit}
                  <span className="ml-2 text-gray-500">≈ ${(m.monthly_volume * m.current_unit_cost).toLocaleString()}/mo</span>
                </div>
              </div>
              <button onClick={() => onRemove(i)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
          <div className="text-right text-xs text-gray-500">
            Total monthly spend: <span className="text-white font-medium">${monthlyTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button onClick={onNext} disabled={materials.length === 0}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
          Continue with {materials.length} material{materials.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Source countries per material ─────────────────────────────────────
function StepSourceCountries({ materials, onChange, onNext, onBack }) {
  const [activeMat, setActiveMat] = useState(0);
  const [iso3, setIso3] = useState('');
  const [pct, setPct] = useState('');

  const mat = materials[activeMat];
  const countries = mat?.source_countries || [];
  const totalPct = countries.reduce((s, c) => s + (Number(c.supply_percentage) || 0), 0);
  const pieData = countries.map(c => ({ name: c.country_name, value: Number(c.supply_percentage) }));

  const addCountry = () => {
    const country = COUNTRIES.find(c => c.iso3 === iso3);
    if (!country || !pct) return;
    onChange(activeMat, 'source_countries', [...countries, {
      iso3: country.iso3, country_name: country.name, supply_percentage: Number(pct),
    }]);
    setIso3(''); setPct('');
  };

  const allHaveSources = materials.every(m => (m.source_countries || []).length > 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Where does each material come from? This determines your conflict exposure and supply chain risk score.</p>

      <div className="flex gap-1 flex-wrap">
        {materials.map((m, i) => (
          <button key={i} onClick={() => setActiveMat(i)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
              activeMat === i ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface border-border text-gray-500 hover:text-gray-300'
            }`}>
            {m.name}
            {(m.source_countries || []).length > 0 && <span className="ml-1 text-green-400">✓</span>}
          </button>
        ))}
      </div>

      {mat && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-white">{mat.name} — sourced from:</div>
          <div className="flex gap-4 items-start">
            {pieData.length > 0 && (
              <PieChart width={120} height={120} className="shrink-0">
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => `${v}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            )}
            <div className="flex-1 space-y-1.5">
              {countries.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span>{flagEmoji(COUNTRIES.find(x => x.iso3 === c.iso3)?.iso2 || '')}</span>
                  <span className="text-sm text-white flex-1">{c.country_name}</span>
                  <span className="text-xs text-blue-400 font-medium w-10 text-right">{c.supply_percentage}%</span>
                  <button onClick={() => onChange(activeMat, 'source_countries', countries.filter((_, j) => j !== i))}
                    className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
              {totalPct > 0 && (
                <div className={`text-xs font-bold mt-1 ${totalPct === 100 ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-amber-400'}`}>
                  Total: {totalPct}% {totalPct === 100 ? '✓' : totalPct > 100 ? '(over 100%)' : '(reach 100%)'}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchSelect options={COUNTRIES} value={iso3} onChange={setIso3}
                placeholder="Search source country…"
                getLabel={o => `${flagEmoji(o.iso2)} ${o.name}`} getValue={o => o.iso3} />
            </div>
            <input type="number" value={pct} onChange={e => setPct(e.target.value)} placeholder="%" min="1" max="100"
              className="w-16 bg-surface border border-border text-white text-sm px-2 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-center" />
            <button onClick={addCountry} disabled={!iso3 || !pct}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg">Add</button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button onClick={onNext} disabled={!allHaveSources}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
          {allHaveSources ? 'Continue →' : 'Add at least one source per material'}
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Buyer markets ─────────────────────────────────────────────────────
function StepBuyerMarkets({ buyers, onChange, onNext, onBack }) {
  const [iso3, setIso3] = useState('');
  const [pct, setPct] = useState('');

  const totalPct = buyers.reduce((s, b) => s + (Number(b.percentage) || 0), 0);
  const pieData = buyers.map(b => ({ name: b.country_name, value: Number(b.percentage) }));

  const addBuyer = () => {
    const country = COUNTRIES.find(c => c.iso3 === iso3);
    if (!country || !pct) return;
    if (buyers.some(b => b.iso3 === iso3)) return; // no duplicates
    onChange([...buyers, { iso3: country.iso3, country_name: country.name, percentage: Number(pct) }]);
    setIso3(''); setPct('');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Where do you sell your final product? This determines demand risk, purchasing power exposure, and currency risk from your buyer markets.</p>

      {buyers.length > 0 && (
        <div className="flex gap-4 items-start">
          {pieData.length > 1 && (
            <PieChart width={120} height={120} className="shrink-0">
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => `${v}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          )}
          <div className="flex-1 space-y-1.5">
            {buyers.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span>{flagEmoji(COUNTRIES.find(x => x.iso3 === b.iso3)?.iso2 || '')}</span>
                <span className="text-sm text-white flex-1">{b.country_name}</span>
                <span className="text-xs text-blue-400 font-medium w-10 text-right">{b.percentage}%</span>
                <button onClick={() => onChange(buyers.filter((_, j) => j !== i))}
                  className="text-gray-600 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
            {totalPct > 0 && (
              <div className={`text-xs font-bold mt-1 ${totalPct === 100 ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-amber-400'}`}>
                Total: {totalPct}% {totalPct === 100 ? '✓' : totalPct > 100 ? '(over 100%)' : '(reach 100%)'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <SearchSelect options={COUNTRIES} value={iso3} onChange={setIso3}
            placeholder="Search buyer country…"
            getLabel={o => `${flagEmoji(o.iso2)} ${o.name}`} getValue={o => o.iso3} />
        </div>
        <input type="number" value={pct} onChange={e => setPct(e.target.value)} placeholder="%" min="1" max="100"
          className="w-16 bg-surface border border-border text-white text-sm px-2 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-center" />
        <button onClick={addBuyer} disabled={!iso3 || !pct}
          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg">Add</button>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button onClick={onNext} disabled={buyers.length === 0}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 6: P&L + risk tolerance ──────────────────────────────────────────────
function StepFinancials({ pnl, tolerance, onChange, onChangeTolerance, onSave, onBack, isSaving }) {
  const [uploadMode, setUploadMode] = useState('manual');
  const [uploadError, setUploadError] = useState('');

  const rev = Number(pnl.annual_revenue) || 0;
  const cogsPct = Number(pnl.cogs_pct) || 0;
  const opexPct = Number(pnl.opex_pct) || 0;
  const grossPct = 100 - cogsPct;
  const netPct = grossPct - opexPct;
  const cogsAbs = rev * cogsPct / 100;
  const grossAbs = rev * grossPct / 100;
  const netAbs = rev * netPct / 100;

  const handleCSV = (file) => {
    if (!file) return;
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let revenue = 0, cogs = 0, opex = 0, grossProfit = 0, netProfit = 0;
        for (const line of lines) {
          const cols = line.split(',').map(c => c.replace(/["$,%]/g, '').trim());
          const label = cols[0].toLowerCase();
          const val = parseFloat(cols[cols.length - 1].replace(/,/g, '')) || 0;
          if (/^(total revenue|net revenue|revenue|sales|turnover)/.test(label)) revenue = Math.max(revenue, val);
          if (/^(cost of goods|cogs|cost of sales|direct costs)/.test(label)) cogs = val;
          if (/^(gross profit|gross margin)/.test(label)) grossProfit = val;
          if (/^(operating exp|opex|sg&a|total operating)/.test(label)) opex = val;
          if (/^(net (income|profit|earnings)|profit after tax)/.test(label)) netProfit = val;
        }
        if (revenue === 0 && grossProfit > 0 && cogs > 0) revenue = grossProfit + cogs;
        if (revenue > 0) {
          const parsedCogsPct = cogs > 0 ? Math.round((cogs / revenue) * 100) : (grossProfit > 0 ? Math.round(((revenue - grossProfit) / revenue) * 100) : 0);
          const parsedOpexPct = opex > 0 ? Math.round((opex / revenue) * 100) : 0;
          onChange({ annual_revenue: Math.round(revenue), cogs_pct: parsedCogsPct, opex_pct: parsedOpexPct });
          setUploadError('');
        } else {
          setUploadError('Could not parse revenue from CSV. Please check format or use manual entry.');
        }
      } catch {
        setUploadError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">P&L data powers the quarterly impact forecast and CFO sensitivity grid. Enter your most recent annual figures.</p>

      {/* Input mode toggle */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
        {['manual','csv'].map(m => (
          <button key={m} onClick={() => setUploadMode(m)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
              uploadMode === m ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>{m === 'manual' ? '✏ Manual Entry' : '📁 Upload P&L CSV'}</button>
        ))}
      </div>

      {uploadMode === 'csv' && (
        <div>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-blue-500 transition-colors">
            <span className="text-2xl mb-2">📊</span>
            <span className="text-sm text-gray-400">Click to upload P&L CSV</span>
            <span className="text-[10px] text-gray-600 mt-1">Expects rows like: Revenue, COGS, Gross Profit, OpEx, Net Income</span>
            <input type="file" accept=".csv" className="hidden" onChange={e => handleCSV(e.target.files?.[0])} />
          </label>
          {uploadError && <p className="text-xs text-red-400 mt-2">{uploadError}</p>}
          {pnl.annual_revenue > 0 && <p className="text-xs text-green-400 mt-2">✓ P&L parsed — review figures below</p>}
        </div>
      )}

      {/* Manual / parsed fields */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Annual Revenue ($) *</label>
          <input type="number" value={pnl.annual_revenue || ''} onChange={e => onChange({ annual_revenue: Number(e.target.value) })}
            placeholder="e.g. 50000000"
            className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">COGS as % of Revenue</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="95" value={cogsPct} onChange={e => onChange({ cogs_pct: Number(e.target.value) })} className="flex-1" />
              <span className="text-sm text-white w-10 text-right font-mono">{cogsPct}%</span>
            </div>
            {cogsAbs > 0 && <div className="text-[10px] text-gray-600 mt-0.5">= ${cogsAbs.toLocaleString()}</div>}
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">OpEx as % of Revenue</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="60" value={opexPct} onChange={e => onChange({ opex_pct: Number(e.target.value) })} className="flex-1" />
              <span className="text-sm text-white w-10 text-right font-mono">{opexPct}%</span>
            </div>
          </div>
        </div>

        {/* Live P&L preview */}
        {rev > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2 pt-3 border-t border-border">
            {[
              { label: 'Gross Margin', value: `${grossPct}%`, sub: `$${grossAbs.toLocaleString()}`, color: grossPct > 30 ? 'text-green-400' : 'text-amber-400' },
              { label: 'OpEx', value: `${opexPct}%`, sub: `$${Math.round(rev * opexPct / 100).toLocaleString()}`, color: 'text-gray-300' },
              { label: 'Net Profit', value: `${netPct.toFixed(1)}%`, sub: `$${netAbs.toLocaleString()}`, color: netPct > 10 ? 'text-green-400' : netPct > 0 ? 'text-amber-400' : 'text-red-400' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <div className={`text-base font-bold ${c.color}`}>{c.value}</div>
                <div className="text-[10px] text-gray-500">{c.label}</div>
                <div className="text-[10px] text-gray-600">{c.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Risk tolerance */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <label className="text-xs text-gray-400 block mb-2">Profit tolerance — alert me if net profit drops more than:</label>
        <div className="flex items-center gap-3">
          <input type="range" min="5" max="50" step="5" value={tolerance} onChange={e => onChangeTolerance(Number(e.target.value))} className="flex-1" />
          <span className="text-lg font-bold text-amber-400 font-mono w-14 text-right">{tolerance}%</span>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5">
          Quarters where projected profit decline exceeds this threshold will be flagged 🚨 in the analysis.
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button onClick={onSave} disabled={isSaving || !pnl.annual_revenue}
          className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
          {isSaving ? '⟳ Saving…' : '✓ Save & Run Analysis →'}
        </button>
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function CompanySetup({ onCreated, onClose }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [commodityMap, setCommodityMap] = useState({});

  const [company, setCompany] = useState({ name: '', industry: '', base_currency: 'USD' });
  const [product, setProduct] = useState({ final_product: '', manufacturing_country: '', manufacturing_country_name: '' });
  const [materials, setMaterials] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [pnl, setPnl] = useState({ annual_revenue: 0, cogs_pct: 60, opex_pct: 20 });
  const [tolerance, setTolerance] = useState(15);

  useEffect(() => {
    fetch(`${API}/supply-chain/commodity-symbols`).then(r => r.json()).then(setCommodityMap).catch(() => {});
  }, []);

  const updateMaterialSources = (idx, key, value) => {
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, [key]: value } : m));
  };

  const save = async () => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        ...company,
        ...product,
        materials,
        buyer_markets: buyers,
        pnl,
        risk_tolerance: { max_profit_drop_pct: tolerance },
      };
      const res = await fetch(`${API}/supply-chain/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Save failed');
      }
      onCreated(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Supply Chain Setup</h2>
            <p className="text-[11px] text-gray-500">Step {step} of {STEP_LABELS.length} — {STEP_LABELS[step - 1]?.label}</p>
          </div>
          {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg leading-none">✕</button>}
        </div>

        {/* Step indicator */}
        <div className="flex px-5 py-3 gap-1 border-b border-border shrink-0 overflow-x-auto">
          {STEP_LABELS.map(({ n, label }) => (
            <div key={n} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                step === n ? 'bg-blue-600 text-white' : step > n ? 'bg-green-700 text-white' : 'bg-surface text-gray-600'
              }`}>{step > n ? '✓' : n}</div>
              <span className={`text-[9px] font-medium truncate ${step === n ? 'text-white' : 'text-gray-600'}`}>{label}</span>
              {n < STEP_LABELS.length && <div className="h-px bg-border flex-1 min-w-[4px]" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 p-3 bg-red-950/30 border border-red-800 rounded-lg text-xs text-red-300">{error}</div>}

          {step === 1 && (
            <StepCompany data={company} onChange={u => setCompany(p => ({ ...p, ...u }))} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <StepProduct data={product} onChange={u => setProduct(p => ({ ...p, ...u }))} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <StepMaterials materials={materials} commodityMap={commodityMap}
              onAdd={m => setMaterials(p => [...p, m])}
              onRemove={i => setMaterials(p => p.filter((_, idx) => idx !== i))}
              onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <StepSourceCountries materials={materials} onChange={updateMaterialSources} onNext={() => setStep(5)} onBack={() => setStep(3)} />
          )}
          {step === 5 && (
            <StepBuyerMarkets buyers={buyers} onChange={setBuyers} onNext={() => setStep(6)} onBack={() => setStep(4)} />
          )}
          {step === 6 && (
            <StepFinancials pnl={pnl} tolerance={tolerance}
              onChange={u => setPnl(p => ({ ...p, ...u }))}
              onChangeTolerance={setTolerance}
              onSave={save} onBack={() => setStep(5)} isSaving={isSaving} />
          )}
        </div>
      </div>
    </div>
  );
}
