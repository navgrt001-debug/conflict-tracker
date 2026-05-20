const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const portfoliosDb = require('../db/portfolios');
const { summarizePortfolioRisk } = require('../services/contextManager');

const riskCache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL

router.get('/:sessionId', (req, res) => {
  const session = portfoliosDb.getOrCreate(req.params.sessionId);
  res.json({
    portfolio: session.portfolio,
    watchlist: session.watchlist,
    alert_preferences: session.alert_preferences,
    conversation_count: session.conversation_history.length,
    last_active: session.last_active,
  });
});

router.post('/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { portfolio } = req.body;
  if (!portfolio) return res.status(400).json({ error: 'portfolio is required' });
  portfoliosDb.updatePortfolio(sessionId, portfolio);
  riskCache.del(sessionId); // invalidate cached risk when portfolio changes
  res.json({ success: true });
});

router.get('/:sessionId/risk', async (req, res) => {
  const { sessionId } = req.params;
  const cached = riskCache.get(sessionId);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const risk = await summarizePortfolioRisk(sessionId);
    riskCache.set(sessionId, risk);
    res.json(risk);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:sessionId', (req, res) => {
  portfoliosDb.deleteSession(req.params.sessionId);
  res.json({ success: true });
});

module.exports = router;
