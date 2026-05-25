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

// ── Stooq symbol mapping (Yahoo Finance → Stooq) ──────────────────────────
const STOOQ_MAP = {
  'CL=F': 'cl.f', 'BZ=F': 'bz.f', 'GC=F': 'gc.f', 'SI=F': 'si.f',
  'HG=F': 'hg.f', 'PA=F': 'pa.f', 'PL=F': 'pl.f', 'ALI=F': 'ali.f',
  'NG=F': 'ng.f', 'HO=F': 'ho.f', 'RB=F': 'rb.f',
  'ZW=F': 'zw.f', 'ZC=F': 'zc.f', 'ZS=F': 'zs.f',
  'ZM=F': 'zm.f', 'ZL=F': 'zl.f', 'ZO=F': 'zo.f', 'ZR=F': 'zr.f',
  'CC=F': 'cc.f', 'KC=F': 'kc.f', 'CT=F': 'ct.f', 'SB=F': 'sb.f',
  'OJ=F': 'oj.f', 'LE=F': 'le.f', 'GF=F': 'gf.f', 'HE=F': 'he.f',
};

// ── CoinGecko IDs for crypto symbols ──────────────────────────────────────
const COINGECKO_IDS = {
  'BTC-USD': 'bitcoin', 'ETH-USD': 'ethereum', 'SOL-USD': 'solana',
  'BNB-USD': 'binancecoin', 'XRP-USD': 'ripple', 'ADA-USD': 'cardano',
  'DOGE-USD': 'dogecoin', 'AVAX-USD': 'avalanche-2',
};

// Parse Stooq spot-price CSV (format: sd2t2ohlcv)
// Returns null if data is N/D or malformed
function parseStooqSpot(yahooSymbol, csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return null;
  const cols = lines[1].split(',');
  if (cols.length < 7) return null;
  const close = cols[6]?.trim();
  const open  = cols[3]?.trim();
  if (!close || close === 'N/D') return null;
  const closeNum = parseFloat(close);
  const openNum  = parseFloat(open) || closeNum;
  if (isNaN(closeNum) || closeNum === 0) return null;

  // Use open as same-day baseline for changePct
  const changePct = openNum && openNum !== closeNum ? ((closeNum - openNum) / openNum) * 100 : 0;
  return { closeNum, openNum, changePct };
}

// Parse Stooq daily-history CSV (format: Date,Open,High,Low,Close,Volume)
// Returns null if data is malformed; derives prev-close from penultimate row
function parseStooqHistory(yahooSymbol, csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  const last = lines[lines.length - 1].split(',');
  if (last.length < 5) return null;
  const closeNum = parseFloat(last[4]);
  if (isNaN(closeNum) || closeNum === 0) return null;
  let prevClose = null;
  if (lines.length >= 3) {
    const prev = lines[lines.length - 2].split(',');
    if (prev.length >= 5) prevClose = parseFloat(prev[4]) || null;
  }
  const changePct = prevClose ? ((closeNum - prevClose) / prevClose) * 100 : 0;
  return { closeNum, changePct, prevClose };
}

// Fetch one symbol from Stooq:
//   1. Try spot-price URL (real-time, fast)
//   2. If N/D or blocked → try historical URL (always has last close)
//   3. Either way → fall back to per-symbol cache if both fail
async function fetchStooqOne(yahooSymbol, attempt = 0) {
  const stooqSym = STOOQ_MAP[yahooSymbol];
  if (!stooqSym) return null;

  const perSymKey = `stooq_sym_${yahooSymbol}`;
  const cached    = cache.get(perSymKey); // long-lived per-symbol fallback

  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/csv, text/plain, */*',
    'Referer': 'https://stooq.com/',
  };

  const makeResult = (closeNum, changePct) => {
    const result = {
      symbol: yahooSymbol,
      name: COMMODITY_SYMBOLS[yahooSymbol] || yahooSymbol,
      price: closeNum,
      change: 0,
      changePct,
      type: 'commodity',
      sparkline: [],
    };
    cache.set(perSymKey, result, 86400 * 3); // keep 3 days as fallback
    return result;
  };

  try {
    // ── Attempt 1: spot price (real-time) ──
    const spotResp = await axios.get(
      `https://stooq.com/q/l/?s=${stooqSym}&f=sd2t2ohlcv&h&e=csv`,
      { timeout: 10000, headers: HEADERS }
    ).catch(() => null);

    if (spotResp?.data && typeof spotResp.data === 'string' && !spotResp.data.trimStart().startsWith('<')) {
      const parsed = parseStooqSpot(yahooSymbol, spotResp.data);
      if (parsed) return makeResult(parsed.closeNum, parsed.changePct);
    }

    // ── Attempt 2: historical daily (immune to N/D / off-hours) ──
    const histResp = await axios.get(
      `https://stooq.com/q/d/l/?s=${stooqSym}&i=d`,
      { timeout: 12000, headers: HEADERS }
    ).catch(() => null);

    if (histResp?.data && typeof histResp.data === 'string' && !histResp.data.trimStart().startsWith('<')) {
      const parsed = parseStooqHistory(yahooSymbol, histResp.data);
      if (parsed) return makeResult(parsed.closeNum, parsed.changePct);
    }

    // ── Attempt 3: retry once after a pause ──
    if (attempt === 0) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchStooqOne(yahooSymbol, 1);
    }

    // ── Final fallback: stale per-symbol cache ──
    if (cached) {
      console.warn(`[dataFeed] Stooq failed for ${stooqSym} — using stale cache`);
      return cached;
    }

    return null;
  } catch (err) {
    if (attempt === 0) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchStooqOne(yahooSymbol, 1);
    }
    console.warn(`[dataFeed] Stooq error for ${stooqSym}:`, err.message);
    return cached || null;
  }
}

// Fetch crypto prices from CoinGecko (single batch call, includes 24h change)
async function fetchCrypto() {
  const cryptoSymbols = Object.keys(COINGECKO_IDS).filter(s => COMMODITY_SYMBOLS[s]);
  if (!cryptoSymbols.length) return [];
  const ids = cryptoSymbols.map(s => COINGECKO_IDS[s]).join(',');
  try {
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { timeout: 10000 }
    );
    return cryptoSymbols.map(sym => {
      const id   = COINGECKO_IDS[sym];
      const info = data[id];
      if (!info) return null;
      return {
        symbol: sym,
        name: COMMODITY_SYMBOLS[sym] || sym,
        price: info.usd,
        changePct: info.usd_24h_change ?? 0,
        change: 0,
        type: 'commodity',
        sparkline: [],
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn('[dataFeed] CoinGecko fetch failed:', err.message);
    return [];
  }
}

// Concurrency-limited batch: run tasks max N at a time
async function batchAsync(tasks, concurrency = 3) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const chunk = await Promise.all(tasks.slice(i, i + concurrency).map(fn => fn()));
    results.push(...chunk);
    // Small delay between batches to avoid rate-limiting
    if (i + concurrency < tasks.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// Fetch all commodity + crypto prices
async function fetchAllCommodities() {
  const futuresSymbols = Object.keys(COMMODITY_SYMBOLS).filter(s => STOOQ_MAP[s]);

  const [futuresResults, cryptoResults] = await Promise.all([
    batchAsync(futuresSymbols.map(s => () => fetchStooqOne(s)), 3),
    fetchCrypto(),
  ]);

  const futures = futuresResults.filter(Boolean);
  const all = [...futures, ...cryptoResults];

  console.log(`[dataFeed] Commodities: ${all.length} total (${futures.length}/${futuresSymbols.length} futures + ${cryptoResults.length} crypto)`);

  if (all.length > 0) {
    // Store with 2h TTL so stale data survives failed refreshes
    cache.set('commodities_cache', all, 7200);
  } else {
    console.warn('[dataFeed] All commodity sources failed — returning stale cache');
  }
  return all.length > 0 ? all : (cache.get('commodities_cache') || []);
}

// On-demand lookup for user-added custom symbols
async function fetchOneSymbol(symbol) {
  // Check commodity cache first
  const batch = cache.get('commodities_cache') || [];
  const hit = batch.find(c => c.symbol === symbol);
  if (hit) return hit;

  // Try Stooq
  const stooqResult = await fetchStooqOne(symbol);
  if (stooqResult) return stooqResult;

  // Try CoinGecko for crypto
  const cgId = COINGECKO_IDS[symbol];
  if (cgId) {
    try {
      const { data } = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`,
        { timeout: 8000 }
      );
      if (data[cgId]) return {
        symbol, name: COMMODITY_SYMBOLS[symbol] || symbol,
        price: data[cgId].usd, changePct: data[cgId].usd_24h_change ?? 0,
        change: 0, type: 'commodity', sparkline: [],
      };
    } catch { /* ignore */ }
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
    const [fxData, freshCommodities] = await Promise.all([
      axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 })
        .then(r => r.data).catch(() => null),
      fetchAllCommodities(),
    ]);

    // Merge fresh results with any stale cached entries for symbols that failed this round
    const staleCache = cache.get('commodities_cache') || [];
    const freshSymbols = new Set(freshCommodities.map(c => c.symbol));
    const missingFromStale = staleCache.filter(c => !freshSymbols.has(c.symbol));
    const commodities = [...freshCommodities, ...missingFromStale];
    if (missingFromStale.length > 0) {
      console.log(`[dataFeed] Supplemented ${missingFromStale.length} symbols from stale cache`);
    }

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
