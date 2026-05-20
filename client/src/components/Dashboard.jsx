import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import LiveFeed from './LiveFeed';
import CausalChain from './CausalChain';
import PriceBoard from './PriceBoard';
import WorldMap from './WorldMap';

export default function Dashboard({ conflicts }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState(null);

  const { data: gdeltEvents = [] } = useQuery({
    queryKey: ['feed-conflicts'],
    queryFn: () => fetch('/api/feed/conflicts').then(r => r.json()),
    staleTime: 30_000,
  });

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setSelectedConflict(null);
  };

  const handleSelectConflict = (conflict) => {
    setSelectedConflict(conflict);
    setSelectedEvent(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Price ticker strip */}
      <PriceBoard />

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Live feed */}
        <div className="w-72 border-r border-border flex flex-col shrink-0 overflow-hidden">
          <LiveFeed
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEvent?.id}
          />
        </div>

        {/* Center — World map */}
        <div className="flex-1 relative overflow-hidden">
          <WorldMap
            conflicts={conflicts}
            gdeltEvents={gdeltEvents}
            onSelectConflict={handleSelectConflict}
            selectedConflict={selectedConflict}
          />

          {/* Conflict tooltip card if static conflict selected */}
          {selectedConflict && (
            <div className="absolute top-3 right-3 w-64 bg-card border border-border rounded-lg p-3 z-20 shadow-xl">
              <div className="flex items-start justify-between mb-1">
                <div className="font-bold text-sm text-white">{selectedConflict.name}</div>
                <button onClick={() => setSelectedConflict(null)} className="text-gray-600 hover:text-gray-400 text-xs ml-2">✕</button>
              </div>
              <div className="text-xs text-gray-400 mb-2">{selectedConflict.type}</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="bg-surface rounded p-1.5">
                  <div className="text-gray-500 text-[10px]">Severity</div>
                  <div className="text-white font-bold">{selectedConflict.intensity}/10</div>
                </div>
                <div className="bg-surface rounded p-1.5">
                  <div className="text-gray-500 text-[10px]">Risk Score</div>
                  <div className="text-red-400 font-bold">{selectedConflict.scores?.combined}/100</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedConflict.tags?.slice(0, 3).map(t => (
                  <span key={t} className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Causal chain */}
        <div className="w-80 border-l border-border flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border shrink-0">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Causal Chain</h3>
            <p className="text-[10px] text-gray-600 mt-0.5">AI-generated market impact analysis</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <CausalChain event={selectedEvent} />
          </div>
        </div>
      </div>
    </div>
  );
}
