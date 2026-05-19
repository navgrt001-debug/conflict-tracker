const express = require('express');
const axios = require('axios');
const router = express.Router();

const WB_BASE = 'https://api.worldbank.org/v2';

async function fetchWorldBank(countryCode, indicators) {
  const results = {};
  await Promise.all(
    Object.entries(indicators).map(async ([key, indicator]) => {
      try {
        const { data } = await axios.get(
          `${WB_BASE}/country/${countryCode}/indicator/${indicator}`,
          { params: { format: 'json', mrv: 5, per_page: 5 }, timeout: 10000 }
        );
        const series = data?.[1]?.filter(d => d.value != null) || [];
        results[key] = series.map(d => ({ year: d.date, value: d.value }));
      } catch {
        results[key] = [];
      }
    })
  );
  return results;
}

router.get('/:countryCode', async (req, res) => {
  const { countryCode } = req.params;

  const indicators = {
    gdp: 'NY.GDP.MKTP.CD',
    gdpGrowth: 'NY.GDP.MKTP.KD.ZG',
    exports: 'NE.EXP.GNFS.CD',
    imports: 'NE.IMP.GNFS.CD',
    inflation: 'FP.CPI.TOTL.ZG',
    fdi: 'BX.KLT.DINV.CD.WD',
    tradeBalance: 'BN.CAB.XOKA.CD',
  };

  try {
    const data = await fetchWorldBank(countryCode, indicators);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
