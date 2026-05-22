import { useState } from 'react';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD'];
const REGIONS = ['North America', 'Europe', 'Southeast Asia', 'China', 'Latin America', 'Middle East', 'Africa', 'South Asia', 'ANZ'];
const SENSITIVITY = ['low', 'medium', 'high'];

function Slider({ label, value, min = 0, max = 100, step = 1, onChange, unit = '%', hint }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-gray-400">{label}</label>
        <span className="text-xs font-bold text-white">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
      {hint && <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600';
const SELECT = INPUT + ' cursor-pointer';

export default function ProductSetup({ companyId, materials = [], onSaved, onClose, initialProduct = null }) {
  const editing = !!initialProduct;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: initialProduct?.name || '',
    sku: initialProduct?.sku || '',
    current_selling_price: initialProduct?.current_selling_price || '',
    currency: initialProduct?.currency || 'USD',
    monthly_units: initialProduct?.monthly_units || 1000,
    current_margin_pct: initialProduct?.current_margin_pct || 25,
    target_margin_pct: initialProduct?.target_margin_pct || 30,
    minimum_margin_pct: initialProduct?.minimum_margin_pct || 15,
    raw_material_cost_pct: initialProduct?.raw_material_cost_pct || 50,
    linked_materials: initialProduct?.linked_materials || [],
    markets: initialProduct?.markets || [],
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Markets management
  const [mktDraft, setMktDraft] = useState({ region: '', price_sensitivity: 'medium', current_price: '', currency: 'USD', competitor_prices: '' });
  const addMarket = () => {
    if (!mktDraft.region || !mktDraft.current_price) return;
    const mkt = {
      region: mktDraft.region,
      price_sensitivity: mktDraft.price_sensitivity,
      current_price: Number(mktDraft.current_price),
      currency: mktDraft.currency,
      competitor_prices: mktDraft.competitor_prices
        ? mktDraft.competitor_prices.split(',').map(s => Number(s.trim())).filter(Boolean)
        : [],
    };
    set('markets', [...form.markets, mkt]);
    setMktDraft({ region: '', price_sensitivity: 'medium', current_price: '', currency: 'USD', competitor_prices: '' });
  };
  const removeMarket = (i) => set('markets', form.markets.filter((_, idx) => idx !== i));

  const toggleMaterial = (id) => {
    set('linked_materials', form.linked_materials.includes(id)
      ? form.linked_materials.filter(x => x !== id)
      : [...form.linked_materials, id]);
  };

  const handleSave = async () => {
    if (!form.name || !form.current_selling_price) { setError('Product name and price are required'); return; }
    setSaving(true); setError('');
    try {
      const body = { ...form, current_selling_price: Number(form.current_selling_price), monthly_units: Number(form.monthly_units) };
      let res;
      if (editing) {
        res = await fetch(`${API}/pricing/products/${companyId}/${initialProduct.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API}/pricing/products`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, ...body }),
        });
      }
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      const saved = await res.json();
      onSaved(saved);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const STEPS = ['Basics', 'Margins', 'Markets', 'Materials'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">{editing ? 'Edit Product' : 'Add Product'}</h2>
            <p className="text-xs text-gray-500">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl px-1">×</button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 pt-4 gap-2 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${i < step ? 'bg-blue-500' : 'bg-border'}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Step 1: Basics */}
          {step === 1 && (
            <>
              <Field label="Product name *">
                <input className={INPUT} placeholder="e.g. Industrial Adhesive 500g" value={form.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="SKU (optional)">
                <input className={INPUT} placeholder="e.g. ADH-500-IND" value={form.sku} onChange={e => set('sku', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Current selling price *">
                  <input className={INPUT} type="number" min="0" step="0.01" placeholder="0.00" value={form.current_selling_price} onChange={e => set('current_selling_price', e.target.value)} />
                </Field>
                <Field label="Currency">
                  <select className={SELECT} value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Monthly units sold">
                <input className={INPUT} type="number" min="1" value={form.monthly_units} onChange={e => set('monthly_units', e.target.value)} />
              </Field>
            </>
          )}

          {/* Step 2: Margins */}
          {step === 2 && (
            <>
              <div className="bg-surface border border-border rounded-xl p-3 text-xs text-gray-400 leading-relaxed">
                These margin thresholds drive the scenario calculations. Current margin = what you have today. Target = what you aim for. Minimum = floor below which you must act.
              </div>
              <Slider label="Current margin %" value={form.current_margin_pct} onChange={v => set('current_margin_pct', v)} hint="Your actual margin today" />
              <Slider label="Target margin %" value={form.target_margin_pct} onChange={v => set('target_margin_pct', v)} hint="Your ideal margin to maintain" />
              <Slider label="Minimum acceptable margin %" value={form.minimum_margin_pct} onChange={v => set('minimum_margin_pct', v)} hint="Floor — below this triggers urgent action" />
              <Slider label="Raw materials as % of COGS" value={form.raw_material_cost_pct} onChange={v => set('raw_material_cost_pct', v)} hint="How much of your cost of goods is raw materials" />

              {/* Visual margin stack */}
              <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Margin structure preview</div>
                {[
                  { label: 'Gross margin', pct: form.current_margin_pct, color: 'bg-blue-500' },
                  { label: 'Target margin', pct: form.target_margin_pct, color: 'bg-green-500' },
                  { label: 'Min margin', pct: form.minimum_margin_pct, color: 'bg-amber-500' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-24 shrink-0">{row.label}</span>
                    <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden border border-border">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="text-xs text-white w-8 text-right">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Markets */}
          {step === 3 && (
            <>
              <p className="text-xs text-gray-500">Add the markets where you sell this product. Market-by-market pricing strategy will be generated per market.</p>

              {/* Existing markets */}
              {form.markets.length > 0 && (
                <div className="space-y-2">
                  {form.markets.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface border border-border rounded-xl px-3 py-2">
                      <div>
                        <span className="text-sm text-white font-medium">{m.region}</span>
                        <span className="text-xs text-gray-500 ml-2">{m.currency} {m.current_price}</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border ${
                          m.price_sensitivity === 'high' ? 'border-red-800 text-red-400' :
                          m.price_sensitivity === 'medium' ? 'border-amber-800 text-amber-400' :
                          'border-green-800 text-green-400'
                        }`}>{m.price_sensitivity} sensitivity</span>
                      </div>
                      <button onClick={() => removeMarket(i)} className="text-gray-600 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add market form */}
              <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Add market</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Region">
                    <select className={SELECT} value={mktDraft.region} onChange={e => setMktDraft(d => ({ ...d, region: e.target.value }))}>
                      <option value="">Select region…</option>
                      {REGIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Price sensitivity">
                    <select className={SELECT} value={mktDraft.price_sensitivity} onChange={e => setMktDraft(d => ({ ...d, price_sensitivity: e.target.value }))}>
                      {SENSITIVITY.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Current price in this market">
                    <input className={INPUT} type="number" min="0" step="0.01" placeholder="0.00" value={mktDraft.current_price} onChange={e => setMktDraft(d => ({ ...d, current_price: e.target.value }))} />
                  </Field>
                  <Field label="Market currency">
                    <select className={SELECT} value={mktDraft.currency} onChange={e => setMktDraft(d => ({ ...d, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Competitor prices (comma-separated, optional)">
                  <input className={INPUT} placeholder="e.g. 45.00, 48.50, 52.00" value={mktDraft.competitor_prices} onChange={e => setMktDraft(d => ({ ...d, competitor_prices: e.target.value }))} />
                </Field>
                <button onClick={addMarket} disabled={!mktDraft.region || !mktDraft.current_price} className="w-full py-2 text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg transition-colors">
                  + Add market
                </button>
              </div>
            </>
          )}

          {/* Step 4: Link materials */}
          {step === 4 && (
            <>
              <p className="text-xs text-gray-500">Link the raw materials used to make this product. Cost impact will be calculated from these materials.</p>
              {materials.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No materials found. Add materials in the Supply Chain setup first.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map(m => {
                    const selected = form.linked_materials.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMaterial(m.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                          selected ? 'bg-blue-950/40 border-blue-700' : 'bg-surface border-border hover:border-gray-500'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-blue-500 border-blue-400' : 'border-gray-600'}`}>
                          {selected && <span className="text-white text-[10px] leading-none">✓</span>}
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">{m.name}</div>
                          {m.symbol && <div className="text-[10px] text-gray-500">{m.symbol} · {m.monthly_volume?.toLocaleString()} {m.unit}/mo</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-gray-600">Leave all unselected to use all materials for cost impact.</p>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm px-4 py-2 border border-border text-gray-400 hover:text-gray-200 rounded-lg transition-colors"
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          {step < STEPS.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && (!form.name || !form.current_selling_price)}
              className="text-sm px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : '+ Add product'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
