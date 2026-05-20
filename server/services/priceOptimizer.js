const OpenAI = require('openai');
const { calculateMaterialImpact, calculatePortfolioImpact } = require('./costImpactCalculator');
const { getEvents } = require('./dataFeed');
const supplyChainDb = require('../db/supplyChain');
const pricingDb = require('../db/pricingProfiles');

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

// Derive weighted cost increase % that actually hits this product
// based on which linked materials are affected and raw_material_cost_pct
async function getProductCostImpact(product, companyId) {
  const company = supplyChainDb.getCompany(companyId);
  if (!company) return { increase_pct: 0, materials: [], drivers: [] };

  const linked = product.linked_materials || [];
  const materials = (company.materials || []).filter(m =>
    linked.length === 0 || linked.includes(m.id)
  );

  if (materials.length === 0) return { increase_pct: 0, materials: [], drivers: [] };

  const events = getEvents();
  const impacts = await Promise.all(materials.map(m => calculateMaterialImpact(m, events, null)));

  // Weighted average price change across linked materials by baseline cost
  const totalBaseline = impacts.reduce((s, m) => s + m.baseline_monthly_cost, 0);
  const weightedChangePct = totalBaseline > 0
    ? impacts.reduce((s, m) => s + m.effective_price_impact_pct * (m.baseline_monthly_cost / totalBaseline), 0)
    : 0;

  // Effective hit on this product's cost = raw material % × weighted commodity change
  const effective_increase_pct = weightedChangePct * (product.raw_material_cost_pct / 100);

  const drivers = impacts
    .filter(m => Math.abs(m.effective_price_impact_pct) > 0.5)
    .sort((a, b) => Math.abs(b.effective_price_impact_pct) - Math.abs(a.effective_price_impact_pct))
    .slice(0, 5)
    .map(m => ({
      material: m.material_name,
      price_change_pct: m.price_change_pct,
      effective_change_pct: m.effective_price_impact_pct,
      risk_level: m.risk_level,
      most_at_risk_country: m.most_at_risk_country?.country_name || m.most_at_risk_country?.iso3 || null,
    }));

  return {
    increase_pct: weightedChangePct,       // commodity-level change
    product_cost_increase_pct: effective_increase_pct, // after applying RM%
    materials: impacts,
    drivers,
  };
}

function calculateRequiredPriceIncrease(product, costImpact) {
  const P = product.current_selling_price || 0;
  const M = product.current_margin_pct || 0;
  const T = product.target_margin_pct || 30;
  const MIN = product.minimum_margin_pct || 15;
  const RMP = product.raw_material_cost_pct || 50;
  const monthly_units = product.monthly_units || 1000;

  // Cost structure
  const current_cogs = P * (1 - M / 100);
  const rm_cost = current_cogs * (RMP / 100);
  const non_rm_cost = current_cogs - rm_cost;

  // Apply the product-level cost increase (commodity change × RM%)
  const cost_increase_pct = costImpact?.product_cost_increase_pct ?? (costImpact?.increase_pct ?? 0) * (RMP / 100);
  const new_rm_cost = rm_cost * (1 + cost_increase_pct / 100);
  const new_cogs = new_rm_cost + non_rm_cost;
  const cost_increase_per_unit = new_cogs - current_cogs;

  function priceForMargin(targetPct) {
    // new_price × (1 - target/100) = new_cogs  →  new_price = new_cogs / (1 - target/100)
    if (targetPct >= 100) return P;
    const needed = new_cogs / (1 - targetPct / 100);
    return Math.max(needed, P); // never recommend a price cut
  }

  function build(name, rawNewPrice, label) {
    const np = Math.round(rawNewPrice * 100) / 100;
    const increase_pct = P > 0 ? ((np - P) / P) * 100 : 0;
    const resulting_margin_pct = np > 0 ? ((np - new_cogs) / np) * 100 : 0;
    const revenue_delta_per_unit = np - P;
    const annual_revenue_impact = revenue_delta_per_unit * monthly_units * 12;
    return {
      scenario: name,
      new_price: np,
      price_increase_pct: Math.round(increase_pct * 10) / 10,
      resulting_margin_pct: Math.round(resulting_margin_pct * 10) / 10,
      cost_increase_per_unit: Math.round(cost_increase_per_unit * 100) / 100,
      annual_revenue_impact: Math.round(annual_revenue_impact),
      recommendation: label,
    };
  }

  const scenarios = [
    build('maintain_target',  priceForMargin(T),   `Increase price to preserve ${T}% target margin`),
    build('maintain_minimum', priceForMargin(MIN),  `Minimum increase to protect ${MIN}% floor margin`),
    build('absorb_half',      P + cost_increase_per_unit * 0.5, 'Pass on 50% of cost increase to customers'),
    build('absorb_all',       P,                   'Absorb full cost increase — margin compression'),
  ];

  // Current margin at new costs with no price change (for reference)
  const compressed_margin_pct = P > 0 ? ((P - new_cogs) / P) * 100 : 0;

  return {
    scenarios,
    current_selling_price: P,
    new_cogs,
    current_cogs,
    cost_increase_per_unit: Math.round(cost_increase_per_unit * 100) / 100,
    cost_increase_pct: Math.round(cost_increase_pct * 10) / 10,
    compressed_margin_pct: Math.round(compressed_margin_pct * 10) / 10,
  };
}

async function optimizePricingStrategy(product, costImpact) {
  const scenarioData = calculateRequiredPriceIncrease(product, costImpact);
  const maintainTarget = scenarioData.scenarios.find(s => s.scenario === 'maintain_target');

  const productSummary = {
    name: product.name,
    current_price: product.current_selling_price,
    currency: product.currency,
    current_margin_pct: product.current_margin_pct,
    target_margin_pct: product.target_margin_pct,
    minimum_margin_pct: product.minimum_margin_pct,
    raw_material_cost_pct: product.raw_material_cost_pct,
    recommended_new_price: maintainTarget?.new_price,
    recommended_increase_pct: maintainTarget?.price_increase_pct,
  };

  const marketsSummary = (product.markets || []).map(m => ({
    region: m.region,
    sensitivity: m.price_sensitivity,
    current_local_price: m.current_price,
    currency: m.currency,
    competitor_prices: m.competitor_prices,
  }));

  const prompt = `You are a pricing strategy expert at a global consulting firm.
A company needs to adjust prices due to raw material cost increases caused by geopolitical conflict events.

Product: ${JSON.stringify(productSummary)}
Raw material cost increase: ${(costImpact.increase_pct || 0).toFixed(1)}% (effective product cost impact: ${(costImpact.product_cost_increase_pct || 0).toFixed(1)}%)
Cost drivers: ${JSON.stringify(costImpact.drivers?.slice(0, 3) || [])}
Markets: ${JSON.stringify(marketsSummary)}

Provide a market-by-market pricing strategy. Return ONLY a JSON object:
{
  "overall_recommendation": string,
  "urgency": "immediate" | "within_30_days" | "within_90_days",
  "market_strategies": [
    {
      "market": string,
      "recommended_increase_pct": number,
      "timing": string,
      "rationale": string,
      "risk": string,
      "competitor_context": string
    }
  ],
  "phasing_plan": [
    {
      "phase": number,
      "timing": string,
      "markets": [string],
      "increase_pct": number,
      "rationale": string
    }
  ],
  "communication_tips": [string],
  "risks_to_monitor": [string]
}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const strategy = JSON.parse(response.choices[0].message.content.trim());
  return { ...strategy, scenario_data: scenarioData };
}

function forecastMarginTrend(product, costImpact, months = 12) {
  const P = product.current_selling_price || 0;
  const M = product.current_margin_pct || 0;
  const T = product.target_margin_pct || 30;
  const MIN = product.minimum_margin_pct || 15;
  const RMP = product.raw_material_cost_pct || 50;

  const current_cogs = P * (1 - M / 100);
  const rm_cost = current_cogs * (RMP / 100);
  const non_rm_cost = current_cogs - rm_cost;

  // Total cost increase % spread linearly over the forecast horizon
  const total_cost_increase_pct = costImpact?.product_cost_increase_pct ?? 0;

  // Recommended price (maintain_target scenario)
  const scenarioData = calculateRequiredPriceIncrease(product, costImpact);
  const recommended_price = scenarioData.scenarios.find(s => s.scenario === 'maintain_target')?.new_price || P;

  // Assume price increase is implementable in month 2
  const PRICE_KICK_IN = 2;

  const forecast = [];
  for (let mo = 0; mo <= months; mo++) {
    // Costs ramp up linearly over the full period
    const cost_factor = 1 + (total_cost_increase_pct / 100) * (mo / months);
    const new_rm = rm_cost * cost_factor;
    const new_cogs = new_rm + non_rm_cost;

    const margin_no_increase = P > 0 ? ((P - new_cogs) / P) * 100 : 0;

    const effective_price = mo >= PRICE_KICK_IN ? recommended_price : P;
    const margin_with_increase = effective_price > 0 ? ((effective_price - new_cogs) / effective_price) * 100 : 0;

    forecast.push({
      month: mo,
      label: mo === 0 ? 'Now' : `M+${mo}`,
      margin_no_increase: Math.round(margin_no_increase * 10) / 10,
      margin_with_increase: Math.round(margin_with_increase * 10) / 10,
      target_margin: T,
      minimum_margin: MIN,
      price_increase_active: mo >= PRICE_KICK_IN,
    });
  }

  return {
    months,
    price_increase_timing_month: PRICE_KICK_IN,
    recommended_price,
    current_price: P,
    target_margin: T,
    minimum_margin: MIN,
    forecast,
  };
}

module.exports = { getProductCostImpact, calculateRequiredPriceIncrease, optimizePricingStrategy, forecastMarginTrend };
