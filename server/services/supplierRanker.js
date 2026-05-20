const path = require('path');
const OpenAI = require('openai');
const { scoreCountryRisk } = require('./conflictRiskScorer');
const { getEvents } = require('./dataFeed');

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

let _db = null;
function getDb() {
  if (!_db) _db = require(path.join(__dirname, '../data/alternativeSuppliers.json'));
  return _db;
}

// Normalize material name to match JSON keys (case-insensitive, partial)
function findMaterialKey(materialName) {
  const db = getDb();
  const name = materialName.toLowerCase().trim();
  const keys = Object.keys(db);
  return (
    keys.find(k => k.toLowerCase() === name) ||
    keys.find(k => k.toLowerCase().includes(name)) ||
    keys.find(k => name.includes(k.toLowerCase())) ||
    null
  );
}

// Score 0–100 per dimension, then combine with weights
function scoreAlternative(alt, conflictEvents) {
  const risk = scoreCountryRisk(alt.country_iso3, conflictEvents);

  // Risk: lower conflict risk + high political stability = higher score
  const conflictRiskPenalty = risk.risk_score; // 0–100, lower is better
  const stabilityBonus = alt.political_stability_score || 50; // 0–100
  const riskScore = Math.round((stabilityBonus * 0.6 + (100 - conflictRiskPenalty) * 0.4));

  // Price: centre on 0%, ±15% range → 0–100
  const prem = alt.typical_price_premium ?? 0;
  const priceScore = Math.round(Math.max(0, Math.min(100, 50 - prem * 3.33)));

  // Lead time: 0 days = 100, 60+ days = 0
  const lt = alt.avg_lead_time_days ?? 30;
  const leadTimeScore = Math.round(Math.max(0, 100 - (lt / 60) * 100));

  // Quality: direct 0–100
  const qualityScore = alt.quality_score ?? 70;

  const total = Math.round(
    riskScore * 0.40 +
    priceScore * 0.30 +
    leadTimeScore * 0.20 +
    qualityScore * 0.10
  );

  return {
    ...alt,
    scores: {
      risk: riskScore,
      price: priceScore,
      lead_time: leadTimeScore,
      quality: qualityScore,
      total,
    },
    live_conflict_risk: risk,
  };
}

function rankAlternativeSuppliers(materialName, currentSources = [], budget = null) {
  const key = findMaterialKey(materialName);
  if (!key) return { material: materialName, found: false, alternatives: [] };

  const db = getDb();
  const entry = db[key];
  const events = getEvents();

  // Exclude current source countries from alternatives
  const currentIso3s = (currentSources || []).map(s => (s.country_iso3 || s).toUpperCase());

  const scored = (entry.alternatives || [])
    .filter(alt => !currentIso3s.includes(alt.country_iso3.toUpperCase()))
    .map(alt => scoreAlternative(alt, events))
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, 5);

  return {
    material: key,
    found: true,
    primary_producers: entry.primary_producers || [],
    current_sources: currentSources,
    alternatives: scored,
  };
}

async function generateSwitchingPlan(materialName, fromIso3, toIso3) {
  const key = findMaterialKey(materialName);
  const db = getDb();
  const entry = key ? db[key] : null;
  const toAlt = entry?.alternatives?.find(a => a.country_iso3.toUpperCase() === toIso3.toUpperCase());
  const fromAlt = entry?.alternatives?.find(a => a.country_iso3.toUpperCase() === fromIso3.toUpperCase()) ||
    { country_name: fromIso3, typical_price_premium: 0, avg_lead_time_days: 21 };

  const prompt = `You are a supply chain consultant. Generate a practical supplier switching plan as JSON.

Material: ${key || materialName}
Current source: ${fromAlt.country_name || fromIso3} (lead time: ${fromAlt.avg_lead_time_days || 21} days, price premium: ${fromAlt.typical_price_premium || 0}%)
Target source: ${toAlt?.country_name || toIso3} (lead time: ${toAlt?.avg_lead_time_days || 30} days, price premium: ${toAlt?.typical_price_premium || 0}%, key risks: ${(toAlt?.key_risks || []).join(', ')})

Return JSON:
{
  "timeline_weeks": number,
  "transition_cost_estimate_pct": number (% of annual spend),
  "steps": [
    { "week": number, "phase": string, "action": string, "owner": string, "risk": "low"|"medium"|"high" }
  ],
  "quick_wins": [string],
  "key_risks": [string],
  "break_even_months": number,
  "recommendation": string
}

Return only the JSON object.`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content.trim();
  const plan = JSON.parse(raw);
  return {
    material: key || materialName,
    from: { iso3: fromIso3, ...fromAlt },
    to: { iso3: toIso3, ...toAlt },
    plan,
  };
}

function compareSuppliers(materialName, isoA, isoB) {
  const key = findMaterialKey(materialName);
  const db = getDb();
  const entry = key ? db[key] : null;
  const events = getEvents();

  function findAlt(iso3) {
    const alt = entry?.alternatives?.find(a => a.country_iso3.toUpperCase() === iso3.toUpperCase());
    if (!alt) return { country_iso3: iso3, country_name: iso3, quality_score: 50, typical_price_premium: 0, avg_lead_time_days: 30, political_stability_score: 50, currency_risk: 'medium', infrastructure_score: 50, trade_routes: [], key_risks: [], notes: '' };
    return alt;
  }

  const altA = findAlt(isoA);
  const altB = findAlt(isoB);
  const scoredA = scoreAlternative(altA, events);
  const scoredB = scoreAlternative(altB, events);

  // Determine winner per dimension
  function winner(scoreA, scoreB) {
    if (scoreA > scoreB + 2) return 'A';
    if (scoreB > scoreA + 2) return 'B';
    return 'tie';
  }

  const dimensions = [
    { key: 'risk', label: 'Risk Score', format: v => v },
    { key: 'price', label: 'Price Score', format: v => v },
    { key: 'lead_time', label: 'Lead Time Score', format: v => v },
    { key: 'quality', label: 'Quality Score', format: v => v },
    { key: 'total', label: 'Overall Score', format: v => v },
  ];

  const comparison = dimensions.map(d => ({
    dimension: d.label,
    a: scoredA.scores[d.key],
    b: scoredB.scores[d.key],
    winner: winner(scoredA.scores[d.key], scoredB.scores[d.key]),
  }));

  return {
    material: key || materialName,
    supplier_a: scoredA,
    supplier_b: scoredB,
    comparison,
    overall_winner: scoredA.scores.total > scoredB.scores.total + 2 ? 'A'
      : scoredB.scores.total > scoredA.scores.total + 2 ? 'B'
      : 'tie',
  };
}

module.exports = { rankAlternativeSuppliers, generateSwitchingPlan, compareSuppliers, findMaterialKey };
