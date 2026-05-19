import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchMarkets, fetchFX } from '../../services/api';

export default function MarketPanel({ conflict }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!conflict) return;
    setLoading(true);
    setError(null);

    const symbols = conflict.marketSymbols?.length
      ? conflict.marketSymbols
      : ['^GSPC', 'CL=F', 'GC=F'];

    fetchMarkets(symbols)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [conflict?.id]);

  if (!conflict) return <Empty />;
  if (loading) return <Loading />;
  if (error) return <Error msg={error} />;
  if (!data) return <Empty />;

  const conflictFxCodes = conflict.currencyCodes || [];
  const relevantFx = conflictFxCodes
    .filter(code => data.fx[code])
    .map(code => ({ code, rate: data.fx[code] }));

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Market Indicators</h3>
        <p className="text-xs text-gray-500">Conflict-relevant market signals · Real-time via Yahoo Finance</p>
      </div>

      {/* FX rates */}
      {relevantFx.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">FX vs USD</div>
          <div className="grid grid-cols-2 gap-2">
            {relevantFx.map(({ code, rate }) => (
              <div key={code} className="bg-surface rounded p-3">
                <div className="text-lg font-bold text-blue-400">{rate.toFixed(2)}</div>
                <div className="text-xs text-gray-400">USD/{code}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market quotes */}
      {data.quotes?.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quotes</div>
          <div className="space-y-2">
            {data.quotes.map(q => (
              <QuoteRow key={q.symbol} quote={q} />
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      {data.quotes?.filter(q => q.history?.length > 1).slice(0, 3).map(q => (
        <div key={q.symbol + '-chart'}>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{q.name} (5d)</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={q.history}>
              <XAxis dataKey="date" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Line type="monotone" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

function QuoteRow({ quote }) {
  const up = quote.change >= 0;
  return (
    <div className="bg-surface rounded p-3 flex items-center justify-between">
      <div>
        <div className="text-sm text-white font-medium">{quote.name}</div>
        <div className="text-xs text-gray-500">{quote.symbol} · {quote.currency}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-white">{quote.price?.toFixed(2)}</div>
        <div className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{quote.change?.toFixed(2)} ({quote.changePct?.toFixed(2)}%)
        </div>
      </div>
    </div>
  );
}

const Loading = () => (
  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
    <div className="text-center">
      <div className="animate-spin text-3xl mb-2">⟳</div>
      <div>Loading market data...</div>
    </div>
  </div>
);

const Error = ({ msg }) => (
  <div className="p-4 text-red-400 text-sm">
    <div className="font-bold mb-1">Market data error</div>
    <div className="text-xs text-red-500">{msg}</div>
    <div className="text-xs text-gray-500 mt-2">Yahoo Finance may be rate-limiting. Try again shortly.</div>
  </div>
);

const Empty = () => (
  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
    Select a conflict to view markets
  </div>
);
