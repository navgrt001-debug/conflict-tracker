const axios = require('axios');
const OpenAI = require('openai');
const { getPrices, getEvents } = require('./dataFeed');
const { scoreCountryRisk } = require('./conflictRiskScorer');
const supplyChainDb = require('../db/supplyChain');

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

// In-process price cache for symbols not in the default feed
const priceCache = new Map();
const PRICE_TTL = 15 * 60 * 1000;

async function fetchSymbolPrice(symbol) {
  if (!symbol) return null;

  // Check main feed first
  const { commodities } = getPrices();
  const found = commodities.find(c => c.symbol === symbol);
  if (found) return found;

  // Check process cache
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.ts < PRICE_TTL) return cached.data;

  try {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { params: { interval: '1d', range: '5d' }, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
    );
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const priceData = {
      symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      currency: meta.currency || 'USD',
    };
    priceCache.set(symbol, { ts: Date.now(), data: priceData });
    return priceData;
  } catch {
    return null;
  }
}

const RISK_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function getRiskLevel(disruptionRisk, priceImpactPct) {
  const abs = Math.abs(priceImpactPct);
  if (disruptionRisk >= 70 || abs >= 20) return 'CRITICAL';
  if (disruptionRisk >= 40 || abs >= 10) return 'HIGH';
  if (disruptionRisk >= 20 || abs >= 5) return 'MEDIUM';
  return 'LOW';
}

async function calculateMaterialImpact(material, conflictEvents, priceChanges) {
  const events = conflictEvents || getEvents();

  // Resolve price change %
  let priceChangePct = 0;
  if (material.symbol) {
    if (priceChanges && priceChanges[material.symbol] !== undefined) {
      priceChangePct = priceChanges[material.symbol];
    } else {
      const p = await fetchSymbolPrice(material.symbol);
      if (p) priceChangePct = p.changePct || 0;
    }
  }

  // Score each source country
  const sourceRisks = (material.source_countries || []).map(sc => {
    const risk = scoreCountryRisk(sc.iso3, events);
    return { ...sc, ...risk };
  });

  const totalPct = sourceRisks.reduce((s, sc) => s + (sc.supply_percentage || 0), 0) || 100;

  // Weighted disruption risk
  const weightedDisruption = sourceRisks.reduce(
    (s, sc) => s + (sc.risk_score * (sc.supply_percentage / totalPct)), 0
  );

  // Amplify price impact if supply countries are high-risk
  const riskMult = weightedDisruption > 60 ? 1.3 : weightedDisruption > 30 ? 1.1 : 1.0;
  const effectivePriceImpactPct = priceChangePct * riskMult;

  const baseline_monthly_cost = (material.monthly_volume || 0) * (material.current_unit_cost || 0);
  const projected_unit_cost = (material.current_unit_cost || 0) * (1 + effectivePriceImpactPct / 100);
  const monthly_cost_increase = baseline_monthly_cost * (effectivePriceImpactPct / 100);
  const annual_cost_increase = monthly_cost_increase * 12;
  const disruption_risk_pct = Math.round(weightedDisruption);
  const risk_level = getRiskLevel(disruption_risk_pct, effectivePriceImpactPct);

  const sortedSrc = [...sourceRisks].sort((a, b) => b.risk_score - a.risk_score);

  return {
    material_id: material.id,
    material_name: material.name,
    symbol: material.symbol,
    unit: material.unit,
    monthly_volume: material.monthly_volume,
    current_unit_cost: material.current_unit_cost,
    baseline_monthly_cost,
    price_change_pct: priceChangePct,
    effective_price_impact_pct: effectivePriceImpactPct,
    disruption_risk_pct,
    projected_unit_cost,
    monthly_cost_increase,
    annual_cost_increase,
    risk_level,
    source_risks: sourceRisks,
    most_at_risk_country: sortedSrc[0] || null,
    calculated_at: new Date().toISOString(),
  };
}

async function calculatePortfolioImpact(companyId) {
  const company = supplyChainDb.getCompany(companyId);
  if (!company) throw new Error('Company not found');
  if (!company.materials || company.materials.length === 0) {
    return {
      company_id: companyId, company_name: company.name,
      total_monthly_baseline: 0, total_monthly_increase: 0,
      total_annual_increase: 0, increase_pct: 0,
      overall_risk_level: 'LOW', materials: [],
      most_at_risk_material: null, most_at_risk_country: null,
      calculated_at: new Date().toISOString(),
    };
  }

  const events = getEvents();
  const materials = await Promise.all(company.materials.map(m => calculateMaterialImpact(m, events, null)));

  const total_monthly_baseline = materials.reduce((s, m) => s + m.baseline_monthly_cost, 0);
  const total_monthly_increase = materials.reduce((s, m) => s + m.monthly_cost_increase, 0);
  const total_annual_increase = total_monthly_increase * 12;
  const increase_pct = total_monthly_baseline > 0 ? (total_monthly_increase / total_monthly_baseline) * 100 : 0;

  const overallRiskIdx = materials.reduce((max, m) => {
    const idx = RISK_ORDER.indexOf(m.risk_level);
    return idx > max ? idx : max;
  }, 0);

  const sortedByIncrease = [...materials].sort((a, b) => b.annual_cost_increase - a.annual_cost_increase);
  const most_at_risk_material = sortedByIncrease[0] || null;

  // Highest-risk country across all materials
  const countryMap = {};
  materials.forEach(m => {
    (m.source_risks || []).forEach(sc => {
      if (!countryMap[sc.iso3] || sc.risk_score > countryMap[sc.iso3].risk_score) {
        countryMap[sc.iso3] = sc;
      }
    });
  });
  const most_at_risk_country = Object.values(countryMap).sort((a, b) => b.risk_score - a.risk_score)[0] || null;

  return {
    company_id: companyId,
    company_name: company.name,
    industry: company.industry,
    total_monthly_baseline,
    total_monthly_increase,
    total_annual_increase,
    increase_pct,
    overall_risk_level: RISK_ORDER[overallRiskIdx],
    most_at_risk_material,
    most_at_risk_country,
    materials: sortedByIncrease,
    calculated_at: new Date().toISOString(),
  };
}

async function generateImpactNarrative(companyId, impactData) {
  const company = supplyChainDb.getCompany(companyId);
  const summary = {
    company: company?.name,
    industry: company?.industry,
    total_annual_exposure: impactData.total_annual_increase?.toFixed(0),
    increase_pct: impactData.increase_pct?.toFixed(1),
    overall_risk: impactData.overall_risk_level,
    top_materials: (impactData.materials || []).slice(0, 4).map(m => ({
      name: m.material_name,
      risk: m.risk_level,
      annual_increase: m.annual_cost_increase?.toFixed(0),
      price_change_pct: m.price_change_pct?.toFixed(1),
      disruption_risk: m.disruption_risk_pct,
      most_at_risk_country: m.most_at_risk_country?.country_name || m.most_at_risk_country?.iso3,
    })),
    most_at_risk_country: impactData.most_at_risk_country?.country_name || impactData.most_at_risk_country?.iso3,
  };

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: `You are a supply chain risk analyst at a top consulting firm. Write a concise executive summary (max 200 words) covering: 1) Total financial exposure with exact dollar amounts, 2) Which materials are most at risk and why, 3) Which conflict zones are driving costs, 4) Urgency level and recommended immediate actions. Professional business language suitable for a CFO. Be specific with numbers.`,
      },
      { role: 'user', content: `Write the executive summary for this supply chain impact data: ${JSON.stringify(summary)}` },
    ],
  });

  return completion.choices[0]?.message?.content || 'Analysis unavailable.';
}

module.exports = { calculateMaterialImpact, calculatePortfolioImpact, generateImpactNarrative, fetchSymbolPrice };
