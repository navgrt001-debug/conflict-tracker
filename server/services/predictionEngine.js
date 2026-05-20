const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const axios = require('axios');
const db = require('../db/predictions');
const dataFeed = require('./dataFeed');

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

// Which assets to watch per event keyword
const ASSET_TRIGGERS = [
  { asset: 'CL=F',   label: 'WTI Crude Oil', keywords: ['oil', 'opec', 'iran', 'iraq', 'saudi', 'gulf', 'petroleum', 'middle east', 'gaza', 'israel', 'houthi', 'red sea'] },
  { asset: 'GC=F',   label: 'Gold',           keywords: ['war', 'attack', 'killed', 'airstrike', 'nuclear', 'sanctions', 'crisis', 'conflict', 'invasion'] },
  { asset: 'ZW=F',   label: 'Wheat',          keywords: ['ukraine', 'russia', 'grain', 'wheat', 'food', 'drought', 'africa', 'famine'] },
  { asset: 'NG=F',   label: 'Natural Gas',    keywords: ['gas', 'pipeline', 'lng', 'russia', 'europe', 'energy', 'winter'] },
  { asset: 'USDTRY', label: 'USD/TRY',        keywords: ['turkey', 'turkish', 'erdogan', 'ankara', 'lira'] },
  { asset: 'USDZAR', label: 'USD/ZAR',        keywords: ['south africa', 'rand', 'pretoria', 'johannesburg', 'africa'] },
  { asset: 'USDBRL', label: 'USD/BRL',        keywords: ['brazil', 'lula', 'brasilia', 'amazon'] },
  { asset: 'USDEGP', label: 'USD/EGP',        keywords: ['egypt', 'cairo', 'suez', 'sinai', 'nile'] },
];

function pickAssets(title = '', summary = '') {
  const text = (title + ' ' + summary).toLowerCase();
  const scored = ASSET_TRIGGERS.map(t => ({
    ...t,
    score: t.keywords.filter(kw => text.includes(kw)).length,
  })).filter(t => t.score > 0).sort((a, b) => b.score - a.score);
  // Return top 2 matches, always include Gold if severity>=8 (handled by caller)
  return scored.slice(0, 2);
}

async function fetchCurrentPrice(asset) {
  // FX assets (USDXXX) use the exchange rate API
  if (asset.startsWith('USD') && asset.length === 6) {
    const code = asset.slice(3);
    try {
      const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 });
      return data.rates?.[code] || null;
    } catch { return null; }
  }
  // Commodity/equity - Yahoo Finance
  try {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset)}`,
      { params: { interval: '1d', range: '1d' }, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
    );
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch { return null; }
}

const SYSTEM_PROMPT = `You are a quantitative geopolitical analyst. Given a conflict event headline and an asset, generate a specific, data-driven price prediction.
Respond in JSON only — no markdown, no explanation outside the JSON:
{
  "asset": "asset symbol",
  "direction": "up",
  "magnitude": "+3-5%",
  "timeframe_days": 7,
  "confidence": 72,
  "reasoning": "max 100 words explaining the causal link",
  "key_risks": ["risk1", "risk2"],
  "historical_basis": "one comparable historical event"
}
Rules: direction must be exactly "up" or "down". timeframe_days: 1-30. confidence: 0-100.`;

async function generatePrediction(event, assetInfo) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');
  if (db.hasEventPrediction(event.id, assetInfo.asset)) return null; // already exists

  const prompt = `Conflict event: "${event.title}"
Source: ${event.sourcecountry}, Severity: ${event.severity}/10
Asset to predict: ${assetInfo.label} (${assetInfo.asset})
Date: ${new Date(event.seendate).toDateString()}`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    max_tokens: 600,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in prediction response');
  const pred = JSON.parse(match[0]);

  const initialPrice = await fetchCurrentPrice(assetInfo.asset);
  const resolveDate = new Date(Date.now() + pred.timeframe_days * 86400000).toISOString();

  const record = {
    id: uuidv4(),
    created_at: new Date().toISOString(),
    event_id: event.id,
    conflict_event: event.title,
    source_country: event.sourcecountry,
    asset: assetInfo.asset,
    asset_label: assetInfo.label,
    direction: pred.direction,
    magnitude: pred.magnitude,
    timeframe_days: pred.timeframe_days,
    confidence: pred.confidence,
    reasoning: pred.reasoning,
    key_risks: pred.key_risks || [],
    historical_basis: pred.historical_basis || '',
    initial_price: initialPrice,
    resolve_date: resolveDate,
    actual_outcome: null,
    accuracy_score: null,
    status: 'pending',
  };

  return db.add(record);
}

function parseMagnitudeMidpoint(magnitude = '') {
  const nums = magnitude.match(/-?\d+(\.\d+)?/g);
  if (!nums) return 0;
  const values = nums.map(Number);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function resolvePredictions() {
  const expired = db.getExpired();
  if (expired.length === 0) return;
  console.log(`[predictionEngine] Resolving ${expired.length} expired predictions`);

  for (const pred of expired) {
    try {
      const currentPrice = await fetchCurrentPrice(pred.asset);
      if (!currentPrice || !pred.initial_price) {
        db.update(pred.id, { status: 'expired' });
        continue;
      }

      const actualChangePct = ((currentPrice - pred.initial_price) / pred.initial_price) * 100;
      const actualDirection = actualChangePct >= 0 ? 'up' : 'down';
      const directionCorrect = actualDirection === pred.direction;
      const predictedMid = Math.abs(parseMagnitudeMidpoint(pred.magnitude));
      const actualAbs = Math.abs(actualChangePct);
      const magnitudeClose = predictedMid > 0 && actualAbs >= predictedMid * 0.5;

      let accuracyScore;
      if (directionCorrect && magnitudeClose) accuracyScore = 100;
      else if (directionCorrect) accuracyScore = 60;
      else accuracyScore = 0;

      db.update(pred.id, {
        status: 'resolved',
        actual_outcome: {
          direction: actualDirection,
          magnitude: `${actualChangePct >= 0 ? '+' : ''}${actualChangePct.toFixed(2)}%`,
          initial_price: pred.initial_price,
          final_price: currentPrice,
          verified_at: new Date().toISOString(),
        },
        accuracy_score: accuracyScore,
      });
      console.log(`[predictionEngine] Resolved ${pred.asset}: score=${accuracyScore}`);
    } catch (err) {
      console.error(`[predictionEngine] Failed to resolve ${pred.id}:`, err.message);
    }
  }
}

function getAccuracyStats() {
  const resolved = db.getHistory().filter(p => p.status === 'resolved' && p.accuracy_score !== null);
  if (resolved.length === 0) return { total: 0, directional: 0, avg_score: 0, by_asset: {} };

  const directional = resolved.filter(p => p.accuracy_score >= 60).length;
  const avgScore = resolved.reduce((s, p) => s + p.accuracy_score, 0) / resolved.length;

  const byAsset = {};
  for (const p of resolved) {
    if (!byAsset[p.asset_label]) byAsset[p.asset_label] = { total: 0, correct: 0 };
    byAsset[p.asset_label].total++;
    if (p.accuracy_score >= 60) byAsset[p.asset_label].correct++;
  }

  // Add accuracy_pct
  for (const key of Object.keys(byAsset)) {
    byAsset[key].accuracy_pct = Math.round((byAsset[key].correct / byAsset[key].total) * 100);
  }

  // Build timeline (accuracy rolling by resolved date)
  const timeline = resolved
    .sort((a, b) => new Date(a.actual_outcome?.verified_at) - new Date(b.actual_outcome?.verified_at))
    .map((p, i, arr) => {
      const window = arr.slice(0, i + 1);
      const windowCorrect = window.filter(x => x.accuracy_score >= 60).length;
      return {
        date: p.actual_outcome?.verified_at?.slice(0, 10),
        accuracy: Math.round((windowCorrect / window.length) * 100),
        count: i + 1,
      };
    });

  return {
    total: resolved.length,
    directional: directional,
    directional_pct: Math.round((directional / resolved.length) * 100),
    avg_score: Math.round(avgScore),
    by_asset: byAsset,
    timeline,
  };
}

async function autoGenerateForHighSeverity() {
  const events = dataFeed.getEvents();
  const highSeverity = events.filter(e => e.severity >= 7);

  for (const event of highSeverity.slice(0, 5)) { // max 5 per run to avoid API spam
    const assets = pickAssets(event.title, event.summary || '');
    // Always consider Gold for high-severity events
    const goldTrigger = ASSET_TRIGGERS.find(t => t.asset === 'GC=F');
    const toGenerate = assets.length > 0 ? assets : [goldTrigger];

    for (const assetInfo of toGenerate.slice(0, 2)) {
      try {
        const result = await generatePrediction(event, assetInfo);
        if (result) console.log(`[predictionEngine] Auto-generated: ${assetInfo.asset} for "${event.title.slice(0, 50)}..."`);
      } catch (err) {
        console.error(`[predictionEngine] Auto-gen failed (${assetInfo.asset}):`, err.message);
      }
    }
  }
}

function startPredictionScheduler() {
  // Resolve expired predictions daily at 06:00
  cron.schedule('0 6 * * *', resolvePredictions);
  // Auto-generate for high severity events every 30 min
  cron.schedule('*/30 * * * *', autoGenerateForHighSeverity);
  // Run once on startup after a short delay (let data feed load first)
  setTimeout(autoGenerateForHighSeverity, 20000);
}

module.exports = { generatePrediction, resolvePredictions, getAccuracyStats, pickAssets, startPredictionScheduler, fetchCurrentPrice };
