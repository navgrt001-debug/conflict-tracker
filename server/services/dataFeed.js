const axios = require('axios');
const NodeCache = require('node-cache');
const cron = require('node-cron');
const Parser = require('rss-parser');

const cache = new NodeCache({ stdTTL: 300 }); // 5-min TTL (was 15)
const rss = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ConflictTracker/1.0; +https://github.com)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// Batch-fetched every 5 min — covers major commodities across all categories
const COMMODITY_SYMBOLS = {
  // Energy
  'CL=F':    'WTI Crude Oil',
  'BZ=F':    'Brent Crude',
  'NG=F':    'Natural Gas',
  'HO=F':    'Heating Oil',
  'RB=F':    'Gasoline RBOB',
  // Metals – precious
  'GC=F':    'Gold',
  'SI=F':    'Silver',
  'PA=F':    'Palladium',
  'PL=F':    'Platinum',
  // Metals – industrial
  'HG=F':    'Copper',
  'ALI=F':   'Aluminum',
  // Grains & oilseeds
  'ZW=F':    'Wheat',
  'ZC=F':    'Corn',
  'ZS=F':    'Soybeans',
  'ZM=F':    'Soybean Meal',
  'ZL=F':    'Soybean Oil',
  'ZO=F':    'Oats',
  'ZR=F':    'Rough Rice',
  // Softs
  'CC=F':    'Cocoa',
  'KC=F':    'Coffee',
  'CT=F':    'Cotton',
  'SB=F':    'Sugar',
  'OJ=F':    'Orange Juice',
  // Livestock
  'LE=F':    'Live Cattle',
  'GF=F':    'Feeder Cattle',
  'HE=F':    'Lean Hogs',
  // Crypto
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'BNB-USD': 'BNB',
  'XRP-USD': 'XRP',
};

const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',              source: 'BBC News' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',                source: 'Al Jazeera' },
  { url: 'https://rss.dw.com/rdf/rss-en-world',                      source: 'DW News' },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml',            source: 'Sky News' },
  { url: 'https://www.theguardian.com/world/rss',                    source: 'The Guardian' },
  { url: 'https://feeds.reuters.com/reuters/worldNews',              source: 'Reuters' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',   source: 'NY Times' },
];

const CONFLICT_KEYWORDS = [
  'war', 'attack', 'killed', 'airstrike', 'missile', 'troops', 'military',
  'conflict', 'sanctions', 'offensive', 'fighting', 'bombs', 'ceasefire',
  'invasion', 'rebel', 'coup', 'protest', 'crisis', 'tension', 'strike',
  'nuclear', 'refugee', 'displaced', 'occupation', 'siege', 'blockade',
  'drone', 'artillery', 'casualty', 'casualties', 'combat', 'assault',
  'explosion', 'shoot', 'gunfire', 'shelling', 'violence', 'unrest',
];

function isRelevant(title = '', summary = '') {
  const text = (title + ' ' + summary).toLowerCase();
  return CONFLICT_KEYWORDS.some(kw => text.includes(kw));
}

function severityFromTitle(title = '') {
  const t = title.toLowerCase();
  if (/killed|bombing|airstrike|massacre|invasion|explo|casualt|combat/.test(t)) return 8 + (Math.random() > 0.5 ? 1 : 0);
  if (/conflict|sanctions|missile|troops|offensive|fighting|coup|drone|shelling/.test(t)) return 6 + (Math.random() > 0.5 ? 1 : 0);
  if (/tensions|protest|dispute|crisis|emergency|strike|violence|unrest/.test(t)) return 4 + (Math.random() > 0.5 ? 1 : 0);
  return 3 + (Math.random() > 0.5 ? 1 : 0);
}

function stableId(url) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  return `feed-${Math.abs(h)}`;
}

function extractCountry(title = '', feedSource = '') {
  const COUNTRIES = [
    'Ukraine', 'Russia', 'Israel', 'Gaza', 'Sudan', 'Myanmar', 'Iran', 'China',
    'Taiwan', 'Syria', 'Yemen', 'Somalia', 'Ethiopia', 'Mali', 'Niger', 'Pakistan',
    'India', 'Haiti', 'Mexico', 'Colombia', 'Congo', 'DRC', 'Nigeria', 'Lebanon',
    'Libya', 'Afghanistan', 'Iraq', 'Kosovo', 'Armenia', 'Azerbaijan', 'Venezuela',
  ];
  const found = COUNTRIES.find(c => title.includes(c));
  return found || feedSource;
}

async function fetchOneFeed(feed) {
  try {
    const parsed = await rss.parseURL(feed.url);
    return (parsed.items || [])
      .filter(item => isRelevant(item.title, item.contentSnippet))
      .slice(0, 12)
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

    const seen = new Set();
    const unique = all
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => {
        // Sort by date first (most recent first), then severity
        const dateDiff = new Date(b.seendate) - new Date(a.seendate);
        if (Math.abs(dateDiff) > 3600000) return dateDiff; // >1h apart → use date
        return b.severity - a.severity;
      })
      .slice(0, 40);

    if (unique.length > 0) {
      cache.set('news_events', unique);
      cache.set('news_updated_at', new Date().toISOString());
      console.log(`[dataFeed] Fetched ${unique.length} events from ${results.filter(r => r.length > 0).length}/${RSS_FEEDS.length} feeds`);
    } else {
      console.warn('[dataFeed] All RSS feeds returned 0 relevant events — keeping cached data');
    }
    return unique.length > 0 ? unique : (cache.get('news_events') || []);
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

    // Return ALL available currency rates — client filters to user selection
    const fx = fxData?.rates
      ? Object.entries(fxData.rates).map(([code, rate]) => {
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
  cron.schedule('*/5 * * * *', refresh); // every 5 min (was 15)
}

function getEvents() { return cache.get('news_events') || []; }
function getPrices() { return cache.get('prices') || { commodities: [], fx: [], updatedAt: null }; }
function getNewsUpdatedAt() { return cache.get('news_updated_at') || null; }
function getSummary() { return { events: getEvents(), prices: getPrices() }; }
function setChainCache(id, chain) { cache.set(`chain_${id}`, chain, 3600); }
function getChainCache(id) { return cache.get(`chain_${id}`) || null; }

module.exports = { startScheduler, getEvents, getPrices, getNewsUpdatedAt, getSummary, setChainCache, getChainCache, refresh, fetchOneSymbol };
