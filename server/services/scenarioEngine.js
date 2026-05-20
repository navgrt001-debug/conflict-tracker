const OpenAI = require('openai');
const NodeCache = require('node-cache');

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
const cache = new NodeCache({ stdTTL: 3600 });

// In-memory history — last 20 scenarios
const history = [];

const SYSTEM_PROMPT = `You are a senior geopolitical risk analyst at a top hedge fund. Your task is to analyze a hypothetical geopolitical scenario with precision and return structured JSON only — no markdown, no explanation outside the JSON.

Return this exact structure:
{
  "scenario": "concise restatement of the scenario",
  "probability": 15,
  "timeframe": "3-6 months",
  "scenarios": {
    "base_case": {
      "probability": 55,
      "description": "2-3 sentences on the most likely sequence of events",
      "market_impacts": [
        {
          "asset": "WTI Crude Oil",
          "direction": "up",
          "magnitude": "+15-25%",
          "reasoning": "one sentence causal explanation"
        }
      ]
    },
    "bull_case": {
      "probability": 25,
      "description": "2-3 sentences on a more optimistic/de-escalatory outcome",
      "market_impacts": []
    },
    "bear_case": {
      "probability": 20,
      "description": "2-3 sentences on a more severe/escalatory outcome",
      "market_impacts": []
    }
  },
  "key_triggers": ["list", "of", "specific", "triggers", "to", "watch"],
  "historical_analogues": [
    {
      "event": "1973 Arab Oil Embargo",
      "year": 1973,
      "outcome": "Oil prices quadrupled, global recession followed",
      "similarity": 78
    }
  ],
  "recommended_hedges": ["Long WTI futures", "Long gold ETFs"],
  "monitoring_signals": ["Iran tanker movements in Hormuz", "US carrier group deployments"]
}

Rules:
- base_case + bull_case + bear_case probabilities must sum to 100
- direction must be exactly "up" or "down"
- probability (top-level) = probability this scenario actually occurs at all (0-100)
- magnitude uses format like "+5-10%" or "-15-20%"
- Include 4-7 market impacts per case covering equities, commodities, FX, and bonds
- Include 2-4 historical analogues with similarity 0-100
- Include 5-8 key_triggers, 3-5 recommended_hedges, 4-6 monitoring_signals
- Be quantitatively specific — avoid vague language`;

function parseJsonRobust(raw) {
  // Try clean parse first
  try { return JSON.parse(raw); } catch (_) {}

  // Attempt to close truncated JSON by trimming to the last complete top-level field.
  // Walk backwards from the end and try closing with ]} pairs until it parses.
  let attempt = raw;
  // Strip trailing partial line (common cause of parse failures)
  attempt = attempt.replace(/,\s*"[^"]*$/, '').replace(/,\s*$/, '');

  const closers = [']}]}', ']}', ']}]}', '}}', '}'];
  for (const tail of closers) {
    try { return JSON.parse(attempt + tail); } catch (_) {}
  }

  // Last resort: find the last valid } that closes the root object
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i] === '}') {
      try { return JSON.parse(raw.slice(0, i + 1)); } catch (_) {}
    }
  }

  throw new Error('Could not parse JSON from AI response');
}

async function analyzeScenario(question) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const cacheKey = question.toLowerCase().trim().replace(/\s+/g, ' ');
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    max_tokens: 6000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this geopolitical scenario: "${question}"` },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');

  const result = parseJsonRobust(match[0]);

  // Validate required fields
  if (!result.scenarios?.base_case || !result.scenarios?.bull_case || !result.scenarios?.bear_case) {
    throw new Error('Invalid scenario structure from AI');
  }

  const entry = {
    id: `sc-${Date.now()}`,
    question,
    result,
    analyzed_at: new Date().toISOString(),
  };

  cache.set(cacheKey, entry);
  history.unshift(entry);
  if (history.length > 20) history.pop();

  return entry;
}

function getHistory() { return history; }

module.exports = { analyzeScenario, getHistory };
