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

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
const UNITS = ['tonne','kg','litre','barrel','unit','m³','MWh','piece','kg CO2e'];
const CURRENCIES = ['USD','EUR','GBP','JPY','CHF','AUD','CAD','SGD'];

// Searchable dropdown
function SearchSelect({ options, value, onChange, placeholder, getLabel, getValue }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = options.filter(o =>
    getLabel(o).toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  const selected = value ? options.find(o => getValue(o) === value) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-surface border border-border text-sm px-3 py-2 rounded-lg text-left focus:outline-none focus:border-blue-500"
      >
        <span className={selected ? 'text-white' : 'text-gray-600'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="text-gray-600 ml-2">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full px-3 py-2 bg-surface text-sm text-white border-b border-border focus:outline-none placeholder-gray-600"
          />
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No results</div>
            ) : filtered.map(o => (
              <button
                key={getValue(o)}
                type="button"
                onMouseDown={() => { onChange(getValue(o)); setOpen(false); setQ(''); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white border-b border-border/40 last:border-0"
              >
                {getLabel(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Step 1
function StepCompany({ data, onChange, onNext }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Company name *</label>
        <input
          type="text"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Acme Corp"
          className="w-full bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Industry</label>
        <SearchSelect
          options={INDUSTRIES}
          value={data.industry}
          onChange={v => onChange({ industry: v })}
          placeholder="Select or type industry"
          getLabel={o => o}
          getValue={o => o}
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Base currency</label>
        <div className="flex gap-2 flex-wrap">
          {CURRENCIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ base_currency: c })}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                data.base_currency === c
                  ? 'bg-blue-700 border-blue-500 text-white'
                  : 'bg-surface border-border text-gray-500 hover:text-gray-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onNext}
        disabled={!data.name.trim()}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Continue →
      </button>
    </div>
  );
}

// Step 2
function StepMaterials({ materials, commodityMap, onAdd, onRemove, onNext, onBack }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [unit, setUnit] = useState('tonne');
  const [volume, setVolume] = useState('');
  const [cost, setCost] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const commodityList = Object.entries(commodityMap)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({ name: k, symbol: v }));

  const filtered = name.length > 0
    ? commodityList.filter(c => c.name.toLowerCase().includes(name.toLowerCase())).slice(0, 5)
    : [];

  const addMaterial = () => {
    if (!name.trim() || !volume || !cost) return;
    onAdd({ name: name.trim(), symbol: symbol || null, unit, monthly_volume: Number(volume), current_unit_cost: Number(cost), source_countries: [], suppliers: [] });
    setName(''); setSymbol(''); setVolume(''); setCost('');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Add the raw materials your company purchases. These will be monitored for price changes and supply risks.</p>

      {/* Add material form */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Material name (e.g. Wheat, Crude Oil)"
            className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
              {filtered.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onMouseDown={() => { setName(c.name); setSymbol(c.symbol); setShowSuggestions(false); }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-surface transition-colors border-b border-border/40 last:border-0"
                >
                  <span className="text-white font-medium">{c.name}</span>
                  <span className="text-gray-500 text-xs">{c.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Monthly volume</label>
            <input
              type="number"
              value={volume}
              onChange={e => setVolume(e.target.value)}
              placeholder="e.g. 500"
              className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Unit</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Current unit cost ($)</label>
          <input
            type="number"
            value={cost}
            onChange={e => setCost(e.target.value)}
            placeholder="e.g. 250 per tonne"
            className="w-full bg-card border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
        </div>

        <button
          type="button"
          onClick={addMaterial}
          disabled={!name.trim() || !volume || !cost}
          className="w-full py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >
          + Add Material
        </button>
      </div>

      {/* Added materials list */}
      {materials.length > 0 && (
        <div className="space-y-2">
          {materials.map((m, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2">
              <span className="text-lg">📦</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{m.name}</span>
                {m.symbol && <span className="text-xs text-gray-500 ml-2">{m.symbol}</span>}
                <div className="text-[10px] text-gray-600">{m.monthly_volume?.toLocaleString()} {m.unit}/mo · ${m.current_unit_cost}/{m.unit}</div>
              </div>
              <button onClick={() => onRemove(i)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button
          onClick={onNext}
          disabled={materials.length === 0}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Continue with {materials.length} material{materials.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}

// Step 3
function StepSourceCountries({ materials, onChange, onNext, onBack }) {
  const [activeMaterial, setActiveMaterial] = useState(0);
  const mat = materials[activeMaterial];
  const countries = mat?.source_countries || [];

  const [iso3, setIso3] = useState('');
  const [pct, setPct] = useState('');

  const totalPct = countries.reduce((s, c) => s + (Number(c.supply_percentage) || 0), 0);

  const addCountry = () => {
    const country = COUNTRIES.find(c => c.iso3 === iso3);
    if (!country || !pct) return;
    const newCountries = [...countries, {
      iso3: country.iso3,
      country_name: country.name,
      supply_percentage: Number(pct),
    }];
    onChange(activeMaterial, 'source_countries', newCountries);
    setIso3(''); setPct('');
  };

  const removeCountry = (idx) => {
    onChange(activeMaterial, 'source_countries', countries.filter((_, i) => i !== idx));
  };

  const pieData = countries.map(c => ({ name: c.country_name, value: Number(c.supply_percentage) }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Where does each material come from? This determines conflict exposure.</p>

      {/* Material tabs */}
      <div className="flex gap-1 flex-wrap">
        {materials.map((m, i) => (
          <button
            key={i}
            onClick={() => setActiveMaterial(i)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
              activeMaterial === i ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface border-border text-gray-500 hover:text-gray-300'
            }`}
          >
            {m.name}
            {m.source_countries?.length > 0 && <span className="ml-1 text-green-400">✓</span>}
          </button>
        ))}
      </div>

      {mat && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-white">{mat.name} — source countries</div>

          {/* Pie chart + list */}
          <div className="flex gap-4 items-start">
            {pieData.length > 0 && (
              <div className="shrink-0">
                <PieChart width={140} height={140}>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => `${v}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              {countries.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-lg">{flagEmoji(COUNTRIES.find(x => x.iso3 === c.iso3)?.iso2 || '')}</span>
                  <span className="text-sm text-white flex-1">{c.country_name}</span>
                  <span className="text-xs text-blue-400 font-medium">{c.supply_percentage}%</span>
                  <button onClick={() => removeCountry(i)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
              {totalPct > 0 && (
                <div className={`text-xs font-bold ${totalPct === 100 ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-amber-400'}`}>
                  Total: {totalPct}% {totalPct === 100 ? '✓' : totalPct > 100 ? '(over 100%)' : '(must reach 100%)'}
                </div>
              )}
            </div>
          </div>

          {/* Add country */}
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchSelect
                options={COUNTRIES}
                value={iso3}
                onChange={v => setIso3(v)}
                placeholder="Search country…"
                getLabel={o => `${flagEmoji(o.iso2)} ${o.name}`}
                getValue={o => o.iso3}
              />
            </div>
            <input
              type="number"
              value={pct}
              onChange={e => setPct(e.target.value)}
              placeholder="%"
              min="1"
              max="100"
              className="w-16 bg-surface border border-border text-white text-sm px-2 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-center"
            />
            <button
              onClick={addCountry}
              disabled={!iso3 || !pct}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button
          onClick={onNext}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// Step 4
function StepSuppliers({ materials, onChange, onSave, onBack, isSaving }) {
  const [activeMaterial, setActiveMaterial] = useState(0);
  const mat = materials[activeMaterial];
  const suppliers = mat?.suppliers || [];

  const [sName, setSName] = useState('');
  const [sCountry, setSCountry] = useState('');
  const [sContract, setSContract] = useState('long-term');
  const [sLead, setSLead] = useState('');
  const [sReliability, setSReliability] = useState('80');

  const addSupplier = () => {
    if (!sName.trim()) return;
    const country = COUNTRIES.find(c => c.iso3 === sCountry);
    const newSuppliers = [...suppliers, {
      name: sName.trim(),
      country_iso3: sCountry,
      country_name: country?.name || sCountry,
      contract_type: sContract,
      lead_time_days: Number(sLead) || 0,
      reliability_score: Number(sReliability) || 80,
    }];
    onChange(activeMaterial, 'suppliers', newSuppliers);
    setSName(''); setSCountry(''); setSLead('');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Optionally add supplier details for more precise risk analysis. Skip any material you don't have data for.</p>

      {/* Material tabs */}
      <div className="flex gap-1 flex-wrap">
        {materials.map((m, i) => (
          <button
            key={i}
            onClick={() => setActiveMaterial(i)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
              activeMaterial === i ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface border-border text-gray-500 hover:text-gray-300'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {mat && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-white">{mat.name} suppliers</div>

          {suppliers.length > 0 && (
            <div className="space-y-1.5">
              {suppliers.map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 text-xs">
                  <span className="font-medium text-white flex-1">{s.name}</span>
                  <span className="text-gray-500">{s.country_name || s.country_iso3}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] ${
                    s.contract_type === 'long-term' ? 'border-green-800 text-green-400' :
                    s.contract_type === 'forward' ? 'border-blue-800 text-blue-400' :
                    'border-gray-700 text-gray-400'
                  }`}>{s.contract_type}</span>
                  <span className="text-gray-500">{s.lead_time_days}d</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              value={sName}
              onChange={e => setSName(e.target.value)}
              placeholder="Supplier name"
              className="col-span-2 bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
            <SearchSelect
              options={COUNTRIES}
              value={sCountry}
              onChange={setSCountry}
              placeholder="Country"
              getLabel={o => `${flagEmoji(o.iso2)} ${o.name}`}
              getValue={o => o.iso3}
            />
            <select
              value={sContract}
              onChange={e => setSContract(e.target.value)}
              className="bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="long-term">Long-term</option>
              <option value="forward">Forward</option>
              <option value="spot">Spot</option>
            </select>
            <input
              type="number"
              value={sLead}
              onChange={e => setSLead(e.target.value)}
              placeholder="Lead time (days)"
              className="bg-surface border border-border text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 shrink-0">Reliability</label>
              <input type="range" min="0" max="100" value={sReliability} onChange={e => setSReliability(e.target.value)} className="flex-1" />
              <span className="text-xs text-white w-8">{sReliability}%</span>
            </div>
          </div>
          <button
            onClick={addSupplier}
            disabled={!sName.trim()}
            className="w-full py-1.5 bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
          >
            + Add Supplier
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300">← Back</button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving…' : '✓ Save & Analyze →'}
        </button>
      </div>
    </div>
  );
}

// Main wizard
export default function CompanySetup({ onCreated, onClose }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [commodityMap, setCommodityMap] = useState({});

  const [company, setCompany] = useState({ name: '', industry: '', base_currency: 'USD' });
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    fetch(`${API}/supply-chain/commodity-symbols`)
      .then(r => r.json())
      .then(setCommodityMap)
      .catch(() => {});
  }, []);

  const updateMaterialField = (idx, key, value) => {
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, [key]: value } : m));
  };

  const save = async () => {
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/supply-chain/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...company, materials }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Save failed');
      }
      const created = await res.json();
      onCreated(created);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const STEP_LABELS = ['Company', 'Materials', 'Sources', 'Suppliers'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Supply Chain Setup</h2>
            <p className="text-[11px] text-gray-500">Configure your materials and sources for risk analysis</p>
          </div>
          {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg">✕</button>}
        </div>

        {/* Step indicator */}
        <div className="flex px-5 py-3 gap-1.5 border-b border-border shrink-0">
          {STEP_LABELS.map((label, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-700 text-white' : 'bg-surface text-gray-500'
                }`}>{step > s ? '✓' : s}</div>
                <span className={`text-[10px] font-medium ${step === s ? 'text-white' : 'text-gray-600'}`}>{label}</span>
                {i < 3 && <div className="h-px bg-border flex-1" />}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 p-3 bg-red-950/30 border border-red-800 rounded-lg text-xs text-red-300">{error}</div>}

          {step === 1 && (
            <StepCompany
              data={company}
              onChange={updates => setCompany(p => ({ ...p, ...updates }))}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepMaterials
              materials={materials}
              commodityMap={commodityMap}
              onAdd={m => setMaterials(p => [...p, m])}
              onRemove={i => setMaterials(p => p.filter((_, idx) => idx !== i))}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepSourceCountries
              materials={materials}
              onChange={updateMaterialField}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <StepSuppliers
              materials={materials}
              onChange={updateMaterialField}
              onSave={save}
              onBack={() => setStep(3)}
              isSaving={isSaving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
