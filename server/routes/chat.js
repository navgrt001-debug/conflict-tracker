const express = require('express');
const OpenAI = require('openai');
const conflicts = require('../data/conflicts');
const { buildSystemPrompt, saveContext } = require('../services/contextManager');
const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const conflictList = conflicts
  .map(c => `- ${c.name} (${c.region}): ${c.tags.join(', ')}`)
  .join('\n');

const BASE_SYSTEM_PROMPT = `You are a senior geopolitical intelligence analyst who specializes in connecting everyday economic and social problems to their underlying global conflict drivers.

You have deep knowledge of these active global conflicts:
${conflictList}

YOUR CONVERSATION FLOW:
1. CORRELATE — When the user describes any problem (high fuel prices, food costs, currency weakness, supply shortages, inflation, etc.), identify which active conflict(s) are the primary driver and explain the exact causal chain. Be specific: name the conflict, explain the mechanism (sanctions, blocked shipping lanes, commodity supply disruption, energy embargo, etc.).
2. ENGAGE — Ask clarifying questions, go deeper on angles the user is interested in, bring in market data and historical precedents.
3. SUMMARIZE — After 3 or more exchanges, OR whenever the user asks for a summary or scenarios, produce a structured intelligence summary using EXACTLY this format:

---
## INTELLIGENCE SUMMARY

**Core Problem:** [one sentence]
**Primary Conflict Driver:** [conflict name and region]
**Causal Chain:** [2–3 sentences: how the conflict mechanically causes the problem]

### SCENARIO A — [short title] | Probability: ~X%
[2–3 sentences on what happens, timeline, and impact on the user's problem]

### SCENARIO B — [short title] | Probability: ~X%
[2–3 sentences]

### SCENARIO C — [short title] | Probability: ~X%
[2–3 sentences]

**Bottom Line:** [one direct, actionable sentence for the user]
---

RULES:
- Be direct and analytical, never vague or diplomatic to a fault.
- Use specific numbers, dates, and percentages where you can.
- The three scenario probabilities must add up to 100%.
- Scenario A is always the most likely (highest probability).
- Do not produce the summary prematurely — have at least one back-and-forth exchange first unless the user explicitly asks for the summary immediately.`;

router.post('/', async (req, res) => {
  const { messages, sessionId } = req.body;

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Build personalized system prompt if session provided
  const systemPrompt = sessionId
    ? buildSystemPrompt(sessionId, BASE_SYSTEM_PROMPT)
    : BASE_SYSTEM_PROMPT;

  // Persist user message
  if (sessionId) {
    const lastUser = messages[messages.length - 1];
    if (lastUser?.role === 'user') {
      saveContext(sessionId, { role: 'user', content: lastUser.content });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let accumulated = '';

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: 4000,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        accumulated += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Persist assistant response
    if (sessionId && accumulated) {
      saveContext(sessionId, { role: 'assistant', content: accumulated });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
