const express = require('express');
const router = express.Router();
const { analyzeScenario, getHistory } = require('../services/scenarioEngine');
const templates = require('../data/scenarioTemplates.json');

router.post('/analyze', async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' });

  try {
    const result = await analyzeScenario(question.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req, res) => {
  res.json(getHistory());
});

router.get('/templates', (req, res) => {
  res.json(templates);
});

module.exports = router;
