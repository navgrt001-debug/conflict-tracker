const express = require('express');
const { getEvents, getPrices, getSummary, getChainCache, setChainCache } = require('../services/dataFeed');
const { generateCausalChain } = require('../services/causalChain');
const router = express.Router();

router.get('/conflicts', (req, res) => {
  res.json(getEvents());
});

router.get('/prices', (req, res) => {
  res.json(getPrices());
});

router.get('/summary', (req, res) => {
  res.json(getSummary());
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
