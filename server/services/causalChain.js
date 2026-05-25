const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const SYSTEM_PROMPT = `You are a senior geopolitical-financial analyst at a macro hedge fund. Given a conflict event, generate a precise causal chain showing how it propagates through commodities, FX, and equity markets.

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
  "historical_analogues": [
    {
      "event": "2022 Russia invasion of Ukraine",
      "similarity": "Both involve a major energy-exporting nation under sanctions, creating near-identical supply shock dynamics in European gas markets",
      "outcome": "Brent crude surged 30% in 3 weeks; EUR/USD fell to 20-year lows; European equities dropped 12%"
    }
  ],
  "overall_market_sentiment": "risk-off"
}

CHAIN RULES:
- Generate 4-7 steps, ordered from most direct to most downstream market impact
- direction must be exactly "up" or "down"
- overall_market_sentiment must be exactly "risk-on", "risk-off", or "neutral"
- confidence is 0-100 integer
- magnitude uses format like "+2-4%" or "-1-3%" or "±5-8%"
- Be specific: name exact assets, exact mechanisms (e.g. "Red Sea shipping lanes disrupted → freight insurance premiums spike → European energy import costs rise")

HISTORICAL ANALOGUES RULES — CRITICAL:
- Provide exactly 2-3 analogues
- Each analogue MUST share at least TWO of the following with the current event: same geographic region, same type of actor (state/non-state), same commodity supply chain affected, same geopolitical mechanism (sanctions, blockade, coup, etc.)
- The "similarity" field must explicitly name the shared factors — do not write generic similarity statements
- The "outcome" field must cite real, specific, quantified market movements with timeframes
- DO NOT use an analogue just because it is a famous conflict — it must genuinely resemble THIS event's market mechanism
- If no strong analogue exists, use 1 precise one rather than padding with weak matches
- NEVER include: vague analogues like "Gulf War (general market uncertainty)", unrelated regional conflicts, events with no documented market impact`;

async function generateCausalChain(event) {
  const prompt = `Conflict event: "${event.title}"
Source: ${event.sourcecountry} | Severity: ${event.severity}/10 | Date: ${event.seendate}
${event.summary ? `Summary: ${event.summary}` : ''}

Generate the causal chain for how this event impacts global financial markets. For historical analogues, only include events that share the same geographic region, commodity exposure, or geopolitical mechanism as this specific event.`;

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
