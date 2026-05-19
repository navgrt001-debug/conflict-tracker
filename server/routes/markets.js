const express = require('express');
const axios = require('axios');
const router = express.Router();

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FX_BASE = 'https://open.er-api.com/v6/latest/USD';

async function fetchQuote(symbol) {
  try {
    const { data } = await axios.get(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`, {
      params: { interval: '1d', range: '5d' },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000,
    });
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const timestamps = result.timestamp || [];
    return {
      symbol,
      name: meta.shortName || symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      currency: meta.currency,
      history: timestamps.map((t, i) => ({
        date: new Date(t * 1000).toLocaleDateString(),
        close: closes[i],
      })).filter(d => d.close != null),
    };
  } catch {
    return null;
  }
}

router.get('/', async (req, res) => {
  const symbols = (req.query.symbols || '^GSPC,CL=F,GC=F,ZW=F,^VIX').split(',');

  try {
    const [fxData, ...quotes] = await Promise.all([
      axios.get(FX_BASE, { timeout: 8000 }).then(r => r.data).catch(() => null),
      ...symbols.map(s => fetchQuote(s)),
    ]);

    res.json({
      fx: fxData?.rates || {},
      quotes: quotes.filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fx', async (req, res) => {
  try {
    const { data } = await axios.get(FX_BASE, { timeout: 8000 });
    res.json(data.rates || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
