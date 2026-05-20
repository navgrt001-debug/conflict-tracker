const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const pricingDb = require('../db/pricingProfiles');
const { getProductCostImpact, calculateRequiredPriceIncrease, optimizePricingStrategy, forecastMarginTrend } = require('../services/priceOptimizer');

const pricingCache = new NodeCache({ stdTTL: 300 });

// POST /api/pricing/products — add a product to a company
router.post('/products', (req, res) => {
  const { company_id, ...productData } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id required' });
  try {
    const product = pricingDb.addProduct(company_id, productData);
    pricingCache.del(`scenarios_${product.id}`);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/pricing/products/:companyId — list all products
router.get('/products/:companyId', (req, res) => {
  res.json(pricingDb.getProducts(req.params.companyId));
});

// PUT /api/pricing/products/:companyId/:productId — update a product
router.put('/products/:companyId/:productId', (req, res) => {
  const product = pricingDb.updateProduct(req.params.companyId, req.params.productId, req.body);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  pricingCache.del(`scenarios_${req.params.productId}`);
  pricingCache.del(`strategy_${req.params.productId}`);
  pricingCache.del(`forecast_${req.params.productId}`);
  res.json(product);
});

// DELETE /api/pricing/products/:companyId/:productId
router.delete('/products/:companyId/:productId', (req, res) => {
  pricingDb.deleteProduct(req.params.companyId, req.params.productId);
  res.json({ success: true });
});

// GET /api/pricing/scenarios/:companyId/:productId — all pricing scenarios
router.get('/scenarios/:companyId/:productId', async (req, res) => {
  const { companyId, productId } = req.params;
  const cacheKey = `scenarios_${productId}`;
  const cached = pricingCache.get(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  const product = pricingDb.getProduct(companyId, productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    const costImpact = await getProductCostImpact(product, companyId);
    const result = calculateRequiredPriceIncrease(product, costImpact);
    const out = { product, cost_impact: costImpact, ...result };
    pricingCache.set(cacheKey, out);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pricing/optimize/:companyId/:productId — AI pricing strategy
router.get('/optimize/:companyId/:productId', async (req, res) => {
  const { companyId, productId } = req.params;
  const forceRefresh = req.query.refresh === 'true';
  const cacheKey = `strategy_${productId}`;

  if (!forceRefresh) {
    const cached = pricingCache.get(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });
  }

  const product = pricingDb.getProduct(companyId, productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    const costImpact = await getProductCostImpact(product, companyId);
    const strategy = await optimizePricingStrategy(product, costImpact);
    const out = { product, cost_impact: costImpact, strategy };
    pricingCache.set(cacheKey, out);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pricing/forecast/:companyId/:productId?months=12
router.get('/forecast/:companyId/:productId', async (req, res) => {
  const { companyId, productId } = req.params;
  const months = Math.min(parseInt(req.query.months) || 12, 24);
  const cacheKey = `forecast_${productId}_${months}`;
  const cached = pricingCache.get(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  const product = pricingDb.getProduct(companyId, productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    const costImpact = await getProductCostImpact(product, companyId);
    const forecast = forecastMarginTrend(product, costImpact, months);
    const out = { product, cost_impact: costImpact, ...forecast };
    pricingCache.set(cacheKey, out);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pricing/simulate — simulate arbitrary price/cost change
router.post('/simulate', async (req, res) => {
  const { company_id, product_id, override_price, override_cost_increase_pct } = req.body;
  if (!company_id || !product_id) return res.status(400).json({ error: 'company_id and product_id required' });

  const product = pricingDb.getProduct(company_id, product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    const costImpact = await getProductCostImpact(product, company_id);
    const overriddenImpact = override_cost_increase_pct !== undefined
      ? { ...costImpact, product_cost_increase_pct: override_cost_increase_pct }
      : costImpact;
    const overriddenProduct = override_price !== undefined
      ? { ...product, current_selling_price: override_price }
      : product;
    const result = calculateRequiredPriceIncrease(overriddenProduct, overriddenImpact);
    res.json({ product: overriddenProduct, cost_impact: overriddenImpact, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
