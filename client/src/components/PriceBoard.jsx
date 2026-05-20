import { useQuery } from '@tanstack/react-query';
import { SparklineChart } from './SparklineChart';

const FX_NAMES = {
  TRY: 'Turkish Lira', ZAR: 'S. African Rand', BRL: 'Brazilian Real',
  NGN: 'Nigerian Naira', EGP: 'Egyptian Pound', EUR: 'Euro',
  GBP: 'Brit. Pound', JPY: 'Japanese Yen',
};

function PriceCard({ item }) {
  const up = item.changePct >= 0;
  // For FX (USD/XXX), higher rate = weaker local currency (red). For commodities, higher = green.
  const isFX = item.type === 'fx';
  const bullish = isFX ? !up : up;

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="text-xs font-bold text-white truncate">
            {isFX ? (FX_NAMES[item.symbol] || item.symbol) : item.name}
          </div>
          <div className="text-[10px] text-gray-600">{item.symbol}</div>
        </div>
        <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${bullish ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
          {isFX ? (up ? '↑' : '↓') : (up ? '↑' : '↓')} {Math.abs(item.changePct).toFixed(2)}%
        </span>
      </div>

      <div className={`text-lg font-bold font-mono ${bullish ? 'text-green-400' : 'text-red-400'}`}>
        {isFX ? item.price?.toFixed(3) : item.price?.toFixed(2)}
      </div>

      {item.sparkline?.length > 1 && (
        <SparklineChart data={item.sparkline} up={bullish} />
      )}
    </div>
  );
}

export default function PriceBoard() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed-prices'],
    queryFn: () => fetch('/api/feed/prices').then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const lastUpdated = data?.updatedAt
    ? Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 60000)
    : null;

  const all = [...(data?.commodities || []), ...(data?.fx || [])];

  return (
    <div className="bg-surface border-b border-border shrink-0">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
            Live Prices — Commodities & FX vs USD
          </span>
        </div>
        {lastUpdated !== null && (
          <span className="text-[10px] text-gray-600">
            updated {lastUpdated === 0 ? 'just now' : `${lastUpdated}m ago`}
          </span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-thin">
        {isLoading && all.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="min-w-[140px] h-24 bg-card border border-border rounded-lg animate-pulse shrink-0" />
            ))
          : all.map(item => (
              <div key={item.symbol} className="shrink-0">
                <PriceCard item={item} />
              </div>
            ))
        }
      </div>
    </div>
  );
}
