import { useEffect, useState } from 'react';
import { fetchConflicts } from './services/api';
import Header from './components/Header';
import ConflictMap from './components/ConflictMap';
import ConflictSidebar from './components/ConflictSidebar';
import ConflictDetail from './components/panels/ConflictDetail';
import MarketPanel from './components/panels/MarketPanel';
import TradePanel from './components/panels/TradePanel';
import PredictionPanel from './components/panels/PredictionPanel';
import ChatPanel from './components/panels/ChatPanel';
import Dashboard from './components/Dashboard';
import PredictionDashboard from './components/PredictionDashboard';
import ScenarioEngine from './components/ScenarioEngine';
import ScenarioComparison from './components/ScenarioComparison';
import PortfolioSetup from './components/PortfolioSetup';
import PortfolioRiskPanel from './components/PortfolioRiskPanel';
import SupplyChainView from './components/SupplyChain/SupplyChainView';
import useSession from './hooks/useSession';

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'markets', label: 'Markets' },
  { id: 'trade', label: 'Trade' },
  { id: 'predict', label: 'AI Report' },
  { id: 'portfolio', label: '💼 Risk' },
  { id: 'chat', label: '💬 Chat' },
];

export default function App() {
  const [conflicts, setConflicts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'detail' | 'predictions' | 'scenarios'
  const [savedScenarios, setSavedScenarios] = useState([]); // up to 2 for comparison
  const [scenariosTab, setScenariosTab] = useState('analyze'); // 'analyze' | 'compare'
  const [loading, setLoading] = useState(true);
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  const { sessionId, portfolio, conversationCount, hasPortfolio, savePortfolio, isSaving } = useSession();

  useEffect(() => {
    fetchConflicts()
      .then(data => { setConflicts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = (conflict) => {
    setSelected(conflict);
    if (activeTab !== 'chat') setActiveTab('overview');
    setView('detail');
  };

  const panelWidth = activeTab === 'chat' ? 'w-[520px]' : activeTab === 'portfolio' ? 'w-[420px]' : 'w-96';

  const handleSaveForComparison = (entry) => {
    setSavedScenarios(prev => {
      if (prev.some(s => s.id === entry.id)) return prev; // already saved
      const next = [...prev, entry].slice(-2); // keep max 2
      return next;
    });
  };

  const handleRemoveFromComparison = (index) => {
    setSavedScenarios(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-surface text-gray-200 overflow-hidden">
      {/* Header with view toggle */}
      <header className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
          <h1 className="text-white font-bold text-base tracking-wide">
            GLOBAL CONFLICT & MARKET INTELLIGENCE
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          {conflicts.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <Stat label="Active" value={conflicts.filter(c => c.status === 'Active').length} color="text-red-400" />
              <Stat label="Tense" value={conflicts.filter(c => c.status === 'Tense').length} color="text-amber-400" />
              <Stat label="Critical" value={conflicts.filter(c => c.scores?.label === 'Critical').length} color="text-red-400" />
            </div>
          )}

          {/* View toggle */}
          <div className="flex bg-surface border border-border rounded-lg overflow-hidden text-xs font-medium">
            {[
              { id: 'dashboard',    label: '📊 Dashboard' },
              { id: 'detail',       label: '🗺️ Detail' },
              { id: 'predictions',  label: '🎯 Predictions' },
              { id: 'scenarios',    label: '🔮 Scenarios' },
              { id: 'supply-chain', label: '🏭 Supply Chain' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 transition-colors ${view === v.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Portfolio button */}
          <button
            onClick={() => setPortfolioOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              hasPortfolio
                ? 'bg-blue-950/40 border-blue-700 text-blue-300 hover:border-blue-500'
                : 'border-border text-gray-500 hover:text-gray-300 hover:border-gray-500'
            }`}
          >
            💼 {hasPortfolio ? `Portfolio (${portfolio.assets.length})` : 'Setup Portfolio'}
          </button>

          <div className="text-gray-600 font-mono text-[10px]">
            {new Date().toUTCString().slice(0, 22)} UTC
          </div>
        </div>
      </header>

      {/* Portfolio setup modal */}
      {portfolioOpen && (
        <PortfolioSetup
          initialPortfolio={portfolio}
          onSave={(p) => { savePortfolio(p); setPortfolioOpen(false); }}
          onClose={() => setPortfolioOpen(false)}
          isSaving={isSaving}
        />
      )}

      {/* Views */}
      <div className="flex-1 overflow-hidden">
        {/* Dashboard view */}
        {view === 'dashboard' && (
          loading
            ? <LoadingState />
            : <Dashboard conflicts={conflicts} />
        )}

        {/* Predictions view */}
        {view === 'predictions' && (
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 max-w-3xl mx-auto border-x border-border overflow-hidden">
              <PredictionDashboard />
            </div>
          </div>
        )}

        {/* Scenarios view */}
        {view === 'scenarios' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
              {[
                { id: 'analyze', label: '🔮 Analyze' },
                {
                  id: 'compare',
                  label: `⚖ Compare${savedScenarios.length > 0 ? ` (${savedScenarios.length}/2)` : ''}`,
                },
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
                <ScenarioEngine
                  savedScenarios={savedScenarios}
                  onSaveForComparison={handleSaveForComparison}
                />
              )}
              {scenariosTab === 'compare' && (
                <div className="h-full overflow-y-auto p-6">
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

        {/* Supply Chain view */}
        {view === 'supply-chain' && (
          <div className="flex h-full overflow-hidden">
            <SupplyChainView />
          </div>
        )}

        {/* Conflict detail view */}
        {view === 'detail' && (
          <div className="flex h-full overflow-hidden">
            {activeTab !== 'chat' && (
              <ConflictSidebar conflicts={conflicts} selected={selected} onSelect={handleSelect} />
            )}

            <div className="flex flex-1 overflow-hidden">
              {/* Map */}
              <div className="flex-1 relative">
                {loading ? <LoadingState /> : (
                  <ConflictMap conflicts={conflicts} selected={selected} onSelect={handleSelect} />
                )}
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-card bg-opacity-90 border border-border rounded p-2 text-xs space-y-1 z-[1000]">
                  <div className="text-gray-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Intensity</div>
                  {[
                    { color: 'bg-red-600', label: '9-10 Critical' },
                    { color: 'bg-orange-500', label: '7-8 High' },
                    { color: 'bg-yellow-500', label: '5-6 Elevated' },
                    { color: 'bg-lime-500', label: '1-4 Moderate' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-gray-400 text-[10px]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel */}
              <div className={`${panelWidth} bg-card border-l border-border flex flex-col shrink-0 transition-all duration-200`}>
                <div className="flex border-b border-border shrink-0">
                  {DETAIL_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/30'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'overview' && <ConflictDetail conflict={selected} />}
                  {activeTab === 'markets' && <MarketPanel conflict={selected} />}
                  {activeTab === 'trade' && <TradePanel conflict={selected} />}
                  {activeTab === 'predict' && <PredictionPanel conflict={selected} marketData={null} tradeData={null} />}
                  {activeTab === 'portfolio' && (
                    <div className="p-4 overflow-y-auto h-full">
                      <PortfolioRiskPanel
                        sessionId={sessionId}
                        hasPortfolio={hasPortfolio}
                        onSetupPortfolio={() => setPortfolioOpen(true)}
                      />
                    </div>
                  )}
                  {activeTab === 'chat' && (
                    <ChatPanel
                      sessionId={sessionId}
                      portfolio={portfolio}
                      conversationCount={conversationCount}
                      onSetupPortfolio={() => setPortfolioOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
