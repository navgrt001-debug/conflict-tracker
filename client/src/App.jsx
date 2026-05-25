import { useEffect, useState } from 'react';
import { fetchConflicts } from './services/api';
import ConflictMap from './components/ConflictMap';
import ConflictSidebar from './components/ConflictSidebar';
import ConflictDetail from './components/panels/ConflictDetail';
import MarketPanel from './components/panels/MarketPanel';
import TradePanel from './components/panels/TradePanel';
import PredictionPanel from './components/panels/PredictionPanel';
import FloatingChat from './components/FloatingChat';
import Dashboard from './components/Dashboard';
import ScenarioEngine from './components/ScenarioEngine';
import ScenarioComparison from './components/ScenarioComparison';
import SupplyChainView from './components/SupplyChain/SupplyChainView';
import useSession from './hooks/useSession';

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'markets', label: 'Markets' },
  { id: 'trade', label: 'Trade' },
  { id: 'predict', label: 'AI Report' },
];

const MAIN_VIEWS = [
  { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
  { id: 'detail',       icon: '🗺️', label: 'Detail' },
{ id: 'scenarios',    icon: '🔮', label: 'Scenarios' },
  { id: 'supply-chain', icon: '🏭', label: 'Supply Chain' },
];

export default function App() {
  const [conflicts, setConflicts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [view, setView] = useState('dashboard');
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [scenariosTab, setScenariosTab] = useState('analyze');
  const [loading, setLoading] = useState(true);

  // mobile detail sub-view: 'list' | 'map' | 'panel'
  const [mobileDetailView, setMobileDetailView] = useState('list');

  const { sessionId } = useSession();

  useEffect(() => {
    fetchConflicts()
      .then(data => { setConflicts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = (conflict) => {
    setSelected(conflict);
    if (activeTab !== 'chat') setActiveTab('overview');
    setView('detail');
    setMobileDetailView('panel');
  };

  const panelWidth = activeTab === 'chat' ? 'md:w-[520px]' : 'md:w-96';

  const handleSaveForComparison = (entry) => {
    setSavedScenarios(prev => {
      if (prev.some(s => s.id === entry.id)) return prev;
      return [...prev, entry].slice(-2);
    });
  };

  const handleRemoveFromComparison = (index) => {
    setSavedScenarios(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-surface text-gray-200 overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse shrink-0" />
          <h1 className="text-white font-bold text-xs md:text-base tracking-wide">
            <span className="hidden sm:inline">GLOBAL CONFLICT & MARKET INTELLIGENCE</span>
            <span className="sm:hidden">GCMI</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Stats — hidden on smallest screens */}
          {conflicts.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 md:gap-4 text-sm">
              <Stat label="Active" value={conflicts.filter(c => c.status === 'Active').length} color="text-red-400" />
              <Stat label="Tense" value={conflicts.filter(c => c.status === 'Tense').length} color="text-amber-400" />
              <Stat label="Critical" value={conflicts.filter(c => c.scores?.label === 'Critical').length} color="text-red-400" />
            </div>
          )}

          {/* Desktop view toggle */}
          <div className="hidden md:flex bg-surface border border-border rounded-lg overflow-hidden text-xs font-medium">
            {MAIN_VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 transition-colors ${view === v.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>


          <div className="hidden lg:block text-gray-600 font-mono text-[10px]">
            {new Date().toUTCString().slice(0, 22)} UTC
          </div>
        </div>
      </header>


      {/* Views */}
      <div className="flex-1 overflow-hidden">
        {view === 'dashboard' && (
          loading ? <LoadingState /> : <Dashboard conflicts={conflicts} />
        )}

        {view === 'scenarios' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
              {[
                { id: 'analyze', label: '🔮 Analyze' },
                { id: 'compare', label: `⚖ Compare${savedScenarios.length > 0 ? ` (${savedScenarios.length}/2)` : ''}` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setScenariosTab(t.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    scenariosTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {scenariosTab === 'analyze' && (
                <ScenarioEngine savedScenarios={savedScenarios} onSaveForComparison={handleSaveForComparison} />
              )}
              {scenariosTab === 'compare' && (
                <div className="h-full overflow-y-auto p-4 md:p-6">
                  <div className="max-w-4xl mx-auto">
                    <ScenarioComparison
                      scenarios={[savedScenarios[0] || null, savedScenarios[1] || null]}
                      onRemove={handleRemoveFromComparison}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'supply-chain' && (
          <div className="flex h-full overflow-hidden">
            <SupplyChainView />
          </div>
        )}

        {view === 'detail' && (
          <>
            {/* ── Desktop: sidebar + map + panel ── */}
            <div className="hidden md:flex h-full overflow-hidden">
              {activeTab !== 'chat' && (
                <ConflictSidebar conflicts={conflicts} selected={selected} onSelect={handleSelect} />
              )}
              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 relative">
                  {loading ? <LoadingState /> : (
                    <ConflictMap conflicts={conflicts} selected={selected} onSelect={handleSelect} />
                  )}
                  <MapLegend />
                </div>
                <div className={`${panelWidth} w-96 bg-card border-l border-border flex flex-col shrink-0 transition-all duration-200`}>
                  <DetailTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
                  <DetailPanel
                    activeTab={activeTab}
                    selected={selected}
                  />
                </div>
              </div>
            </div>

            {/* ── Mobile: tabbed single-panel ── */}
            <div className="flex md:hidden flex-col h-full overflow-hidden">
              {/* Mobile sub-nav */}
              <div className="flex border-b border-border bg-card shrink-0">
                {[
                  { id: 'list', label: '☰ List' },
                  { id: 'map',  label: '🗺 Map' },
                  { id: 'panel', label: '📋 Detail' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMobileDetailView(t.id)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      mobileDetailView === t.id
                        ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                        : 'text-gray-500'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {mobileDetailView === 'list' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <ConflictSidebar conflicts={conflicts} selected={selected} onSelect={handleSelect} mobile />
                </div>
              )}

              {mobileDetailView === 'map' && (
                <div className="flex-1 relative overflow-hidden">
                  {loading ? <LoadingState /> : (
                    <ConflictMap conflicts={conflicts} selected={selected} onSelect={handleSelect} />
                  )}
                  <MapLegend />
                </div>
              )}

              {mobileDetailView === 'panel' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-card">
                  <DetailTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
                  <DetailPanel
                    activeTab={activeTab}
                    selected={selected}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating humanoid chat assistant */}
      <FloatingChat sessionId={sessionId} />

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden flex border-t border-border bg-card shrink-0">
        {MAIN_VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              view === v.id ? 'text-blue-400' : 'text-gray-600'
            }`}
          >
            <span className="text-base leading-none">{v.icon}</span>
            <span>{v.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function DetailTabBar({ activeTab, setActiveTab }) {
  return (
    <div className="flex border-b border-border shrink-0 overflow-x-auto">
      {DETAIL_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 min-w-[52px] py-2 text-[10px] font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/30'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DetailPanel({ activeTab, selected }) {
  return (
    <div className="flex-1 overflow-hidden">
      {activeTab === 'overview' && <ConflictDetail conflict={selected} />}
      {activeTab === 'markets'  && <MarketPanel conflict={selected} />}
      {activeTab === 'trade'    && <TradePanel conflict={selected} />}
      {activeTab === 'predict'  && <PredictionPanel conflict={selected} marketData={null} tradeData={null} />}
    </div>
  );
}

function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-card bg-opacity-90 border border-border rounded p-2 text-xs space-y-1 z-[1000]">
      <div className="text-gray-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Intensity</div>
      {[
        { color: 'bg-red-600',    label: '9-10 Critical' },
        { color: 'bg-orange-500', label: '7-8 High' },
        { color: 'bg-yellow-500', label: '5-6 Elevated' },
        { color: 'bg-lime-500',   label: '1-4 Moderate' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
          <span className="text-gray-400 text-[10px]">{label}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <div className={`font-bold text-sm ${color}`}>{value}</div>
      <div className="text-gray-600 text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      <div className="text-center">
        <div className="text-3xl animate-pulse mb-2">🌍</div>
        <div className="text-sm">Loading...</div>
      </div>
    </div>
  );
}
