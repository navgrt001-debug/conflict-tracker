import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { fetchTrade } from '../../services/api';

const FMT_B = (v) => v ? `$${(v / 1e9).toFixed(1)}B` : 'N/A';
const FMT_PCT = (v) => v ? `${v.toFixed(1)}%` : 'N/A';

export default function TradePanel({ conflict }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!conflict?.tradeCountryCode) return;
    setLoading(true);
    setError(null);
    fetchTrade(conflict.tradeCountryCode)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [conflict?.id]);

  if (!conflict) return <Empty />;
  if (loading) return <Loading />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <Empty />;

  const gdpChart = data.gdp?.slice().reverse().map(d => ({ year: d.year, GDP: +(d.value / 1e9).toFixed(1) })) || [];
  const tradeChart = (data.exports?.length ? data.exports.slice().reverse() : []).map((d, i) => ({
    year: d.year,
    Exports: +(d.value / 1e9).toFixed(1),
    Imports: +(data.imports?.[data.imports.length - 1 - i]?.value / 1e9 || 0).toFixed(1),
  }));

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Economic & Trade Data</h3>
        <p className="text-xs text-gray-500">{conflict.name} · {conflict.tradeCountryCode} · World Bank</p>
      </div>

      {/* Key indicators */}
      <div className="grid grid-cols-2 gap-2">
        <Indicator label="GDP (latest)" value={FMT_B(data.gdp?.[0]?.value)} sub={data.gdp?.[0]?.year} />
        <Indicator label="GDP Growth" value={FMT_PCT(data.gdpGrowth?.[0]?.value)} sub={data.gdpGrowth?.[0]?.year} />
        <Indicator label="Exports" value={FMT_B(data.exports?.[0]?.value)} sub={data.exports?.[0]?.year} />
        <Indicator label="Imports" value={FMT_B(data.imports?.[0]?.value)} sub={data.imports?.[0]?.year} />
        <Indicator label="Inflation" value={FMT_PCT(data.inflation?.[0]?.value)} sub={data.inflation?.[0]?.year} warn={data.inflation?.[0]?.value > 20} />
        <Indicator label="FDI Inflows" value={FMT_B(data.fdi?.[0]?.value)} sub={data.fdi?.[0]?.year} />
      </div>

      {/* Commodities at risk */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Critical Commodities at Risk</div>
        <div className="flex flex-wrap gap-1.5">
          {conflict.commodities.map(c => (
            <span key={c} className="bg-amber-950 border border-amber-800 text-amber-300 text-xs px-2 py-1 rounded">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* GDP chart */}
      {gdpChart.length > 1 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">GDP Trend ($B)</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={gdpChart}>
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => [`$${v}B`, 'GDP']}
              />
              <Line type="monotone" dataKey="GDP" stroke="#10b981" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade chart */}
      {tradeChart.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Trade Flows ($B)</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={tradeChart}>
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => [`$${v}B`]}
              />
              <Bar dataKey="Exports" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Imports" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1 justify-center text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Exports</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" />Imports</span>
          </div>
        </div>
      )}

      {gdpChart.length === 0 && tradeChart.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">No trade data available for this country</div>
      )}
    </div>
  );
}

function Indicator({ label, value, sub, warn }) {
  return (
    <div className="bg-surface rounded p-3">
      <div className={`text-base font-bold ${warn ? 'text-red-400' : 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

const Loading = () => (
  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
    <div className="text-center">
      <div className="animate-spin text-3xl mb-2">⟳</div>
      <div>Loading trade data...</div>
    </div>
  </div>
);

const ErrorMsg = ({ msg }) => (
  <div className="p-4 text-red-400 text-sm">
    <div className="font-bold mb-1">Trade data error</div>
    <div className="text-xs text-red-500">{msg}</div>
  </div>
);

const Empty = () => (
  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
    Select a conflict to view trade data
  </div>
);
