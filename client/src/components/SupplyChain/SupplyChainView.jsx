import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import CompanySetup from './CompanySetup';
import CostImpactDashboard from './CostImpactDashboard';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const LS_KEY = 'scm_company_id';

async function loadCompany(id) {
  const res = await fetch(`${API}/supply-chain/companies/${id}`);
  if (!res.ok) throw new Error('Company not found');
  return res.json();
}

export default function SupplyChainView() {
  const [companyId, setCompanyId] = useState(() => localStorage.getItem(LS_KEY) || null);
  const [setupOpen, setSetupOpen] = useState(false);

  const { data: company, isLoading, isError } = useQuery({
    queryKey: ['supply-company', companyId],
    queryFn: () => loadCompany(companyId),
    enabled: !!companyId,
    staleTime: 60_000,
    retry: 1,
  });

  // If company not found in DB (e.g. server restarted, new DB), clear stale ID
  useEffect(() => {
    if (isError && companyId) {
      localStorage.removeItem(LS_KEY);
      setCompanyId(null);
    }
  }, [isError, companyId]);

  const handleCreated = (newCompany) => {
    localStorage.setItem(LS_KEY, newCompany.id);
    setCompanyId(newCompany.id);
    setSetupOpen(false);
  };

  const handleReset = async () => {
    if (!companyId) return;
    if (!confirm('Delete this company profile? This cannot be undone.')) return;
    await fetch(`${API}/supply-chain/companies/${companyId}`, { method: 'DELETE' }).catch(() => {});
    localStorage.removeItem(LS_KEY);
    setCompanyId(null);
  };

  // No company configured
  if (!companyId || (!company && !isLoading)) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center p-8">
        {setupOpen && (
          <CompanySetup onCreated={handleCreated} onClose={() => setSetupOpen(false)} />
        )}
        <div className="text-center max-w-lg mx-auto w-full flex flex-col items-center">
          <div className="text-5xl mb-4">🏭</div>
          <h2 className="text-white font-bold text-xl mb-2">Supply Chain Intelligence</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Model how global conflicts, commodity disruptions and inflation affect your P&L — with AI-driven quarterly forecasts and CFO-ready sensitivity analysis.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 w-full">
            {[
              { icon: '📈', title: 'P&L Forecast', desc: '4-quarter AI impact modelling on your financials' },
              { icon: '🎯', title: 'Sensitivity Grid', desc: 'CFO-ready scenario table across cost changes' },
              { icon: '🌍', title: 'Buyer Impact', desc: 'Purchasing power & inflation in your markets' },
              { icon: '⇄',  title: 'Alternative Sources', desc: 'Ranked safer suppliers with AI reasoning' },
              { icon: '📊', title: 'Cost Impact', desc: 'Per-material conflict exposure & risk scoring' },
              { icon: '⚠️', title: 'Risk Scoring', desc: 'Country-level geopolitical risk from live data' },
            ].map(f => (
              <div key={f.title} className="bg-surface border border-border rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{f.icon}</div>
                <div className="text-xs font-bold text-white mb-0.5">{f.title}</div>
                <div className="text-[10px] text-gray-500">{f.desc}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setSetupOpen(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
          >
            + Setup Your Supply Chain
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {setupOpen && (
        <CompanySetup
          onCreated={handleCreated}
          onClose={() => setSetupOpen(false)}
        />
      )}

      <CostImpactDashboard
        companyId={companyId}
        company={company}
        onEdit={() => setSetupOpen(true)}
        onReset={handleReset}
      />
    </div>
  );
}
