import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, CartesianGrid, Legend,
} from 'recharts';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const MONTH_OPTIONS = [3, 6, 12];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-bold text-white mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-medium">{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function MarginForecast({ companyId, productId }) {
  const [months, setMonths] = useState(12);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pricing-forecast', companyId, productId, months],
    queryFn: async () => {
      const res = await fetch(`${API}/pricing/forecast/${companyId}/${productId}?months=${months}`);
      if (!res.ok) throw new Error('Failed to load forecast');
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isError || !data) return (
    <div className="text-center py-8 text-red-400 text-sm">Failed to load margin forecast</div>
  );

  const { forecast, target_margin, minimum_margin, recommended_price, current_price, price_increase_timing_month } = data;

  // Y-axis domain: padded around the data range
  const allVals = forecast.flatMap(f => [f.margin_no_increase, f.margin_with_increase, target_margin, minimum_margin]);
  const minY = Math.floor(Math.min(...allVals) - 3);
  const maxY = Math.ceil(Math.max(...allVals) + 3);

  // Find month where no-increase margin crosses below minimum
  const criticalMonth = forecast.find(f => f.margin_no_increase < minimum_margin);

  return (
    <div className="space-y-4">
      {/* Month toggle */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Margin Forecast</div>
        <div className="flex gap-1">
          {MONTH_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                months === m ? 'bg-blue-700 border-blue-500 text-white' : 'border-border text-gray-500 hover:text-gray-300'
              }`}
            >
              {m}mo
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl px-3 py-2.5 text-center">
          <div className="text-sm font-bold text-white">{current_price != null ? `$${current_price.toFixed(2)}` : '—'}</div>
          <div className="text-[10px] text-gray-500">Current price</div>
        </div>
        <div className="bg-surface border border-green-800 rounded-xl px-3 py-2.5 text-center">
          <div className="text-sm font-bold text-green-300">{recommended_price != null ? `$${recommended_price.toFixed(2)}` : '—'}</div>
          <div className="text-[10px] text-gray-500">Recommended price</div>
        </div>
        <div className="bg-surface border border-border rounded-xl px-3 py-2.5 text-center">
          <div className={`text-sm font-bold ${criticalMonth ? 'text-red-400' : 'text-green-400'}`}>
            {criticalMonth ? `M+${criticalMonth.month}` : 'Never'}
          </div>
          <div className="text-[10px] text-gray-500">Margin breach (no action)</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={forecast} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[minY, maxY]}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(val) => <span style={{ color: '#9ca3af' }}>{val}</span>}
            />

            {/* Danger zone: below minimum margin */}
            <ReferenceArea
              y1={minY}
              y2={minimum_margin}
              fill="#7f1d1d"
              fillOpacity={0.15}
              label={{ value: 'Danger zone', position: 'insideBottomLeft', fontSize: 10, fill: '#ef4444' }}
            />

            {/* Target margin reference line */}
            <ReferenceLine
              y={target_margin}
              stroke="#3b82f6"
              strokeDasharray="5 3"
              label={{ value: `Target ${target_margin}%`, position: 'right', fontSize: 10, fill: '#3b82f6' }}
            />

            {/* Minimum margin reference line */}
            <ReferenceLine
              y={minimum_margin}
              stroke="#ef4444"
              strokeDasharray="4 2"
              label={{ value: `Min ${minimum_margin}%`, position: 'right', fontSize: 10, fill: '#ef4444' }}
            />

            {/* Price increase annotation */}
            {price_increase_timing_month > 0 && price_increase_timing_month <= months && (
              <ReferenceLine
                x={`M+${price_increase_timing_month}`}
                stroke="#22c55e"
                strokeDasharray="3 2"
                label={{ value: 'Price ↑', position: 'top', fontSize: 10, fill: '#22c55e' }}
              />
            )}

            {/* Without increase */}
            <Line
              type="monotone"
              dataKey="margin_no_increase"
              name="Without price increase"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
            />

            {/* With recommended increase */}
            <Line
              type="monotone"
              dataKey="margin_with_increase"
              name="With recommended increase"
              stroke="#22c55e"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Annotation */}
      <div className="flex items-start gap-4 text-[10px] text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef4444' }} />
          <span>No action taken</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-green-500" />
          <span>With recommended price increase at M+{price_increase_timing_month}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-red-900/30 rounded-sm" />
          <span>Below minimum margin</span>
        </div>
      </div>
    </div>
  );
}
