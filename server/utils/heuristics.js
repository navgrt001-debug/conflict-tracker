function computeConflictSeverity(conflict) {
  const base = conflict.intensity * 10;

  const startYear = new Date(conflict.startDate).getFullYear();
  const years = new Date().getFullYear() - startYear;
  const durationScore = Math.min(years * 3, 20);

  const spreadScore = conflict.parties.length >= 5 ? 15 : conflict.parties.length >= 3 ? 10 : 5;

  const strategicTags = ['nuclear risk', 'nuclear', 'semiconductors', 'oil', 'LNG', 'NATO', 'CPEC'];
  const strategicScore = conflict.tags.filter(t => strategicTags.includes(t)).length * 5;

  const raw = base + durationScore + spreadScore + Math.min(strategicScore, 15);
  return Math.min(Math.round(raw), 100);
}

function computeEconomicImpact(conflict, fxData) {
  let score = 0;

  const impactMap = { critical: 70, high: 50, 'high potential': 45, 'potential catastrophic': 80, 'critical (LNG)': 65, moderate: 30 };
  score += impactMap[conflict.economicImpact] || 30;

  if (fxData && fxData.rates) {
    const fxDepreciation = conflict.currencyCodes.reduce((acc, code) => {
      const rate = fxData.rates[code];
      if (!rate) return acc;
      // Very rough proxy: if we had historical data we'd compare. Use rate magnitude as signal.
      return acc + 5;
    }, 0);
    score += Math.min(fxDepreciation, 15);
  }

  const commodityTags = ['oil', 'LNG', 'natural gas', 'wheat', 'gold', 'semiconductors', 'cobalt', 'coltan'];
  const commodityScore = conflict.commodities.filter(c =>
    commodityTags.some(t => c.toLowerCase().includes(t.toLowerCase()))
  ).length * 3;
  score += Math.min(commodityScore, 15);

  return Math.min(Math.round(score), 100);
}

function computeEscalationRisk(conflict) {
  let score = 0;

  score += conflict.intensity * 5;

  if (conflict.tags.includes('nuclear risk') || conflict.tags.includes('nuclear')) score += 25;
  if (conflict.tags.includes('NATO')) score += 15;
  if (conflict.tags.includes('proxy war')) score += 15;
  if (conflict.tags.includes('regional escalation')) score += 10;
  if (conflict.status === 'Tense') score += 10;

  const partyCount = conflict.parties.length;
  score += Math.min(partyCount * 5, 20);

  return Math.min(Math.round(score), 100);
}

function computeAll(conflict, fxData) {
  const severity = computeConflictSeverity(conflict);
  const economic = computeEconomicImpact(conflict, fxData);
  const escalation = computeEscalationRisk(conflict);
  const combined = Math.round(severity * 0.4 + economic * 0.3 + escalation * 0.3);

  return {
    severity,
    economic,
    escalation,
    combined,
    label: combined >= 80 ? 'Critical' : combined >= 60 ? 'High' : combined >= 40 ? 'Elevated' : 'Moderate',
  };
}

module.exports = { computeAll, computeConflictSeverity, computeEconomicImpact, computeEscalationRisk };
