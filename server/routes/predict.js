const express = require('express');
const OpenAI = require('openai');
const { computeAll } = require('../utils/heuristics');
const conflicts = require('../data/conflicts');
const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

function buildPrompt(conflict, scores, marketData, tradeData) {
  const marketSummary = marketData?.quotes?.length
    ? marketData.quotes.map(q => `${q.name}: $${q.price?.toFixed(2)} (${q.changePct?.toFixed(2)}%)`).join(', ')
    : 'No market data available';

  const tradeSummary = tradeData?.gdp?.length
    ? `GDP: $${(tradeData.gdp[0]?.value / 1e9).toFixed(0)}B (${tradeData.gdp[0]?.year}), Exports: $${(tradeData.exports?.[0]?.value / 1e9)?.toFixed(0)}B, Inflation: ${tradeData.inflation?.[0]?.value?.toFixed(1)}%`
    : 'Trade data limited';

  return `You are a senior geopolitical and financial intelligence analyst at a major risk firm. Analyze the following conflict and provide a structured intelligence report.

## CONFLICT: ${conflict.name}
**Region:** ${conflict.region}
**Type:** ${conflict.type}
**Status:** ${conflict.status}
**Active Since:** ${conflict.startDate}
**Parties:** ${conflict.parties.join(', ')}
**Key Tags:** ${conflict.tags.join(', ')}
**Key Commodities:** ${conflict.commodities.join(', ')}
**Casualties Estimate:** ${conflict.casualtiesEstimate}
**Displaced:** ${conflict.displaced}

## RISK SCORES (AI-Computed Heuristics)
- **Conflict Severity:** ${scores.severity}/100
- **Economic Impact:** ${scores.economic}/100
- **Escalation Risk:** ${scores.escalation}/100
- **Combined Risk Index:** ${scores.combined}/100 (${scores.label})

## MARKET DATA (Real-Time)
${marketSummary}

## ECONOMIC INDICATORS (World Bank)
${tradeSummary}

## YOUR ANALYSIS TASK

Provide a comprehensive intelligence assessment covering:

1. **Current Situation Assessment** — What is the actual ground truth right now? Key developments in the last 6-12 months.

2. **Geopolitical Drivers** — What are the root causes and what geopolitical forces are sustaining or escalating this conflict?

3. **Economic & Commodity Impact** — How is this conflict affecting global supply chains, commodity markets, and financial markets? Quantify where possible.

4. **12-Month Scenario Forecast** — Provide THREE scenarios:
   - **Base Case (most likely, ~50%):** What probably happens
   - **Downside Scenario (~25%):** Escalation path and market impact
   - **Upside Scenario (~25%):** Resolution or de-escalation path

5. **Key Risk Triggers** — What specific events or signals would indicate this is moving toward the downside or upside scenario?

6. **Investment & Trade Implications** — For investors, traders, and businesses with exposure: specific actionable intelligence on which assets, commodities, and currencies face the most significant risk.

7. **Intelligence Confidence Level** — Rate your confidence (High/Medium/Low) in your assessment and note key uncertainties.

Be direct, specific, and analytical. Use data and historical precedents. Avoid vague platitudes.`;
}

router.post('/', async (req, res) => {
  const { conflictId, marketData, tradeData } = req.body;

  const conflict = conflicts.find(c => c.id === conflictId);
  if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  const scores = computeAll(conflict, null);
  const prompt = buildPrompt(conflict, scores, marketData, tradeData);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: 8000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, scores })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
