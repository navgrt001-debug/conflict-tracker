const express = require('express');
const router = express.Router();
const conflicts = require('../data/conflicts');
const { computeAll } = require('../utils/heuristics');

router.get('/', (req, res) => {
  const enriched = conflicts.map(c => ({
    ...c,
    scores: computeAll(c, null),
  }));
  res.json(enriched);
});

router.get('/:id', (req, res) => {
  const conflict = conflicts.find(c => c.id === req.params.id);
  if (!conflict) return res.status(404).json({ error: 'Conflict not found' });
  res.json({ ...conflict, scores: computeAll(conflict, null) });
});

module.exports = router;
