import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PLForecastPanel from './PLForecastPanel';
import SensitivityGrid from './SensitivityGrid';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

// ── Full Report Generator ─────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function buildReportHTML(company, plData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const pnl = company.pnl || {};
  const rev = Number(pnl.annual_revenue) || 0;
  const cogsPct = Number(pnl.cogs_pct) || 0;
  const opexPct = Number(pnl.opex_pct) || 0;
  const grossPct = 100 - cogsPct;
  const netPct = grossPct - opexPct;
  const tolerance = company.risk_tolerance?.max_profit_drop_pct || 15;

  // ── Quarterly forecast table ────────────────────────────────────────────────
  const qRows = (plData?.quarterly_forecast || []).map(q => {
    const breach = q.breach_tolerance ? '⚠ BREACH' : '';
    const impactStyle = (q.net_profit_impact_pct || 0) < 0 ? 'color:#c0392b' : 'color:#27ae60';
    return `
      <tr style="${q.breach_tolerance ? 'background:#fff0f0' : ''}">
        <td style="padding:8px 10px;font-weight:600">${q.quarter} ${breach ? `<span style="color:#c0392b;font-size:9pt">${breach}</span>` : ''}</td>
        <td style="padding:8px 10px;text-align:center;${(q.cogs_impact_pct || 0) > 0 ? 'color:#c0392b' : 'color:#27ae60'}">${q.cogs_impact_pct > 0 ? '+' : ''}${q.cogs_impact_pct?.toFixed(1) || '—'}%</td>
        <td style="padding:8px 10px;text-align:center">${q.gross_margin_new_pct?.toFixed(1) || '—'}%</td>
        <td style="padding:8px 10px;text-align:center;${impactStyle};font-weight:700">${q.net_profit_impact_pct > 0 ? '+' : ''}${q.net_profit_impact_pct?.toFixed(1) || '—'}%</td>
        <td style="padding:8px 10px;text-align:right;${impactStyle}">${fmtMoney(q.net_profit_impact_abs)}</td>
        <td style="padding:8px 10px;font-size:9pt;color:#555">${(q.key_drivers || []).slice(0, 2).join('; ')}</td>
      </tr>`;
  }).join('');

  // ── Sensitivity grid table ──────────────────────────────────────────────────
  const quarters = plData?.quarters || ['Q1', 'Q2', 'Q3', 'Q4'];
  const gridRows = (plData?.sensitivity_grid || []).map(row => {
    const impacts = row.quarterly_net_profit_impacts || [];
    const cells = impacts.map((v, i) => {
      const breach = Math.abs(v || 0) > tolerance;
      const style = breach ? 'background:#fff0f0;color:#c0392b;font-weight:700' : (v || 0) < 0 ? 'color:#c0392b' : 'color:#27ae60';
      return `<td style="padding:6px 8px;text-align:center;${style}">${v != null ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%${breach ? ' ⚠' : ''}` : '—'}</td>`;
    }).join('');
    const annualStyle = (row.annual_net_profit_impact_abs || 0) < 0 ? 'color:#c0392b;font-weight:700' : 'color:#27ae60;font-weight:700';
    return `
      <tr>
        <td style="padding:8px 10px;font-weight:600">${row.scenario}</td>
        <td style="padding:8px 10px;text-align:center;${row.commodity_cost_change_pct > 0 ? 'color:#c0392b' : 'color:#27ae60'}">${row.commodity_cost_change_pct > 0 ? '+' : ''}${row.commodity_cost_change_pct}%</td>
        <td style="padding:8px 10px;text-align:center">${row.likelihood || '—'}</td>
        ${cells}
        <td style="padding:8px 10px;text-align:right;${annualStyle}">${fmtMoney(row.annual_net_profit_impact_abs)}</td>
      </tr>`;
  }).join('');

  // ── Buyer markets ───────────────────────────────────────────────────────────
  const buyerRows = (plData?.buyer_market_impact || []).map(b => `
    <tr>
      <td style="padding:8px 10px;font-weight:600">${b.country}</td>
      <td style="padding:8px 10px;text-align:center">${b.percentage}%</td>
      <td style="padding:8px 10px;text-align:center">${b.inflation_rate_pct?.toFixed(1) || '—'}%</td>
      <td style="padding:8px 10px;text-align:center">${b.real_wage_growth_pct != null ? `${b.real_wage_growth_pct > 0 ? '+' : ''}${b.real_wage_growth_pct.toFixed(1)}%` : '—'}</td>
      <td style="padding:8px 10px;text-align:center;${b.revenue_risk === 'HIGH' || b.revenue_risk === 'CRITICAL' ? 'color:#c0392b;font-weight:700' : ''}">${b.revenue_risk}</td>
      <td style="padding:8px 10px;font-size:9pt;color:#555">${b.analysis || ''}</td>
    </tr>`).join('');

  // ── Alternative sources ─────────────────────────────────────────────────────
  const altSections = (plData?.material_alternatives || []).map(mat => {
    const altRows = (mat.alternatives || []).map(a => `
      <tr>
        <td style="padding:6px 10px;text-align:center;font-weight:700;color:#1a3a8f">${a.rank}</td>
        <td style="padding:6px 10px;font-weight:600">${a.country}</td>
        <td style="padding:6px 10px;text-align:center;${a.risk_level === 'LOW' ? 'color:#27ae60' : a.risk_level === 'MEDIUM' ? 'color:#e67e22' : 'color:#c0392b'}">${a.risk_level}</td>
        <td style="padding:6px 10px;text-align:center">${a.score}/100</td>
        <td style="padding:6px 10px;text-align:center;${(a.estimated_cost_premium_pct || 0) < 0 ? 'color:#27ae60' : 'color:#c0392b'}">${a.estimated_cost_premium_pct > 0 ? '+' : ''}${a.estimated_cost_premium_pct?.toFixed(1)}%</td>
        <td style="padding:6px 10px;text-align:center">${a.transition_time_months}mo</td>
        <td style="padding:6px 10px;font-size:9pt;color:#555">${a.reasoning || ''}</td>
      </tr>`).join('');
    return `
      <h3 style="font-size:11pt;color:#2c3e70;margin:18px 0 6px">${mat.material}</h3>
      ${mat.risk_driver ? `<p style="font-size:9pt;color:#c0392b;margin:0 0 8px">⚠ Risk driver: ${mat.risk_driver}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
        <thead><tr style="background:#f0f4ff">
          <th style="padding:6px 10px;text-align:center">Rank</th>
          <th style="padding:6px 10px;text-align:left">Country</th>
          <th style="padding:6px 10px;text-align:center">Risk</th>
          <th style="padding:6px 10px;text-align:center">Score</th>
          <th style="padding:6px 10px;text-align:center">Cost Δ</th>
          <th style="padding:6px 10px;text-align:center">Transition</th>
          <th style="padding:6px 10px;text-align:left">Reasoning</th>
        </tr></thead>
        <tbody>${altRows}</tbody>
      </table>`;
  }).join('');

  // ── Recommendations ─────────────────────────────────────────────────────────
  const recList = (plData?.key_recommendations || []).map((r, i) => `
    <div style="margin:10px 0;padding:12px 14px;border-left:4px solid ${r.priority === 'URGENT' ? '#c0392b' : r.priority === 'HIGH' ? '#e67e22' : '#f39c12'};background:#fafafa;border-radius:0 6px 6px 0">
      <div style="font-weight:700;font-size:10pt;color:${r.priority === 'URGENT' ? '#c0392b' : r.priority === 'HIGH' ? '#e67e22' : '#e67e22'}">${r.priority} — ${r.action}</div>
      <div style="font-size:9pt;color:#555;margin-top:4px">${r.rationale}</div>
      ${r.estimated_benefit ? `<div style="font-size:9pt;color:#27ae60;margin-top:4px">💡 ${r.estimated_benefit}</div>` : ''}
    </div>`).join('');

  // ── Materials input table ───────────────────────────────────────────────────
  const matRows = (company.materials || []).map(m => {
    const sources = (m.source_countries || []).map(s => `${s.country_name} (${s.supply_percentage}%)`).join(', ');
    const monthly = (m.monthly_volume || 0) * (m.current_unit_cost || 0);
    return `
      <tr>
        <td style="padding:6px 10px;font-weight:600">${m.name}</td>
        <td style="padding:6px 10px;text-align:center">${m.monthly_volume?.toLocaleString()} ${m.unit}/mo</td>
        <td style="padding:6px 10px;text-align:center">$${m.current_unit_cost?.toLocaleString()}/${m.unit}</td>
        <td style="padding:6px 10px;text-align:right">$${monthly.toLocaleString()}/mo</td>
        <td style="padding:6px 10px;font-size:9pt">${sources || 'N/A'}</td>
      </tr>`;
  }).join('');

  const buyerSummary = (company.buyer_markets || []).map(b => `${b.country_name} (${b.percentage}%)`).join(', ') || 'N/A';

  const riskColor = plData?.overall_risk === 'CRITICAL' ? '#c0392b' : plData?.overall_risk === 'HIGH' ? '#e67e22' : plData?.overall_risk === 'MEDIUM' ? '#f39c12' : '#27ae60';
  const breachCount = (plData?.quarterly_forecast || []).filter(q => q.breach_tolerance).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Supply Chain Financial Analysis — ${company.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; font-size: 10.5pt; color: #111; background: #fff; padding: 32px 48px; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 20pt; color: #1a1a2e; margin-bottom: 4px; }
    h2 { font-size: 13pt; color: #1a1a2e; margin: 28px 0 8px; border-bottom: 2px solid #1a1a2e; padding-bottom: 4px; }
    h3 { font-size: 11pt; color: #2c3e70; margin: 16px 0 6px; }
    p { line-height: 1.65; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
    th { background: #1a1a2e; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; letter-spacing: 0.03em; }
    td { border-bottom: 1px solid #e8e8e8; vertical-align: top; }
    tr:nth-child(even) td { background: #f9f9fb; }
    .header { border-bottom: 3px solid #1a1a2e; padding-bottom: 14px; margin-bottom: 22px; }
    .meta { font-size: 9pt; color: #555; margin-top: 6px; }
    .tag { display: inline-block; background: #1a1a2e; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; margin-right: 6px; font-family: monospace; }
    .kpi-row { display: flex; gap: 14px; margin: 14px 0; }
    .kpi { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; text-align: center; }
    .kpi-val { font-size: 16pt; font-weight: bold; color: #1a1a2e; }
    .kpi-lbl { font-size: 8pt; color: #666; margin-top: 2px; }
    .risk-badge { display:inline-block;padding:4px 12px;border-radius:4px;font-weight:700;font-size:11pt;color:#fff;background:${riskColor} }
    .exec-summary { background: #f0f4ff; border-left: 4px solid #1a3a8f; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 14px 0; }
    .disclaimer { margin-top: 32px; padding: 10px 14px; background: #fafafa; border-left: 3px solid #aaa; font-size: 8.5pt; color: #666; line-height: 1.5; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }
    .print-btn { display:block;margin:0 auto 24px;padding:10px 28px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;font-size:11pt;cursor:pointer; }
    .print-btn:hover { background:#2c3e70; }
    .tolerance-note { font-size:9pt;color:#888;font-style:italic }
    @media print { body { padding: 20px 30px; } .no-print { display:none; } }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 Download as PDF / Print</button>

  <div class="header">
    <div class="meta" style="margin-bottom:8px">
      <span class="tag">SUPPLY CHAIN FINANCIAL ANALYSIS</span>
      <span class="tag">CONFIDENTIAL — INTERNAL USE ONLY</span>
    </div>
    <h1>${company.name}</h1>
    <div class="meta">
      ${company.industry ? `<strong>Industry:</strong> ${company.industry} &nbsp;|&nbsp;` : ''}
      ${company.final_product ? `<strong>Product:</strong> ${company.final_product} &nbsp;|&nbsp;` : ''}
      ${company.manufacturing_country_name ? `<strong>Manufacturing:</strong> ${company.manufacturing_country_name} &nbsp;|&nbsp;` : ''}
      <strong>Report Date:</strong> ${dateStr} &nbsp;|&nbsp;
      <strong>Currency:</strong> ${company.base_currency || 'USD'}
    </div>
  </div>

  <!-- Risk Overview -->
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:16px">
    <div>
      <div style="font-size:9pt;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Overall Supply Chain Risk</div>
      <span class="risk-badge">${plData?.overall_risk || 'UNKNOWN'} &nbsp; ${plData?.risk_score || '—'}/100</span>
    </div>
    ${breachCount > 0 ? `<div style="padding:8px 14px;background:#fff0f0;border:1px solid #e8a0a0;border-radius:6px;color:#c0392b;font-weight:600;font-size:10pt">⚠ ${breachCount} quarter${breachCount > 1 ? 's' : ''} breach your ${tolerance}% profit tolerance threshold</div>` : `<div style="padding:8px 14px;background:#f0fff4;border:1px solid #a0e8b0;border-radius:6px;color:#27ae60;font-size:10pt">✓ No tolerance breaches projected</div>`}
  </div>

  <!-- Executive Summary -->
  <div class="exec-summary">
    <strong style="font-size:10pt">Executive Summary</strong>
    <p style="margin-top:8px">${plData?.executive_summary || 'Run P&L analysis to generate executive summary.'}</p>
  </div>

  <!-- P&L Baseline -->
  <h2>1. P&L Baseline</h2>
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">$${(rev / 1_000_000).toFixed(2)}M</div><div class="kpi-lbl">Annual Revenue</div></div>
    <div class="kpi"><div class="kpi-val">${cogsPct}%</div><div class="kpi-lbl">COGS</div></div>
    <div class="kpi"><div class="kpi-val">${grossPct}%</div><div class="kpi-lbl">Gross Margin</div></div>
    <div class="kpi"><div class="kpi-val">${opexPct}%</div><div class="kpi-lbl">OpEx</div></div>
    <div class="kpi" style="border-color:#1a3a8f"><div class="kpi-val" style="color:${netPct > 10 ? '#27ae60' : netPct > 0 ? '#e67e22' : '#c0392b'}">${netPct.toFixed(1)}%</div><div class="kpi-lbl">Net Profit Margin</div></div>
  </div>
  <p class="tolerance-note">Risk tolerance: flag quarters where net profit declines more than <strong>${tolerance}%</strong>.</p>

  <!-- Input Materials -->
  <h2>2. Raw Material Inputs</h2>
  <table>
    <thead><tr><th>Material</th><th style="text-align:center">Volume</th><th style="text-align:center">Unit Cost</th><th style="text-align:right">Monthly Spend</th><th>Source Countries</th></tr></thead>
    <tbody>${matRows || '<tr><td colspan="5" style="padding:10px;color:#888">No materials configured</td></tr>'}</tbody>
  </table>
  <p style="font-size:9pt;color:#555;margin-top:6px"><strong>Buyer markets:</strong> ${buyerSummary}</p>

  <!-- Quarterly P&L Forecast -->
  <h2>3. Quarterly P&L Forecast — ${(plData?.quarters || []).join(', ')}</h2>
  ${plData?.quarterly_forecast?.length ? `
  <table>
    <thead><tr>
      <th>Quarter</th>
      <th style="text-align:center">COGS Δ</th>
      <th style="text-align:center">Gross Margin</th>
      <th style="text-align:center">Net Profit Δ</th>
      <th style="text-align:right">$ Impact</th>
      <th>Key Drivers</th>
    </tr></thead>
    <tbody>${qRows}</tbody>
  </table>
  <p style="font-size:8.5pt;color:#888;margin-top:6px">⚠ BREACH = projected net profit decline exceeds ${tolerance}% tolerance threshold.</p>
  ` : '<p style="color:#888;font-style:italic">Run P&L analysis to generate quarterly forecast.</p>'}

  <!-- Inflation & Purchasing Power -->
  ${(plData?.buyer_market_impact || []).length ? `
  <h2>4. Buyer Market Purchasing Power & Inflation</h2>
  <table>
    <thead><tr>
      <th>Market</th>
      <th style="text-align:center">Share</th>
      <th style="text-align:center">Inflation</th>
      <th style="text-align:center">Real Wage Growth</th>
      <th style="text-align:center">Revenue Risk</th>
      <th>Analysis</th>
    </tr></thead>
    <tbody>${buyerRows}</tbody>
  </table>` : ''}

  <!-- Sensitivity Grid -->
  ${(plData?.sensitivity_grid || []).length ? `
  <h2>5. CFO Sensitivity Grid — Net Profit Impact %</h2>
  <table>
    <thead><tr>
      <th>Scenario</th>
      <th style="text-align:center">Cost Δ</th>
      <th style="text-align:center">Likelihood</th>
      ${(plData?.quarters || []).map(q => `<th style="text-align:center">${q}</th>`).join('')}
      <th style="text-align:right">Annual Impact</th>
    </tr></thead>
    <tbody>${gridRows}</tbody>
  </table>
  <p style="font-size:8.5pt;color:#888;margin-top:6px">⚠ = quarter breaches ${tolerance}% tolerance. Red cells require immediate CFO attention.</p>
  ` : ''}

  <!-- Alternative Sources -->
  ${(plData?.material_alternatives || []).length ? `
  <h2>6. Alternative Commodity Sources — Ranked by Safety</h2>
  ${altSections}
  ` : ''}

  <!-- Recommendations -->
  ${(plData?.key_recommendations || []).length ? `
  <h2>7. Priority Recommendations</h2>
  ${recList}
  ` : ''}

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is AI-generated and intended for internal strategic planning purposes only. All projections, forecasts and risk scores are modelled estimates and should be independently verified before making financial, investment or procurement decisions. Geopolitical and macroeconomic conditions may change rapidly. The authors make no warranty as to the accuracy or completeness of this analysis.
  </div>
  <div class="footer">
    <span>Global Conflict &amp; Market Intelligence Platform — Supply Chain Intelligence</span>
    <span>Generated ${dateStr}</span>
  </div>
</body>
</html>`;
}

function FullReportPanel({ companyId, company }) {
  const [generating, setGenerating] = useState(false);

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ['pl-analysis', companyId],
    queryFn: () => fetch(`${API}/supply-chain/companies/${companyId}/pl-analysis`).then(r => r.json()),
    staleTime: 30 * 60_000,
    enabled: !!companyId,
    retry: false,
  });

  const hasPL = !!plData && !plLoading;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let data = plData;
      if (!data) {
        const r = await fetch(`${API}/supply-chain/companies/${companyId}/pl-analysis`);
        data = await r.json();
      }
      const html = buildReportHTML(company, data);
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch (e) {
      alert('Failed to generate report: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const sections = [
    { icon: '📋', title: 'P&L Baseline', desc: 'Revenue, COGS, gross margin, and net profit baseline with tolerance threshold' },
    { icon: '📦', title: 'Raw Material Inputs', desc: 'All commodities, volumes, unit costs, monthly spend, and source countries' },
    { icon: '📅', title: 'Quarterly P&L Forecast', desc: '4-quarter AI projection with COGS impact, margin changes, and breach flags' },
    { icon: '🌍', title: 'Buyer Market Analysis', desc: 'Purchasing power, inflation, real wage growth, and demand risk per market' },
    { icon: '🎯', title: 'CFO Sensitivity Grid', desc: 'Full scenario table (Stress → Recovery) with per-quarter net profit % impact' },
    { icon: '⇄', title: 'Alternative Sources', desc: 'Ranked safer commodity suppliers with cost premium, transition time, reasoning' },
    { icon: '⚡', title: 'Priority Recommendations', desc: 'Urgent, High, and Medium CFO action items with estimated financial benefit' },
  ];

  const pnl = company?.pnl || {};
  const hasFinancials = (pnl.annual_revenue || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Report overview card */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="text-white font-bold text-base mb-1">Full Supply Chain Financial Analysis Report</h3>
          <p className="text-xs text-gray-400">
            A comprehensive, print-ready PDF combining all AI analysis, P&L modelling, sensitivity scenarios, and procurement recommendations.
          </p>
        </div>

        {/* Section list */}
        <div className="divide-y divide-border">
          {sections.map((s, i) => (
            <div key={i} className="flex items-start gap-4 px-6 py-3.5">
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
              <div className="ml-auto shrink-0 text-[10px] text-green-500 font-medium mt-1">✓ Included</div>
            </div>
          ))}
        </div>

        {/* Status + generate button */}
        <div className="px-6 py-5 border-t border-border bg-card/40 space-y-3">
          {/* Data readiness */}
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${hasFinancials ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={hasFinancials ? 'text-green-400' : 'text-red-400'}>
                {hasFinancials ? 'P&L data ready' : 'No P&L data — edit setup'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${(company?.buyer_markets || []).length > 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className={(company?.buyer_markets || []).length > 0 ? 'text-green-400' : 'text-amber-400'}>
                {(company?.buyer_markets || []).length > 0 ? 'Buyer markets set' : 'No buyer markets'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${hasPL ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className={hasPL ? 'text-green-400' : 'text-amber-400'}>
                {hasPL ? 'AI analysis ready' : plLoading ? 'Generating AI analysis…' : 'AI analysis not yet run'}
              </span>
            </div>
          </div>

          {!hasFinancials && (
            <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
              ⚠ Add your P&L financials in the setup wizard (Edit) to enable full forecasting in the report.
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || plLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {generating || plLoading ? (
              <>
                <span className="animate-spin">⟳</span>
                {plLoading ? 'Generating AI analysis first…' : 'Building report…'}
              </>
            ) : (
              <>
                <span>📄</span>
                Generate & Download Full Report
              </>
            )}
          </button>
          <p className="text-[10px] text-gray-600 text-center">
            Opens a print-ready page — use browser Print → Save as PDF to download.
            {hasPL && plData?.generated_at && (
              <span className="ml-1 text-gray-600">Analysis from {new Date(plData.generated_at).toLocaleTimeString()}.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
async function fetchImpact(companyId) {
  const res = await fetch(`${API}/supply-chain/companies/${companyId}/impact`);
  if (!res.ok) throw new Error('Impact fetch failed');
  return res.json();
}

export default function CostImpactDashboard({ companyId, company, onEdit }) {
  const [mainTab, setMainTab] = useState('forecast');

  const { data: impact, isLoading, isError, refetch } = useQuery({
    queryKey: ['supply-impact', companyId],
    queryFn: () => fetchImpact(companyId),
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading supply chain data…</p>
      </div>
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center text-red-400 text-sm">
        Failed to load. <button onClick={refetch} className="underline">Retry</button>
      </div>
    </div>
  );

  if (!impact) return null;

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full">
      <div className="max-w-5xl mx-auto w-full p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-white font-bold text-lg">{company?.name || impact.company_name}</h2>
            <p className="text-xs text-gray-500">
              {company?.industry}
              {company?.final_product && ` · ${company.final_product}`}
              {company?.manufacturing_country_name && ` · Mfg: ${company.manufacturing_country_name}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex bg-surface border border-border rounded-lg overflow-hidden text-xs font-medium">
              {[
                { id: 'forecast',    label: '📈 P&L Forecast' },
                { id: 'sensitivity', label: '🎯 Sensitivity Grid' },
                { id: 'impact',      label: '📄 Full Report' },
              ].map(t => (
                <button key={t.id} onClick={() => setMainTab(t.id)}
                  className={`px-3 py-1.5 transition-colors ${mainTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={onEdit}
              className="text-xs px-3 py-1.5 border border-border text-gray-500 hover:text-gray-300 rounded-lg transition-colors">
              ✏ Edit
            </button>
          </div>
        </div>

        {mainTab === 'forecast' && <PLForecastPanel companyId={companyId} company={company} />}
        {mainTab === 'sensitivity' && <SensitivityGrid companyId={companyId} company={company} />}
        {mainTab === 'impact' && <FullReportPanel companyId={companyId} company={company} />}
      </div>
    </div>
  );
}
