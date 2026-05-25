const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const supplyChainDb = require('../db/supplyChain');
const { calculateMaterialImpact, calculatePortfolioImpact, generateImpactNarrative } = require('../services/costImpactCalculator');
const { scoreCountryRisk } = require('../services/conflictRiskScorer');
const { getEvents } = require('../services/dataFeed');
const commoditySymbols = require('../data/commoditySymbols.json');
const { rankAlternativeSuppliers, generateSwitchingPlan, compareSuppliers } = require('../services/supplierRanker');
const { generatePLAnalysis, invalidateCache: invalidatePLCache } = require('../services/plAnalyzer');
const conflicts = require('../data/conflicts');

const impactCache = new NodeCache({ stdTTL: 300 });

// --- Companies ---
router.post('/companies', (req, res) => {
  try {
    const company = supplyChainDb.createCompany(req.body);
    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/companies', (req, res) => {
  res.json(supplyChainDb.getAllCompanies());
});

router.get('/companies/:id', (req, res) => {
  const company = supplyChainDb.getCompany(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

router.delete('/companies/:id', (req, res) => {
  supplyChainDb.deleteCompany(req.params.id);
  res.json({ success: true });
});

// --- Materials ---
router.post('/companies/:id/materials', (req, res) => {
  const material = supplyChainDb.addMaterial(req.params.id, req.body);
  if (!material) return res.status(404).json({ error: 'Company not found' });
  impactCache.del(`impact_${req.params.id}`);
  res.status(201).json(material);
});

router.put('/companies/:id/materials/:materialId', (req, res) => {
  const material = supplyChainDb.updateMaterial(req.params.id, req.params.materialId, req.body);
  if (!material) return res.status(404).json({ error: 'Not found' });
  impactCache.del(`impact_${req.params.id}`);
  res.json(material);
});

router.delete('/companies/:id/materials/:materialId', (req, res) => {
  supplyChainDb.deleteMaterial(req.params.id, req.params.materialId);
  impactCache.del(`impact_${req.params.id}`);
  res.json({ success: true });
});

// --- Impact reports ---
router.get('/companies/:id/impact', async (req, res) => {
  const { id } = req.params;
  const withNarrative = req.query.narrative === 'true';
  const forceRefresh = req.query.refresh === 'true';

  const cacheKey = `impact_${id}${withNarrative ? '_narr' : ''}`;
  if (!forceRefresh) {
    const cached = impactCache.get(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });
  }

  try {
    const impact = await calculatePortfolioImpact(id);
    if (withNarrative) impact.narrative = await generateImpactNarrative(id, impact);
    impactCache.set(cacheKey, impact);
    res.json(impact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/companies/:id/impact/:materialId', async (req, res) => {
  const company = supplyChainDb.getCompany(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const material = (company.materials || []).find(m => m.id === req.params.materialId);
  if (!material) return res.status(404).json({ error: 'Material not found' });
  try {
    const impact = await calculateMaterialImpact(material, getEvents(), null);
    res.json(impact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Country risk ---
router.get('/countries/:iso3/risk', (req, res) => {
  const risk = scoreCountryRisk(req.params.iso3.toUpperCase(), getEvents());
  res.json(risk);
});

// --- One-shot analysis ---
router.post('/analyze', async (req, res) => {
  const { materials } = req.body;
  if (!Array.isArray(materials) || materials.length === 0) {
    return res.status(400).json({ error: 'materials array required' });
  }
  try {
    const results = await Promise.all(materials.map(m => calculateMaterialImpact(m, getEvents(), null)));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Commodity symbols lookup ---
router.get('/commodity-symbols', (req, res) => {
  res.json(commoditySymbols);
});

// --- Alternative Suppliers ---

// GET /alternatives/:material — list alternatives for a commodity
router.get('/alternatives/:material', (req, res) => {
  const { material } = req.params;
  const currentSources = req.query.current ? req.query.current.split(',') : [];
  try {
    const result = rankAlternativeSuppliers(decodeURIComponent(material), currentSources);
    if (!result.found) return res.status(404).json({ error: `No alternatives data for "${material}"` });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /alternatives/rank — rank with full material context from a company material object
router.post('/alternatives/rank', (req, res) => {
  const { material_name, sources, budget } = req.body;
  if (!material_name) return res.status(400).json({ error: 'material_name required' });
  try {
    const result = rankAlternativeSuppliers(material_name, sources || [], budget || null);
    if (!result.found) return res.status(404).json({ error: `No alternatives data for "${material_name}"` });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /switching-plan?material=&from=&to=
router.get('/switching-plan', async (req, res) => {
  const { material, from, to } = req.query;
  if (!material || !from || !to) return res.status(400).json({ error: 'material, from, to required' });
  try {
    const result = await generateSwitchingPlan(material, from, to);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /compare?material=&a=&b=
router.get('/compare', (req, res) => {
  const { material, a, b } = req.query;
  if (!material || !a || !b) return res.status(400).json({ error: 'material, a, b required' });
  try {
    const result = compareSuppliers(material, a, b);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- P&L Analysis (AI-powered quarterly forecast + sensitivity grid) ---
router.get('/companies/:id/pl-analysis', async (req, res) => {
  const { id } = req.params;
  const forceRefresh = req.query.refresh === 'true';

  if (forceRefresh) invalidatePLCache(id);

  try {
    const result = await generatePLAnalysis(id, conflicts);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invalidate PL cache when company is updated
router.put('/companies/:id', (req, res) => {
  const company = supplyChainDb.updateCompany(req.params.id, req.body);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  impactCache.del(`impact_${req.params.id}`);
  invalidatePLCache(req.params.id);
  res.json(company);
});

module.exports = router;
