import { useState } from 'react';

const INTENSITY_COLORS = {
  9: 'bg-red-600',
  8: 'bg-red-500',
  7: 'bg-orange-500',
  6: 'bg-amber-500',
  5: 'bg-yellow-500',
  4: 'bg-yellow-400',
};

const STATUS_BADGE = {
  Active: 'bg-red-900 text-red-300 border-red-700',
  Tense: 'bg-amber-900 text-amber-300 border-amber-700',
};

export default function ConflictSidebar({ conflicts, selected, onSelect }) {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');

  const regions = ['All', ...new Set(conflicts.map(c => c.region))].sort();

  const filtered = conflicts
    .filter(c =>
      (regionFilter === 'All' || c.region === regionFilter) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => b.intensity - a.intensity);

  return (
    <div className="w-72 bg-card border-r border-border flex flex-col shrink-0">
      <div className="p-3 border-b border-border space-y-2">
        <input
          type="text"
          placeholder="Search conflicts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
        />
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-accent-blue"
        >
          {regions.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      <div className="overflow-y-auto flex-1">
        {filtered.map(conflict => (
          <button
            key={conflict.id}
            onClick={() => onSelect(conflict)}
            className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-surface transition-colors ${
              selected?.id === conflict.id ? 'bg-blue-950 border-l-2 border-l-accent-blue' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">{conflict.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{conflict.region}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_BADGE[conflict.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  {conflict.status}
                </span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${INTENSITY_COLORS[conflict.intensity] || 'bg-gray-500'}`} />
                  <span className="text-xs text-gray-400">{conflict.intensity}/10</span>
                </div>
              </div>
            </div>
            {conflict.scores && (
              <div className="mt-1.5 flex gap-1">
                <MiniBar label="SEV" value={conflict.scores.severity} color="bg-red-500" />
                <MiniBar label="ECO" value={conflict.scores.economic} color="bg-blue-500" />
                <MiniBar label="ESC" value={conflict.scores.escalation} color="bg-purple-500" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="p-2 border-t border-border text-xs text-gray-600 text-center">
        {filtered.length} of {conflicts.length} conflicts
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }) {
  return (
    <div className="flex-1">
      <div className="text-[10px] text-gray-600 mb-0.5">{label}</div>
      <div className="h-1 bg-gray-800 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
