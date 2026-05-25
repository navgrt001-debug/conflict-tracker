const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'supplyChain.json'));
const db = low(adapter);
db.defaults({ companies: [] }).write();

function createCompany({
  name, industry, base_currency = 'USD', materials = [],
  final_product, manufacturing_country, manufacturing_country_name,
  buyer_markets = [], pnl = {}, risk_tolerance = {},
}) {
  if (!name) throw new Error('name is required');
  const company = {
    id: uuid(),
    name,
    industry: industry || '',
    base_currency,
    final_product: final_product || '',
    manufacturing_country: manufacturing_country || '',
    manufacturing_country_name: manufacturing_country_name || '',
    buyer_markets: (buyer_markets || []).map(b => ({
      iso3: b.iso3 || '',
      country_name: b.country_name || '',
      percentage: Number(b.percentage) || 0,
    })),
    pnl: {
      annual_revenue: Number(pnl.annual_revenue) || 0,
      cogs_pct: Number(pnl.cogs_pct) || 0,
      opex_pct: Number(pnl.opex_pct) || 0,
    },
    risk_tolerance: {
      max_profit_drop_pct: Number(risk_tolerance.max_profit_drop_pct) || 15,
    },
    created_at: new Date().toISOString(),
    materials: materials.map(m => normalizeMaterial(m)),
  };
  db.get('companies').push(company).write();
  return company;
}

function normalizeMaterial(m) {
  return {
    id: m.id || uuid(),
    name: m.name || '',
    symbol: m.symbol || null,
    unit: m.unit || 'unit',
    monthly_volume: Number(m.monthly_volume) || 0,
    current_unit_cost: Number(m.current_unit_cost) || 0,
    source_countries: (m.source_countries || []).map(sc => ({
      iso3: sc.iso3,
      country_name: sc.country_name || sc.iso3,
      supply_percentage: Number(sc.supply_percentage) || 0,
    })),
    suppliers: (m.suppliers || []).map(s => ({
      name: s.name || '',
      country_iso3: s.country_iso3 || '',
      contract_type: s.contract_type || 'spot',
      lead_time_days: Number(s.lead_time_days) || 0,
      reliability_score: Number(s.reliability_score) || 50,
    })),
  };
}

function getCompany(id) {
  return db.get('companies').find({ id }).value() || null;
}

function getAllCompanies() {
  return db.get('companies').value();
}

function updateCompany(id, updates) {
  const company = getCompany(id);
  if (!company) return null;
  const allowed = {};
  const fields = [
    'name','industry','base_currency','final_product',
    'manufacturing_country','manufacturing_country_name',
    'buyer_markets','pnl','risk_tolerance',
  ];
  for (const f of fields) {
    if (updates[f] !== undefined) allowed[f] = updates[f];
  }
  db.get('companies').find({ id }).assign(allowed).write();
  return getCompany(id);
}

function addMaterial(companyId, materialData) {
  const company = getCompany(companyId);
  if (!company) return null;
  const material = normalizeMaterial(materialData);
  db.get('companies').find({ id: companyId }).get('materials').push(material).write();
  return material;
}

function updateMaterial(companyId, materialId, updates) {
  const company = getCompany(companyId);
  if (!company) return null;
  const material = (company.materials || []).find(m => m.id === materialId);
  if (!material) return null;
  const updated = normalizeMaterial({ ...material, ...updates, id: materialId });
  db.get('companies').find({ id: companyId })
    .get('materials').find({ id: materialId }).assign(updated).write();
  return updated;
}

function deleteMaterial(companyId, materialId) {
  db.get('companies').find({ id: companyId })
    .get('materials').remove({ id: materialId }).write();
}

function deleteCompany(id) {
  db.get('companies').remove({ id }).write();
}

module.exports = {
  createCompany, getCompany, getAllCompanies, updateCompany,
  addMaterial, updateMaterial, deleteMaterial, deleteCompany,
};
