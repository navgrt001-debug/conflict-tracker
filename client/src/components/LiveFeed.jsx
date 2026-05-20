import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const SEV_COLOR = (s) =>
  s >= 8 ? 'bg-red-600 text-white' :
  s >= 6 ? 'bg-orange-500 text-white' :
  s >= 4 ? 'bg-yellow-500 text-black' :
           'bg-gray-600 text-white';

const SEV_RING = (s) =>
  s >= 8 ? 'border-red-700' :
  s >= 6 ? 'border-orange-700' :
  s >= 4 ? 'border-yellow-700' :
           'border-gray-700';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (isNaN(diff) || diff < 0) return 'just now';
  if (diff < 1) return 'just now';
  if (diff < 60) return `${Math.round(diff)}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

export default function LiveFeed({ onSelectEvent, selectedEventId }) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['feed-conflicts'],
    queryFn: () => fetch(`${API_BASE}/feed/conflicts`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    refetchInterval: 60_000,
    staleTime: 0,           // always re-fetch when interval fires
    refetchOnWindowFocus: true,
    select: (d) => ({
      events: Array.isArray(d) ? d : (d.events || []),  // handle both old [] and new {events,updatedAt}
      updatedAt: d?.updatedAt || null,
    }),
  });

  const events = data?.events || [];
  const updatedAt = data?.updatedAt || null;

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/feed/refresh`, { method: 'POST' });
      await qc.invalidateQueries({ queryKey: ['feed-conflicts'] });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Conflict Feed</h3>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {updatedAt ? `Updated ${timeAgo(updatedAt)}` : 'Auto-refresh every 5 min'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {(isFetching || refreshing) && (
              <span className="text-[10px] text-blue-400 animate-spin">↻</span>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || isFetching}
              title="Force refresh feed"
              className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-border hover:border-gray-500 transition-colors disabled:opacity-40"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && events.length === 0 && (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded animate-pulse" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="p-3 space-y-2">
            <div className="text-xs text-red-400">Feed unavailable — check server connection</div>
            <button
              onClick={handleManualRefresh}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Retry now
            </button>
          </div>
        )}

        {events.map(event => (
          <button
            key={event.id}
            onClick={() => onSelectEvent(event)}
            className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-surface transition-colors ${
              selectedEventId === event.id ? `bg-surface border-l-2 ${SEV_RING(event.severity)}` : ''
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${SEV_COLOR(event.severity)}`}>
                {event.severity}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 leading-snug line-clamp-2">{event.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-gray-600">{event.domain}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">{event.sourcecountry}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">{timeAgo(event.seendate)}</span>
                </div>
              </div>
            </div>
            {selectedEventId === event.id && (
              <div className="mt-1.5 text-[10px] text-blue-400 font-medium">→ View causal chain</div>
            )}
          </button>
        ))}

        {!isLoading && !error && events.length === 0 && (
          <div className="p-4 text-center space-y-2">
            <div className="text-xs text-gray-600">No conflict events loaded</div>
            <button onClick={handleManualRefresh} className="text-xs text-blue-400 hover:text-blue-300 underline">
              Fetch now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
