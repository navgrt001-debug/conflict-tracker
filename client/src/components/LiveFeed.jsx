import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

function timeAgo(seendate) {
  if (!seendate) return '';
  // GDELT format: "20240315T123000Z"
  const str = String(seendate);
  const iso = `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T${str.slice(9,11)}:${str.slice(11,13)}:${str.slice(13,15)}Z`;
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (isNaN(diff)) return '';
  if (diff < 60) return `${Math.round(diff)}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

export default function LiveFeed({ onSelectEvent, selectedEventId }) {
  const { data: events = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['feed-conflicts'],
    queryFn: () => fetch('/api/feed/conflicts').then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const lastUpdated = dataUpdatedAt
    ? Math.round((Date.now() - dataUpdatedAt) / 60000)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Conflict Feed</h3>
          <p className="text-[10px] text-gray-600 mt-0.5">GDELT · auto-refresh 60s</p>
        </div>
        <div className="text-right">
          {lastUpdated !== null && (
            <span className="text-[10px] text-gray-600">
              {lastUpdated === 0 ? 'just now' : `${lastUpdated}m ago`}
            </span>
          )}
          {isLoading && <span className="text-[10px] text-blue-500 ml-1">↻</span>}
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

        {error && (
          <div className="p-3 text-xs text-red-400">
            Failed to load feed. Retrying...
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
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600">{event.domain}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">{event.sourcecountry}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">{timeAgo(event.seendate)}</span>
                </div>
              </div>
            </div>
            {selectedEventId === event.id && (
              <div className="mt-1.5 text-[10px] text-blue-400 font-medium">
                → View causal chain
              </div>
            )}
          </button>
        ))}

        {!isLoading && events.length === 0 && (
          <div className="p-4 text-xs text-gray-600 text-center">No events loaded yet</div>
        )}
      </div>
    </div>
  );
}
