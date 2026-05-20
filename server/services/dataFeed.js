const axios = require('axios');
const NodeCache = require('node-cache');
const cron = require('node-cron');
const Parser = require('rss-parser');

const cache = new NodeCache({ stdTTL: 900 });
const rss = new Parser({ timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });

const COMMODITY_SYMBOLS = {
  'CL=F': 'WTI Crude Oil',
  'BZ=F': 'Brent Crude',
  'GC=F': 'Gold',
  'ZW=F': 'Wheat',
  'NG=F': 'Natural Gas',
};

const FX_WANT = ['TRY', 'ZAR', 'BRL', 'NGN', 'EGP', 'EUR', 'GBP', 'JPY'];

// Free RSS feeds — no API key needed
const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',         source: 'BBC News' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',           source: 'Al Jazeera' },
  { url: 'https://rss.dw.com/rdf/rss-en-world',                 source: 'DW News' },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml',       source: 'Sky News' },
];

const CONFLICT_KEYWORDS = [
  'war', 'attack', 'killed', 'airstrike', 'missile', 'troops', 'military',
  'conflict', 'sanctions', 'offensive', 'fighting', 'bombs', 'ceasefire',
  'invasion', 'rebel', 'coup', 'protest', 'crisis', 'tension', 'strike',
  'nuclear', 'refugee', 'displaced', 'occupation', 'siege', 'blockade',
];

function isRelevant(title = '', summary = '') {
  const text = (title + ' ' + summary).toLowerCase();
  return CONFLICT_KEYWORDS.some(kw => text.includes(kw));
}

function severityFromTitle(title = '') {
  const t = title.toLowerCase();
  if (/killed|bombing|airstrike|massacre|invasion|explo/.test(t)) return Math.floor(Math.random() * 2) + 8;
  if (/conflict|sanctions|missile|troops|offensive|fighting|coup/.test(t)) return Math.floor(Math.random() * 2) + 6;
  if (/tensions|protest|dispute|crisis|emergency|strike/.test(t)) return Math.floor(Math.random() * 2) + 4;
  return Math.floor(Math.random() * 2) + 3;
}

function stableId(url) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  return `feed-${Math.abs(h)}`;
}

function extractCountry(title = '', feedSource = '') {
  const COUNTRIES = ['Ukraine', 'Russia', 'Israel', 'Gaza', 'Sudan', 'Myanmar', 'Iran', 'China',
    'Taiwan', 'Syria', 'Yemen', 'Somalia', 'Ethiopia', 'Mali', 'Niger', 'Pakistan',
    'India', 'Haiti', 'Mexico', 'Colombia', 'Congo', 'DRC', 'Nigeria', 'Lebanon'];
  const found = COUNTRIES.find(c => title.includes(c));
  return found || feedSource;
}

async function fetchOneFeed(feed) {
  try {
    const parsed = await rss.parseURL(feed.url);
    return (parsed.items || [])
      .filter(item => isRelevant(item.title, item.contentSnippet))
      .slice(0, 10)
      .map(item => ({
        id: stableId(item.link || item.title),
        title: item.title || 'Untitled',
        url: item.link || '',
        domain: feed.source,
        sourcecountry: extractCountry(item.title, feed.source),
        seendate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        severity: severityFromTitle(item.title),
        summary: item.contentSnippet?.slice(0, 200) || '',
      }));
  } catch (err) {
    console.error(`[dataFeed] RSS error (${feed.source}):`, err.message);
    return [];
  }
}

async function fetchNews() {
  try {
    const results = await Promise.all(RSS_FEEDS.map(fetchOneFeed));
    const all = results.flat();

    // Deduplicate by id, sort by severity desc then date desc
    const seen = new Set();
    const unique = all
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => b.severity - a.severity || new Date(b.seendate) - new Date(a.seendate))
      .slice(0, 30);

    if (unique.length > 0) {
      cache.set('news_events', unique);
      console.log(`[dataFeed] Fetched ${unique.length} news events from RSS`);
    }
    return unique;
  } catch (err) {
    console.error('[dataFeed] News fetch error:', err.message);
    return cache.get('news_events') || [];
  }
}

async function fetchOneSymbol(symbol) {
  try {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { params: { interval: '1h', range: '5d' }, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    );
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const timestamps = result.timestamp || [];
    const sparkline = timestamps.map((t, i) => closes[i]).filter(v => v != null).slice(-24);
    return {
      symbol,
      name: COMMODITY_SYMBOLS[symbol] || meta.shortName || symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      currency: meta.currency || 'USD',
      sparkline,
      type: 'commodity',
    };
  } catch {
    return null;
  }
}

async function fetchPrices() {
  try {
    const [fxData, ...commodities] = await Promise.all([
      axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 })
        .then(r => r.data).catch(() => null),
      ...Object.keys(COMMODITY_SYMBOLS).map(fetchOneSymbol),
    ]);

    const fx = fxData?.rates
      ? Object.entries(fxData.rates).filter(([code]) => FX_WANT.includes(code)).map(([code, rate]) => {
          const prev = cache.get(`fx_prev_${code}`);
          const changePct = prev ? ((rate - prev) / prev) * 100 : 0;
          if (!prev) cache.set(`fx_prev_${code}`, rate, 86400);
          return { symbol: code, name: `USD/${code}`, price: rate, changePct, change: prev ? rate - prev : 0, type: 'fx', sparkline: [] };
        })
      : [];

    const prices = { commodities: commodities.filter(Boolean), fx, updatedAt: new Date().toISOString() };
    cache.set('prices', prices);
    console.log(`[dataFeed] Prices updated — ${prices.commodities.length} commodities, ${prices.fx.length} FX`);
    return prices;
  } catch (err) {
    console.error('[dataFeed] Prices error:', err.message);
    return cache.get('prices') || { commodities: [], fx: [], updatedAt: null };
  }
}

async function refresh() {
  await Promise.all([fetchNews(), fetchPrices()]);
}

function startScheduler() {
  refresh();
  cron.schedule('*/15 * * * *', refresh);
}

function getEvents() { return cache.get('news_events') || []; }
function getPrices() { return cache.get('prices') || { commodities: [], fx: [], updatedAt: null }; }
function getSummary() { return { events: getEvents(), prices: getPrices() }; }
function setChainCache(id, chain) { cache.set(`chain_${id}`, chain, 3600); }
function getChainCache(id) { return cache.get(`chain_${id}`) || null; }

module.exports = { startScheduler, getEvents, getPrices, getSummary, setChainCache, getChainCache };
