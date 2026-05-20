const express = require('express');
const router = express.Router();
const db = require('../db/predictions');
const { generatePrediction, resolvePredictions, getAccuracyStats, pickAssets, fetchCurrentPrice } = require('../services/predictionEngine');
const dataFeed = require('../services/dataFeed');

// POST /api/predictions/generate
router.post('/generate', async (req, res) => {
  const { eventId, asset } = req.body;

  const events = dataFeed.getEvents();
  const event = events.find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found in feed' });

  const { ASSET_TRIGGERS } = (() => {
    // Inline lookup matching predictionEngine's ASSET_TRIGGERS
    const triggers = [
      { asset: 'CL=F',   label: 'WTI Crude Oil' },
      { asset: 'BZ=F',   label: 'Brent Crude' },
      { asset: 'GC=F',   label: 'Gold' },
      { asset: 'ZW=F',   label: 'Wheat' },
      { asset: 'NG=F',   label: 'Natural Gas' },
      { asset: 'USDTRY', label: 'USD/TRY' },
      { asset: 'USDZAR', label: 'USD/ZAR' },
      { asset: 'USDBRL', label: 'USD/BRL' },
      { asset: 'USDEGP', label: 'USD/EGP' },
      { asset: 'USDNGN', label: 'USD/NGN' },
    ];
    return { ASSET_TRIGGERS: triggers };
  })();

  let assetInfo;
  if (asset) {
    assetInfo = ASSET_TRIGGERS.find(t => t.asset === asset);
    if (!assetInfo) return res.status(400).json({ error: `Unknown asset: ${asset}` });
  } else {
    const auto = pickAssets(event.title, event.summary || '');
    assetInfo = auto[0] || ASSET_TRIGGERS.find(t => t.asset === 'GC=F');
  }

  try {
    const prediction = await generatePrediction(event, assetInfo);
    if (!prediction) return res.status(409).json({ error: 'Prediction already exists for this event + asset' });
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictions/active
router.get('/active', (req, res) => {
  res.json(db.getActive());
});

// GET /api/predictions/history
router.get('/history', (req, res) => {
  res.json(db.getHistory());
});

// GET /api/predictions/accuracy
router.get('/accuracy', (req, res) => {
  res.json(getAccuracyStats());
});

// POST /api/predictions/resolve/:id  (manual resolve)
router.post('/resolve/:id', async (req, res) => {
  const pred = db.getById(req.params.id);
  if (!pred) return res.status(404).json({ error: 'Prediction not found' });
  if (pred.status !== 'pending') return res.status(400).json({ error: 'Already resolved' });

  try {
    const currentPrice = await fetchCurrentPrice(pred.asset);
    if (!currentPrice || !pred.initial_price) {
      db.update(pred.id, { status: 'expired' });
      return res.json({ status: 'expired', message: 'Could not fetch price' });
    }

    const actualChangePct = ((currentPrice - pred.initial_price) / pred.initial_price) * 100;
    const actualDirection = actualChangePct >= 0 ? 'up' : 'down';
    const directionCorrect = actualDirection === pred.direction;

    // Parse predicted magnitude midpoint
    const nums = (pred.magnitude || '').match(/-?\d+(\.\d+)?/g);
    const predictedMid = nums ? Math.abs(nums.map(Number).reduce((a, b) => a + b, 0) / nums.length) : 0;
    const actualAbs = Math.abs(actualChangePct);
    const magnitudeClose = predictedMid > 0 && actualAbs >= predictedMid * 0.5;

    const accuracyScore = directionCorrect && magnitudeClose ? 100 : directionCorrect ? 60 : 0;

    const updated = db.update(pred.id, {
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

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
