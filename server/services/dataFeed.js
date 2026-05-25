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

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

// Batch-fetch ALL commodity symbols in a single request (avoids rate-limiting)
async function fetchAllCommodities() {
  const symbols = Object.keys(COMMODITY_SYMBOLS).join(',');
  const urls = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US`,
  ];

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { headers: YF_HEADERS, timeout: 15000 });
      const quotes = data?.quoteResponse?.result || [];
      if (!quotes.length) continue;

      const results = quotes
        .filter(q => q.regularMarketPrice != null)
        .map(q => ({
          symbol: q.symbol,
          name: COMMODITY_SYMBOLS[q.symbol] || q.shortName || q.symbol,
          price: q.regularMarketPrice,
          previousClose: q.regularMarketPreviousClose,
          change: q.regularMarketChange ?? 0,
          changePct: q.regularMarketChangePercent ?? 0,
          currency: q.currency || 'USD',
          sparkline: [],
          type: 'commodity',
        }));

      if (results.length > 0) {
        console.log(`[dataFeed] Commodities batch: ${results.length}/${Object.keys(COMMODITY_SYMBOLS).length} symbols`);
        cache.set('commodities_cache', results);
        return results;
      }
    } catch (err) {
      console.warn(`[dataFeed] Commodity batch failed (${url.includes('query2') ? 'q2' : 'q1'}):`, err.message);
    }
  }

  // Fall back to last good data
  const fallback = cache.get('commodities_cache') || [];
  console.warn(`[dataFeed] Using cached commodity data (${fallback.length} items)`);
  return fallback;
}

// Single-symbol lookup for on-demand user requests
async function fetchOneSymbol(symbol) {
  // Check batch cache first
  const batch = cache.get('commodities_cache') || [];
  const cached = batch.find(c => c.symbol === symbol);
  if (cached) return cached;

  const urls = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&lang=en-US`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&lang=en-US`,
  ];

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { headers: YF_HEADERS, timeout: 10000 });
      const q = data?.quoteResponse?.result?.[0];
      if (!q || q.regularMarketPrice == null) continue;
      return {
        symbol: q.symbol,
        name: COMMODITY_SYMBOLS[q.symbol] || q.shortName || q.symbol,
        price: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose,
        change: q.regularMarketChange ?? 0,
        changePct: q.regularMarketChangePercent ?? 0,
        currency: q.currency || 'USD',
        sparkline: [],
        type: 'commodity',
      };
    } catch { /* try next */ }
  }
  return null;
}

// Fetch yesterday's FX rates from Frankfurter (free, no key, ~33 major currencies).
// Used as daily-change baseline so changePct reflects real 24-hour movement.
async function fetchFXBaseline() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  // Skip weekends — forex markets are closed; walk back to Friday
  const dow = yesterday.getDay();
  if (dow === 0) yesterday.setDate(yesterday.getDate() - 2); // Sun → Fri
  if (dow === 6) yesterday.setDate(yesterday.getDate() - 1); // Sat → Fri
  const dateStr = yesterday.toISOString().split('T')[0];
  try {
    const { data } = await axios.get(
      `https://api.frankfurter.app/${dateStr}?from=USD`,
      { timeout: 10000 }
    );
    if (data?.rates) {
      cache.set('fx_baseline', data.rates, 90000); // ~25h TTL, refresh daily
      console.log(`[dataFeed] FX baseline loaded (${dateStr}): ${Object.keys(data.rates).length} currencies`);
    }
  } catch (err) {
    console.warn('[dataFeed] FX baseline fetch failed:', err.message);
  }
}

async function fetchPrices() {
  try {
    const [fxData, commodities] = await Promise.all([
      axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 })
        .then(r => r.data).catch(() => null),
      fetchAllCommodities(),
    ]);

    // baseline = yesterday's rates for daily % change; fallback to open.er prev_close
    const baseline = cache.get('fx_baseline') || {};

    const fx = fxData?.rates
      ? Object.entries(fxData.rates).map(([code, rate]) => {
          const prevRate = baseline[code];
          const changePct = prevRate ? ((rate - prevRate) / prevRate) * 100 : 0;
          const change    = prevRate ? rate - prevRate : 0;
          return { symbol: code, name: `USD/${code}`, price: rate, changePct, change, type: 'fx', sparkline: [] };
        })
      : [];

    const prices = { commodities, fx, updatedAt: new Date().toISOString() };
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
  // Load yesterday's FX rates immediately, then refresh every 24h at midnight
  fetchFXBaseline();
  cron.schedule('1 0 * * *', fetchFXBaseline); // 00:01 UTC daily

  refresh();
  cron.schedule('*/5 * * * *', refresh);
}

function getEvents() { return cache.get('news_events') || []; }
function getPrices() { return cache.get('prices') || { commodities: [], fx: [], updatedAt: null }; }
function getNewsUpdatedAt() { return cache.get('news_updated_at') || null; }
function getSummary() { return { events: getEvents(), prices: getPrices() }; }
function setChainCache(id, chain) { cache.set(`chain_${id}`, chain, 3600); }
function getChainCache(id) { return cache.get(`chain_${id}`) || null; }

module.exports = { startScheduler, getEvents, getPrices, getNewsUpdatedAt, getSummary, setChainCache, getChainCache, refresh, fetchOneSymbol };
