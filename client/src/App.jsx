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
import SupplyChainView from './components/SupplyChain/SupplyChainView';
import LoginPage from './components/Auth/LoginPage';
import { useAuth } from './context/AuthContext';
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
{ id: 'supply-chain', icon: '🏭', label: 'Supply Chain' },
];

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();

  // Show a full-screen spinner while we verify the stored token
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm tracking-wide">Authenticating…</div>
        </div>
      </div>
    );
  }

  // Show login / register page if not authenticated
  if (!user) return <LoginPage />;

  return <AuthenticatedApp user={user} logout={logout} />;
}

function AuthenticatedApp({ user, logout }) {
  const [conflicts, setConflicts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [view, setView] = useState('dashboard');
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


  return (
    <div className="flex flex-col h-screen bg-surface text-gray-200 overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-between shrink-0">
        <button onClick={() => setView('dashboard')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse shrink-0" />
          <div className="flex flex-col leading-tight text-left">
            <span className="text-white font-bold text-sm md:text-lg tracking-widest">Zer0</span>
            <span className="text-gray-500 text-[9px] md:text-[10px] tracking-widest uppercase hidden sm:block">Global Conflict &amp; Market Intelligence</span>
          </div>
        </button>

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

          {/* User badge + logout */}
          <div className="flex items-center gap-2">
            {/* Avatar + name */}
            <div className="hidden sm:flex items-center gap-1.5 bg-surface border border-border rounded-full pl-1.5 pr-2.5 py-0.5">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-gray-400 text-[10px] max-w-[120px] truncate">{user.name || user.email}</span>
            </div>
            {/* Sign out button */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-gray-400 hover:text-red-400 hover:border-red-800 hover:bg-red-950/30 transition-all text-[11px] font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>


      {/* Views */}
      <div className="flex-1 overflow-hidden">
        {view === 'dashboard' && (
          loading ? <LoadingState /> : <Dashboard conflicts={conflicts} />
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
