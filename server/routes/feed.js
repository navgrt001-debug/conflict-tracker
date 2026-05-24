const express = require('express');
const { getEvents, getPrices, getSummary, getChainCache, setChainCache, getNewsUpdatedAt, refresh, fetchOneSymbol } = require('../services/dataFeed');
const { generateCausalChain } = require('../services/causalChain');
const NodeCache = require('node-cache');
const lookupCache = new NodeCache({ stdTTL: 300 });
const router = express.Router();

router.get('/conflicts', (req, res) => {
  res.json({ events: getEvents(), updatedAt: getNewsUpdatedAt() });
});

router.get('/prices', (req, res) => {
  res.json(getPrices());
});

router.get('/summary', (req, res) => {
  res.json(getSummary());
});

// Manual refresh trigger — client can call this to force a feed update
router.post('/refresh', async (req, res) => {
  try {
    await refresh();
    res.json({ ok: true, updatedAt: getNewsUpdatedAt(), count: getEvents().length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lookup any Yahoo Finance symbol on demand (e.g. user-added custom commodity)
router.get('/prices/lookup', async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cached = lookupCache.get(`lookup_${symbol}`);
  if (cached) return res.json(cached);

  // Check if it's already in the batch price data
  const prices = getPrices();
  const existing = prices.commodities.find(c => c.symbol === symbol);
  if (existing) {
    lookupCache.set(`lookup_${symbol}`, existing);
    return res.json(existing);
  }

  const result = await fetchOneSymbol(symbol);
  if (!result) return res.status(404).json({ error: `Symbol "${symbol}" not found on Yahoo Finance` });

  lookupCache.set(`lookup_${symbol}`, result);
  res.json(result);
});

router.get('/causal-chain/:eventId', async (req, res) => {
  const { eventId } = req.params;

  const cached = getChainCache(eventId);
  if (cached) return res.json(cached);

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  const events = getEvents();
  const event = events.find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  try {
    const chain = await generateCausalChain(event);
    setChainCache(eventId, chain);
    res.json(chain);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
