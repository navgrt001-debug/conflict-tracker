const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'pricingProfiles.json'));
const db = low(adapter);
db.defaults({ profiles: [] }).write();

function normalizeMarket(m) {
  return {
    region: m.region || '',
    price_sensitivity: m.price_sensitivity || 'medium',
    current_price: Number(m.current_price) || 0,
    currency: m.currency || 'USD',
    competitor_prices: (m.competitor_prices || []).map(Number).filter(Boolean),
  };
}

function normalizeProduct(p) {
  return {
    id: p.id || uuid(),
    name: p.name || '',
    sku: p.sku || '',
    current_selling_price: Number(p.current_selling_price) || 0,
    currency: p.currency || 'USD',
    monthly_units: Number(p.monthly_units) || 1000,
    target_margin_pct: Number(p.target_margin_pct) || 30,
    minimum_margin_pct: Number(p.minimum_margin_pct) || 15,
    current_margin_pct: Number(p.current_margin_pct) || 25,
    raw_material_cost_pct: Number(p.raw_material_cost_pct) || 50,
    markets: (p.markets || []).map(normalizeMarket),
    linked_materials: p.linked_materials || [],
    created_at: p.created_at || new Date().toISOString(),
  };
}

function getProfile(companyId) {
  return db.get('profiles').find({ company_id: companyId }).value() || null;
}

function getOrCreateProfile(companyId) {
  let profile = getProfile(companyId);
  if (!profile) {
    profile = { company_id: companyId, products: [], created_at: new Date().toISOString() };
    db.get('profiles').push(profile).write();
  }
  return profile;
}

function getProducts(companyId) {
  const profile = getProfile(companyId);
  return profile ? profile.products : [];
}

function getProduct(companyId, productId) {
  const profile = getProfile(companyId);
  if (!profile) return null;
  return (profile.products || []).find(p => p.id === productId) || null;
}

function addProduct(companyId, productData) {
  getOrCreateProfile(companyId);
  const product = normalizeProduct(productData);
  db.get('profiles').find({ company_id: companyId }).get('products').push(product).write();
  return product;
}

function updateProduct(companyId, productId, updates) {
  const profile = getProfile(companyId);
  if (!profile) return null;
  const existing = (profile.products || []).find(p => p.id === productId);
  if (!existing) return null;
  const updated = normalizeProduct({ ...existing, ...updates, id: productId, created_at: existing.created_at });
  db.get('profiles').find({ company_id: companyId })
    .get('products').find({ id: productId }).assign(updated).write();
  return updated;
}

function deleteProduct(companyId, productId) {
  db.get('profiles').find({ company_id: companyId })
    .get('products').remove({ id: productId }).write();
}

module.exports = { getProfile, getOrCreateProfile, getProducts, getProduct, addProduct, updateProduct, deleteProduct };
