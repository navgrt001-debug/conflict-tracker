import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CompanySetup from './CompanySetup';
import CostImpactDashboard from './CostImpactDashboard';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const LS_KEY = 'scm_profile_ids'; // array of saved company IDs

function loadSavedIds() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSavedIds(ids) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
}

// ── Profile card on the list screen ──────────────────────────────────────────
function ProfileCard({ id, onSelect, onDelete }) {
  const { data: company, isLoading } = useQuery({
    queryKey: ['supply-company', id],
    queryFn: () => fetch(`${API}/supply-chain/companies/${id}`).then(r => {
      if (!r.ok) throw new Error('not found');
      return r.json();
    }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${company?.name || 'this profile'}"? This cannot be undone.`)) return;
    await fetch(`${API}/supply-chain/companies/${id}`, { method: 'DELETE' }).catch(() => {});
    onDelete(id);
  };

  if (isLoading) return (
    <div className="bg-surface border border-border rounded-xl p-5 animate-pulse h-40" />
  );

  // If company was deleted from server (server restart etc.) still show a recovery card
  const name = company?.name || 'Unknown Profile';
  const matCount = (company?.materials || []).length;
  const buyerCount = (company?.buyer_markets || []).length;
  const hasPnl = (company?.pnl?.annual_revenue || 0) > 0;
  const created = company?.created_at ? new Date(company.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div
      onClick={() => onSelect(id)}
      className="bg-surface border border-border hover:border-blue-500 rounded-xl p-5 cursor-pointer transition-all group hover:shadow-lg hover:shadow-blue-900/20 relative flex flex-col gap-3"
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-transparent hover:bg-red-900/40 text-gray-600 hover:text-red-400 text-xs flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
        title="Delete profile"
      >✕</button>

      {/* Name + industry */}
      <div>
        <div className="text-white font-bold text-sm pr-6">{name}</div>
        {company?.industry && (
          <div className="text-[10px] text-gray-500 mt-0.5">{company.industry}</div>
        )}
      </div>

      {/* Product + manufacturing */}
      {company?.final_product && (
        <div className="text-xs text-gray-400 leading-snug">
          <span className="text-gray-600">Product: </span>{company.final_product}
          {company.manufacturing_country_name && (
            <span className="text-gray-600"> · Mfg: {company.manufacturing_country_name}</span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 flex-wrap mt-auto">
        <div className={`text-[10px] px-2 py-0.5 rounded border ${
          matCount > 0 ? 'border-blue-800 text-blue-400 bg-blue-900/20' : 'border-border text-gray-600'
        }`}>
          {matCount} material{matCount !== 1 ? 's' : ''}
        </div>
        <div className={`text-[10px] px-2 py-0.5 rounded border ${
          buyerCount > 0 ? 'border-green-800 text-green-400 bg-green-900/20' : 'border-border text-gray-600'
        }`}>
          {buyerCount} buyer market{buyerCount !== 1 ? 's' : ''}
        </div>
        <div className={`text-[10px] px-2 py-0.5 rounded border ${
          hasPnl ? 'border-purple-800 text-purple-400 bg-purple-900/20' : 'border-border text-gray-600'
        }`}>
          {hasPnl ? '✓ P&L set' : 'No P&L'}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        {created && <span className="text-[9px] text-gray-600">Created {created}</span>}
        <span className="text-[10px] text-blue-400 ml-auto group-hover:underline">Open →</span>
      </div>
    </div>
  );
}

// ── Profiles list screen ──────────────────────────────────────────────────────
function ProfilesScreen({ savedIds, onSelect, onDelete, onNew }) {
  const FEATURE_CARDS = [
    { icon: '📈', title: 'P&L Forecast', desc: '4-quarter AI impact modelling' },
    { icon: '🎯', title: 'Sensitivity Grid', desc: 'CFO scenario analysis' },
    { icon: '🌍', title: 'Buyer Impact', desc: 'Purchasing power & inflation' },
    { icon: '⇄',  title: 'Alternative Sources', desc: 'Ranked safer suppliers' },
    { icon: '📄', title: 'Full Report', desc: 'Downloadable PDF analysis' },
    { icon: '⚠️', title: 'Risk Scoring', desc: 'Geopolitical conflict exposure' },
  ];

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full p-6 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-white font-bold text-xl">Supply Chain Intelligence</h2>
            <p className="text-gray-400 text-sm mt-1">
              {savedIds.length > 0
                ? `${savedIds.length} saved profile${savedIds.length !== 1 ? 's' : ''} — select one to view its analysis`
                : 'Model how conflicts, disruptions and inflation affect your P&L'}
            </p>
          </div>
          <button
            onClick={onNew}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            <span>+</span> New Profile
          </button>
        </div>

        {/* Saved profiles grid */}
        {savedIds.length > 0 ? (
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-3">Saved Profiles</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedIds.map(id => (
                <ProfileCard key={id} id={id} onSelect={onSelect} onDelete={onDelete} />
              ))}
              {/* Add new card */}
              <button
                onClick={onNew}
                className="border-2 border-dashed border-border hover:border-blue-500 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-blue-400 transition-colors min-h-[160px] group"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">+</span>
                <span className="text-xs font-medium">Add New Profile</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center text-center py-6">
            <div className="text-6xl mb-5">🏭</div>
            <h3 className="text-white font-bold text-lg mb-2">No profiles yet</h3>
            <p className="text-gray-400 text-sm mb-8 max-w-sm leading-relaxed">
              Set up your first supply chain profile to start modelling conflict exposure and P&L impact.
            </p>
            <button
              onClick={onNew}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
            >
              + Setup Your Supply Chain
            </button>
          </div>
        )}

        {/* Feature grid — always shown */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-3">What's Included</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {FEATURE_CARDS.map(f => (
              <div key={f.title} className="bg-surface border border-border rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{f.icon}</div>
                <div className="text-xs font-bold text-white mb-0.5">{f.title}</div>
                <div className="text-[10px] text-gray-500">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function SupplyChainView() {
  const [savedIds, setSavedIds] = useState(loadSavedIds);
  const [selectedId, setSelectedId] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const queryClient = useQueryClient();

  // Migrate legacy single-ID key
  useEffect(() => {
    const legacyId = localStorage.getItem('scm_company_id');
    if (legacyId && !savedIds.includes(legacyId)) {
      const updated = [legacyId, ...savedIds];
      setSavedIds(updated);
      saveSavedIds(updated);
      localStorage.removeItem('scm_company_id');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['supply-company', selectedId],
    queryFn: () => fetch(`${API}/supply-chain/companies/${selectedId}`).then(r => {
      if (!r.ok) throw new Error('Company not found');
      return r.json();
    }),
    enabled: !!selectedId,
    staleTime: 60_000,
    retry: 1,
  });

  const handleCreated = (newCompany) => {
    const updated = [newCompany.id, ...savedIds.filter(id => id !== newCompany.id)];
    setSavedIds(updated);
    saveSavedIds(updated);
    setSelectedId(newCompany.id);
    setSetupOpen(false);
    queryClient.invalidateQueries(['supply-company', newCompany.id]);
  };

  const handleDelete = async (id) => {
    const updated = savedIds.filter(sid => sid !== id);
    setSavedIds(updated);
    saveSavedIds(updated);
    if (selectedId === id) setSelectedId(null);
    queryClient.removeQueries(['supply-company', id]);
    queryClient.removeQueries(['supply-impact', id]);
    queryClient.removeQueries(['pl-analysis', id]);
  };

  const handleEdit = () => setSetupOpen(true);

  // ── Dashboard view ──────────────────────────────────────────────────────────
  if (selectedId) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        {setupOpen && (
          <CompanySetup onCreated={handleCreated} onClose={() => setSetupOpen(false)} />
        )}

        {/* Back bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors"
          >
            ← All Profiles
          </button>
          <div className="h-3 w-px bg-border" />
          <span className="text-xs text-gray-400">{company?.name || '…'}</span>

          <button
            onClick={async () => {
              if (!selectedId) return;
              if (!confirm(`Delete "${company?.name || 'this profile'}"? This cannot be undone.`)) return;
              await fetch(`${API}/supply-chain/companies/${selectedId}`, { method: 'DELETE' }).catch(() => {});
              handleDelete(selectedId);
            }}
            className="ml-auto text-[10px] text-gray-600 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            🗑 Delete Profile
          </button>
        </div>

        {companyLoading ? (
          <div className="flex items-center justify-center flex-1 w-full">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <CostImpactDashboard
            companyId={selectedId}
            company={company}
            onEdit={handleEdit}
          />
        )}
      </div>
    );
  }

  // ── Profiles list ───────────────────────────────────────────────────────────
  return (
    <>
      {setupOpen && (
        <CompanySetup onCreated={handleCreated} onClose={() => setSetupOpen(false)} />
      )}
      <ProfilesScreen
        savedIds={savedIds}
        onSelect={setSelectedId}
        onDelete={handleDelete}
        onNew={() => setSetupOpen(true)}
      />
    </>
  );
}
