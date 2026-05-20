import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProductSetup from './ProductSetup';
import PriceOptimizer from './PriceOptimizer';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function fmt(n, currency = 'USD') {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Derive traffic-light status from margin figures
function trafficLight(product) {
  const { current_margin_pct, target_margin_pct, minimum_margin_pct } = product;
  if (current_margin_pct < minimum_margin_pct) return 'red';
  if (current_margin_pct < target_margin_pct - 3) return 'yellow';
  return 'green';
}

const LIGHT_STYLES = {
  green:  { dot: 'bg-green-500',  label: 'Healthy',         badge: 'border-green-800 text-green-400 bg-green-950/20' },
  yellow: { dot: 'bg-amber-500',  label: 'Under pressure',  badge: 'border-amber-800 text-amber-400 bg-amber-950/20' },
  red:    { dot: 'bg-red-500 animate-pulse', label: 'Action needed', badge: 'border-red-800 text-red-400 bg-red-950/20' },
};

function ProductRow({ product, companyId, onSelect, onEdit, onDelete }) {
  const light = trafficLight(product);
  const styles = LIGHT_STYLES[light];

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 border rounded-xl transition-all cursor-pointer hover:border-blue-700/50 ${styles.badge}`}
      onClick={() => onSelect(product)}>
      {/* Traffic light */}
      <div className={`w-3 h-3 rounded-full shrink-0 ${styles.dot}`} title={styles.label} />

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">{product.name}</span>
          {product.sku && <span className="text-[10px] text-gray-600">{product.sku}</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
          <span>{fmt(product.current_selling_price, product.currency)}</span>
          {product.markets?.length > 0 && <span>{product.markets.length} market{product.markets.length !== 1 ? 's' : ''}</span>}
          {product.linked_materials?.length > 0 && <span>{product.linked_materials.length} material{product.linked_materials.length !== 1 ? 's' : ''} linked</span>}
        </div>
      </div>

      {/* Margin bars */}
      <div className="hidden md:flex flex-col gap-1 w-40 shrink-0">
        {[
          { label: 'Current', pct: product.current_margin_pct, color: light === 'red' ? 'bg-red-500' : light === 'yellow' ? 'bg-amber-500' : 'bg-green-500' },
          { label: 'Target',  pct: product.target_margin_pct,  color: 'bg-blue-600/50' },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="text-[9px] text-gray-600 w-9 shrink-0">{row.label}</span>
            <div className="flex-1 bg-surface rounded-full h-1 overflow-hidden">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
            </div>
            <span className="text-[9px] text-gray-400 w-8 text-right">{row.pct}%</span>
          </div>
        ))}
      </div>

      {/* Status badge */}
      <div className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${styles.badge}`}>
        {styles.label.toUpperCase()}
      </div>

      {/* Markets sensitivity summary */}
      {product.markets?.length > 0 && (
        <div className="hidden lg:flex gap-1 shrink-0">
          {product.markets.slice(0, 3).map((m, i) => (
            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${
              m.price_sensitivity === 'high'   ? 'border-red-800 text-red-400' :
              m.price_sensitivity === 'medium' ? 'border-amber-800 text-amber-400' :
              'border-green-800 text-green-400'
            }`}>{m.region}</span>
          ))}
          {product.markets.length > 3 && <span className="text-[9px] text-gray-600">+{product.markets.length - 3}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onEdit(product)}
          className="text-[10px] px-2 py-1 border border-border text-gray-500 hover:text-gray-200 rounded-lg transition-colors"
        >
          ✏
        </button>
        <button
          onClick={() => { if (confirm(`Delete "${product.name}"?`)) onDelete(product.id); }}
          className="text-[10px] px-2 py-1 border border-border text-gray-500 hover:text-red-400 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function PricingDashboard({ companyId, company }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pricing-products', companyId],
    queryFn: async () => {
      const res = await fetch(`${API}/pricing/products/${companyId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!companyId,
  });

  // Company materials for the product setup form
  const materials = company?.materials || [];

  const handleSaved = (product) => {
    queryClient.invalidateQueries({ queryKey: ['pricing-products', companyId] });
    queryClient.invalidateQueries({ queryKey: ['pricing-scenarios', companyId, product.id] });
    setSetupOpen(false);
    setEditingProduct(null);
  };

  const handleDelete = async (productId) => {
    await fetch(`${API}/pricing/products/${companyId}/${productId}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['pricing-products', companyId] });
    if (selectedProduct?.id === productId) setSelectedProduct(null);
  };

  // Drill-in to optimizer
  if (selectedProduct) {
    return (
      <PriceOptimizer
        product={selectedProduct}
        companyId={companyId}
        onBack={() => setSelectedProduct(null)}
      />
    );
  }

  // Summary stats
  const byStatus = { green: 0, yellow: 0, red: 0 };
  products.forEach(p => byStatus[trafficLight(p)]++);

  return (
    <>
      {(setupOpen || editingProduct) && (
        <ProductSetup
          companyId={companyId}
          materials={materials}
          initialProduct={editingProduct}
          onSaved={handleSaved}
          onClose={() => { setSetupOpen(false); setEditingProduct(null); }}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">Selling Price Optimizer</h3>
            <p className="text-xs text-gray-500">{company?.name} · {products.length} product{products.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setSetupOpen(true)}
            className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            + Add product
          </button>
        </div>

        {/* Status summary */}
        {products.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'green',  icon: '🟢', label: 'Healthy',         desc: 'Margin above target' },
              { key: 'yellow', icon: '🟡', label: 'Under pressure',  desc: 'Review recommended' },
              { key: 'red',    icon: '🔴', label: 'Action needed',   desc: 'Below minimum margin' },
            ].map(s => (
              <div key={s.key} className="bg-surface border border-border rounded-xl px-4 py-3 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-bold text-white">{byStatus[s.key]}</div>
                <div className="text-[10px] text-gray-400 font-medium">{s.label}</div>
                <div className="text-[9px] text-gray-600">{s.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Products list */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div className="text-center py-14 space-y-3">
            <div className="text-4xl">💰</div>
            <h4 className="text-white font-bold">No products yet</h4>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Add products to calculate optimal selling prices based on raw material cost changes from conflict data.
            </p>
            <button
              onClick={() => setSetupOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition-colors"
            >
              + Add your first product
            </button>
          </div>
        )}

        {products.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] text-gray-600 px-1">Click any product to open the price optimizer →</div>
            {products.map(p => (
              <ProductRow
                key={p.id}
                product={p}
                companyId={companyId}
                onSelect={setSelectedProduct}
                onEdit={(prod) => setEditingProduct(prod)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
