const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const SYSTEM_PROMPT = `You are a geopolitical-financial analyst. Given a conflict event headline, generate a precise causal chain showing exactly how it impacts commodities, FX, and equity markets.

Respond with ONLY valid JSON matching this exact structure:
{
  "event": "brief event description",
  "severity": 7,
  "chain": [
    {
      "step": 1,
      "what": "what happens as a direct result",
      "affects": "asset or market affected (e.g. Brent Crude, USD/TRY, S&P 500)",
      "direction": "up",
      "magnitude": "+3-5%",
      "timeframe": "1-3 days",
      "confidence": 82
    }
  ],
  "historical_analogues": ["2022 Russia-Ukraine gas supply shock", "2019 Strait of Hormuz tanker attacks"],
  "overall_market_sentiment": "risk-off"
}

Rules:
- Generate 4-7 chain steps, from most direct to most downstream impact
- direction must be exactly "up" or "down"
- overall_market_sentiment must be exactly "risk-on", "risk-off", or "neutral"
- confidence is 0-100 integer
- magnitude uses format like "+2-4%" or "-1-3%" or "±5-8%"
- Be specific about WHICH assets are affected and WHY
- historical_analogues: 2-3 real past events that are similar`;

async function generateCausalChain(event) {
  const prompt = `Conflict event: "${event.title}"
Source country: ${event.sourcecountry}
Date: ${event.seendate}

Generate the causal chain for how this event impacts global financial markets.`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '';

  // Extract JSON even if model wraps it in markdown code fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!parsed.chain || !Array.isArray(parsed.chain)) throw new Error('Invalid chain structure');

  return parsed;
}

module.exports = { generateCausalChain };
