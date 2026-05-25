const OpenAI = require('openai');
const NodeCache = require('node-cache');
const supplyChainDb = require('../db/supplyChain');

const cache = new NodeCache({ stdTTL: 1800 }); // 30-min cache

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const SYSTEM_PROMPT = `You are a senior CFO-level financial risk analyst at a top-tier global investment bank. You specialize in supply chain disruption modeling, geopolitical risk quantification, inflation pass-through analysis, and P&L sensitivity analysis. You produce precise, data-driven reports with specific percentage impacts and dollar figures grounded in real-world economic patterns. Always respond ONLY with valid JSON — no markdown, no preamble.`;

function getQuarterLabels() {
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const year = now.getFullYear();
  const labels = [];
  for (let i = 0; i < 4; i++) {
    const q = ((currentQ - 1 + i) % 4) + 1;
    const y = year + Math.floor((currentQ - 1 + i) / 4);
    labels.push(`Q${q} ${y}`);
  }
  return labels;
}

function buildPrompt(company, quarters, conflicts) {
  const pnl = company.pnl || {};
  const revenue = Number(pnl.annual_revenue) || 0;
  const cogsPct = Number(pnl.cogs_pct) || 60;
  const opexPct = Number(pnl.opex_pct) || 20;
  const grossMarginPct = 100 - cogsPct;
  const netProfitPct = grossMarginPct - opexPct;
  const netProfitAbs = revenue * netProfitPct / 100;
  const cogsAbs = revenue * cogsPct / 100;
  const tolerance = Number(company.risk_tolerance?.max_profit_drop_pct) || 15;

  const materialsText = (company.materials || []).map(m => {
    const sources = (m.source_countries || [])
      .map(s => `${s.country_name} (${s.supply_percentage}%)`)
      .join(', ');
    const monthlySpend = (m.monthly_volume || 0) * (m.current_unit_cost || 0);
    const annualSpend = monthlySpend * 12;
    const pctOfCogs = cogsAbs > 0 ? ((annualSpend / cogsAbs) * 100).toFixed(1) : '?';
    return `  • ${m.name}: ${m.monthly_volume} ${m.unit}/mo @ $${m.current_unit_cost}/${m.unit} | Annual: $${annualSpend.toLocaleString()} (${pctOfCogs}% of COGS) | Sources: ${sources || 'unspecified'}`;
  }).join('\n') || '  None specified';

  const buyersText = (company.buyer_markets || [])
    .map(b => `${b.country_name} (${b.percentage}%)`)
    .join(', ') || 'Not specified';

  const conflictsText = (conflicts || [])
    .slice(0, 20)
    .map(c => `  • ${c.name} [${c.region}] — severity ${c.intensity_score || c.scores?.severity || '?'}/10, status: ${c.status}`)
    .join('\n') || '  No active conflicts data';

  return `Produce a comprehensive CFO-grade supply chain P&L risk analysis for the following company. Return ONLY a JSON object.

═══ COMPANY PROFILE ═══
Name: ${company.name}
Industry: ${company.industry || 'Not specified'}
Currency: ${company.base_currency || 'USD'}
Final Product: ${company.final_product || 'Not specified'}
Manufacturing Location: ${company.manufacturing_country_name || 'Not specified'}

═══ RAW MATERIALS (input costs) ═══
${materialsText}

═══ BUYER MARKETS ═══
${buyersText}

═══ ANNUAL P&L BASELINE ═══
Revenue:       $${revenue.toLocaleString()}
COGS:          ${cogsPct}% → $${cogsAbs.toLocaleString()}
Gross Margin:  ${grossMarginPct}%
OpEx:          ${opexPct}%
Net Profit:    ${netProfitPct.toFixed(1)}% → $${netProfitAbs.toLocaleString()}

═══ RISK TOLERANCE ═══
Maximum acceptable net profit decline: ${tolerance}%
Flag any quarter where breach is likely.

═══ ACTIVE GLOBAL CONFLICTS & GEOPOLITICAL RISKS ═══
${conflictsText}

═══ ANALYSIS PERIOD ═══
Quarters: ${quarters.join(' → ')}

═══ REQUIRED JSON STRUCTURE ═══
{
  "overall_risk": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <integer 0-100>,
  "executive_summary": "<3-sentence CFO briefing covering main risks, financial exposure, and top action>",

  "quarterly_forecast": [
    {
      "quarter": "<Q label>",
      "cogs_impact_pct": <% change in COGS vs baseline, positive = cost increase>,
      "revenue_impact_pct": <% change in revenue from demand/FX shifts>,
      "gross_margin_new_pct": <expected gross margin %, accounting for both>,
      "net_profit_impact_pct": <net profit change %, negative = worse>,
      "net_profit_impact_abs": <dollar impact on net profit, negative = loss of profit>,
      "breach_tolerance": <true if |net_profit_impact_pct| > ${tolerance}>,
      "key_drivers": ["<specific conflict or market driver>", "<driver 2>", "<driver 3>"],
      "risk_flags": ["<specific risk item>"],
      "confidence": "LOW|MEDIUM|HIGH",
      "inflation_note": "<one sentence on inflation pass-through for this quarter>"
    }
  ],

  "sensitivity_grid": [
    {
      "scenario": "<scenario name>",
      "description": "<one line description>",
      "commodity_cost_change_pct": <number>,
      "likelihood": "LOW|MEDIUM|HIGH",
      "quarterly_net_profit_impacts": [<Q1%>, <Q2%>, <Q3%>, <Q4%>],
      "annual_net_profit_impact_abs": <dollar amount>,
      "breach_tolerance": <true if any quarter breaches ${tolerance}%>
    }
  ],

  "buyer_market_impact": [
    {
      "country": "<country name>",
      "percentage": <buyer share %>,
      "inflation_rate_pct": <current annual inflation %>,
      "real_wage_growth_pct": <real wage growth %>,
      "purchasing_power_trend": "improving|stable|declining|sharply_declining",
      "demand_impact_pct": <expected demand change % over 4 quarters>,
      "revenue_risk": "LOW|MEDIUM|HIGH|CRITICAL",
      "fx_risk": "LOW|MEDIUM|HIGH",
      "analysis": "<specific 1-2 sentence insight on how this market affects revenue>",
      "social_signals": {
        "consumer_sentiment": "positive|neutral|negative|very_negative",
        "sentiment_trend": "improving|stable|worsening|rapidly_worsening",
        "social_unrest_risk": "LOW|MEDIUM|HIGH|CRITICAL",
        "boycott_risk": "LOW|MEDIUM|HIGH",
        "brand_perception_risk": "LOW|MEDIUM|HIGH|CRITICAL",
        "purchasing_intent_change_pct": <expected % change in purchase intent due to social factors>,
        "consumer_behavior_shifts": ["<e.g. trading down to cheaper alternatives>", "<e.g. increased savings rate>"],
        "trending_signals": ["<specific social signal, event, or sentiment driver>", "<signal 2>"],
        "social_impact_on_demand_pct": <additional demand impact purely from social factors, can be negative>,
        "summary": "<1-2 sentence summary of the social/sentiment landscape and how it amplifies or offsets economic factors>"
      }
    }
  ],

  "material_alternatives": [
    {
      "material": "<material name>",
      "risk_driver": "<why current source is risky>",
      "alternatives": [
        {
          "rank": <integer starting 1>,
          "country": "<country name>",
          "iso3": "<3-letter ISO code>",
          "score": <integer 0-100>,
          "reasoning": "<specific, factual reason this ranks here>",
          "estimated_cost_premium_pct": <% vs current price, negative = cheaper>,
          "transition_time_months": <integer>,
          "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
          "key_advantages": ["<advantage>", "<advantage>"],
          "considerations": ["<caveat or risk>"]
        }
      ]
    }
  ],

  "key_recommendations": [
    {
      "priority": "URGENT|HIGH|MEDIUM",
      "action": "<specific CFO action item>",
      "rationale": "<why this action, what it protects against>",
      "estimated_benefit": "<quantified benefit if possible>"
    }
  ]
}

Rules:
- Base all % impacts on real commodity price volatility patterns and conflict proximity to supply routes
- Sensitivity grid must include at minimum: Stress, Bear, Base, Bull, Recovery scenarios
- For materials with no risky sources, still list 2-3 alternative country options
- All dollar figures must be grounded in the P&L baseline above
- Flag breach_tolerance = true whenever net_profit_impact_pct exceeds ${tolerance}%
- For social_signals: reflect real social media trends, consumer activism patterns, geopolitical sentiment, and conflict-related boycott risks in each buyer country. Consider how local inflation frustration, political instability, anti-brand sentiment, or war proximity affects consumer willingness to buy. purchasing_intent_change_pct and social_impact_on_demand_pct should be separate from and additive to the economic demand_impact_pct`;
}

async function generatePLAnalysis(companyId, conflicts) {
  const company = supplyChainDb.getCompany(companyId);
  if (!company) throw new Error('Company not found');

  const cacheKey = `pl_${companyId}`;
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const quarters = getQuarterLabels();
  const prompt = buildPrompt(company, quarters, conflicts || []);

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 6000,
  });

  let result;
  try {
    result = JSON.parse(response.choices[0].message.content);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  result.generated_at = new Date().toISOString();
  result.quarters = quarters;
  result.company_name = company.name;
  result.pnl_baseline = company.pnl || {};
  result.risk_tolerance = company.risk_tolerance || {};

  cache.set(cacheKey, result);
  return result;
}

function invalidateCache(companyId) {
  cache.del(`pl_${companyId}`);
}

module.exports = { generatePLAnalysis, invalidateCache };
