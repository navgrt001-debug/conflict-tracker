const OpenAI = require('openai');
const portfoliosDb = require('../db/portfolios');
const { getEvents } = require('./dataFeed');

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

function loadContext(sessionId) {
  const s = portfoliosDb.getOrCreate(sessionId);
  return {
    portfolio: s.portfolio,
    watchlist: s.watchlist,
    conversation_history: s.conversation_history.slice(-10),
    alert_preferences: s.alert_preferences,
    conversation_count: s.conversation_history.length,
  };
}

function saveContext(sessionId, { role, content }) {
  portfoliosDb.appendConversation(sessionId, role, content);
}

function buildSystemPrompt(sessionId, basePrompt) {
  const s = portfoliosDb.getOrCreate(sessionId);
  const { portfolio } = s;
  if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) return basePrompt;

  const assetLines = portfolio.assets.map(a => {
    const regions = a.region_exposure?.length ? ` [${a.region_exposure.join(', ')} exposure]` : '';
    return `  - ${a.position.toUpperCase()} ${a.symbol} (${a.type}, ${a.size} position)${regions}`;
  }).join('\n');

  const regionsList = portfolio.focus_regions.length
    ? portfolio.focus_regions.join(', ')
    : 'global';

  const histCount = s.conversation_history.length;

  return `${basePrompt}

---
PORTFOLIO CONTEXT — personalize every response to these holdings:
${assetLines}
Risk profile: ${portfolio.risk_profile}
Base currency: ${portfolio.base_currency}
Focus regions: ${regionsList}

INSTRUCTIONS:
- Always state which of the user's specific positions is affected and how
- Use directional language: "Your long WTI benefits from…" / "Your USDTRY short faces headwinds from…"
- Quantify impact where possible with direction and rough magnitude
- Reference their risk profile when recommending actions
- They have had ${histCount} prior conversation${histCount !== 1 ? 's' : ''} — maintain continuity naturally`;
}

async function summarizePortfolioRisk(sessionId) {
  const s = portfoliosDb.getOrCreate(sessionId);
  const { portfolio } = s;
  if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
    return { error: 'No portfolio configured' };
  }

  const events = getEvents().slice(0, 12);
  const conflictLines = events.length
    ? events.map(e => `- ${e.title} (severity ${e.severity || '?'})`).join('\n')
    : '- No live conflict events available';

  const assetList = portfolio.assets
    .map(a => `${a.position} ${a.symbol} (${a.type}, ${a.size})`)
    .join(', ');

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You are a portfolio risk analyst. Return ONLY valid JSON — no markdown, no preamble.

PORTFOLIO: ${assetList}
Risk profile: ${portfolio.risk_profile} | Base currency: ${portfolio.base_currency}

CURRENT EVENTS:
${conflictLines}

Return this exact structure:
{
  "overall_risk_score": 65,
  "risk_level": "HIGH",
  "summary": "2-sentence overall assessment",
  "asset_impacts": [
    {
      "symbol": "WTI",
      "position": "long",
      "impact_score": 75,
      "direction": "positive",
      "reasoning": "one sentence",
      "primary_conflict": "conflict name or event"
    }
  ],
  "top_threat": "single biggest risk in one sentence",
  "recommended_action": "one actionable sentence"
}`,
    }],
  });

  const raw = completion.choices[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in risk response');
  return JSON.parse(match[0]);
}

module.exports = { loadContext, saveContext, buildSystemPrompt, summarizePortfolioRisk };
