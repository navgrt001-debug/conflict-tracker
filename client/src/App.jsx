import { useEffect, useState } from 'react';
import { fetchConflicts } from './services/api';
import Header from './components/Header';
import ConflictMap from './components/ConflictMap';
import ConflictSidebar from './components/ConflictSidebar';
import ConflictDetail from './components/panels/ConflictDetail';
import MarketPanel from './components/panels/MarketPanel';
import TradePanel from './components/panels/TradePanel';
import PredictionPanel from './components/panels/PredictionPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'markets', label: 'Markets & FX' },
  { id: 'trade', label: 'Trade & Economy' },
  { id: 'predict', label: 'AI Analysis' },
];

export default function App() {
  const [conflicts, setConflicts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConflicts()
      .then(data => { setConflicts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = (conflict) => {
    setSelected(conflict);
    setActiveTab('overview');
  };

  return (
    <div className="flex flex-col h-screen bg-surface text-gray-200 overflow-hidden">
      <Header conflicts={conflicts} selectedConflict={selected} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ConflictSidebar
          conflicts={conflicts}
          selected={selected}
          onSelect={handleSelect}
        />

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Map */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-3xl animate-pulse mb-2">🌍</div>
                  <div>Loading conflict data...</div>
                </div>
              </div>
            ) : (
              <ConflictMap
                conflicts={conflicts}
                selected={selected}
                onSelect={handleSelect}
              />
            )}

            {/* Map legend */}
            <div className="absolute bottom-4 left-4 bg-card bg-opacity-90 border border-border rounded p-2 text-xs space-y-1 z-[1000]">
              <div className="text-gray-500 font-bold mb-1 uppercase tracking-wider">Intensity</div>
              {[
                { color: 'bg-red-600', label: '9-10 Critical' },
                { color: 'bg-orange-500', label: '7-8 High' },
                { color: 'bg-yellow-500', label: '5-6 Elevated' },
                { color: 'bg-lime-500', label: '1-4 Moderate' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          {selected && (
            <div className="w-96 bg-card border-l border-border flex flex-col shrink-0">
              {/* Tabs */}
              <div className="flex border-b border-border shrink-0">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/30'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'overview' && <ConflictDetail conflict={selected} />}
                {activeTab === 'markets' && <MarketPanel conflict={selected} />}
                {activeTab === 'trade' && <TradePanel conflict={selected} />}
                {activeTab === 'predict' && (
                  <PredictionPanel
                    conflict={selected}
                    marketData={null}
                    tradeData={null}
                  />
                )}
              </div>
            </div>
          )}

          {/* Empty state when no conflict selected */}
          {!selected && (
            <div className="w-96 bg-card border-l border-border flex items-center justify-center shrink-0">
              <div className="text-center text-gray-600 p-6">
                <div className="text-5xl mb-4">🗺️</div>
                <div className="font-bold text-gray-400 mb-2">Select a Conflict</div>
                <div className="text-sm">Click any marker on the map or a conflict in the sidebar to view intelligence data</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
