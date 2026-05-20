const { getEvents } = require('./dataFeed');

// ISO3 → keywords that appear in news headlines for that country
const ISO3_KEYWORDS = {
  AFG: ['Afghanistan', 'Afghan', 'Kabul'],
  AGO: ['Angola', 'Angolan'],
  ARG: ['Argentina', 'Argentine', 'Buenos Aires'],
  ARM: ['Armenia', 'Armenian', 'Yerevan'],
  AUS: ['Australia', 'Australian'],
  AZE: ['Azerbaijan', 'Azerbaijani', 'Baku'],
  BGD: ['Bangladesh'],
  BRA: ['Brazil', 'Brazilian'],
  BFA: ['Burkina Faso'],
  CAF: ['Central African Republic', 'CAR '],
  CAN: ['Canada', 'Canadian'],
  TCD: ['Chad'],
  CHL: ['Chile', 'Chilean'],
  CHN: ['China', 'Chinese', 'Beijing', 'PRC'],
  COL: ['Colombia', 'Colombian'],
  COD: ['Congo', 'DRC', 'Kinshasa'],
  EGY: ['Egypt', 'Egyptian'],
  ETH: ['Ethiopia', 'Ethiopian'],
  FRA: ['France', 'French', 'Paris'],
  DEU: ['Germany', 'German'],
  GEO: ['Georgia', 'Georgian'],
  GBR: ['United Kingdom', 'Britain', 'British', 'UK '],
  HTI: ['Haiti', 'Haitian'],
  HND: ['Honduras'],
  IDN: ['Indonesia', 'Indonesian'],
  IND: ['India', 'Indian', 'New Delhi'],
  IRN: ['Iran', 'Iranian', 'Tehran'],
  IRQ: ['Iraq', 'Iraqi', 'Baghdad'],
  ISR: ['Israel', 'Israeli', 'Jerusalem', 'Tel Aviv'],
  JPN: ['Japan', 'Japanese', 'Tokyo'],
  KAZ: ['Kazakhstan', 'Kazakh'],
  KEN: ['Kenya', 'Kenyan', 'Nairobi'],
  PRK: ['North Korea', 'DPRK', 'Pyongyang', 'Kim Jong'],
  KOR: ['South Korea', 'Korean'],
  LBN: ['Lebanon', 'Lebanese', 'Beirut'],
  LBY: ['Libya', 'Libyan', 'Tripoli'],
  MLI: ['Mali', 'Malian'],
  MAR: ['Morocco', 'Moroccan'],
  MEX: ['Mexico', 'Mexican'],
  MDA: ['Moldova', 'Moldovan'],
  MOZ: ['Mozambique'],
  MMR: ['Myanmar', 'Burma', 'Burmese', 'Yangon'],
  NER: ['Niger', 'Nigerien'],
  NGA: ['Nigeria', 'Nigerian', 'Lagos', 'Abuja'],
  NPL: ['Nepal'],
  NZL: ['New Zealand'],
  PAK: ['Pakistan', 'Pakistani', 'Islamabad'],
  PER: ['Peru', 'Peruvian'],
  PHL: ['Philippines', 'Filipino', 'Philippine', 'Manila'],
  PSE: ['Gaza', 'Palestine', 'Palestinian', 'West Bank', 'Hamas', 'Rafah'],
  POL: ['Poland', 'Polish'],
  RUS: ['Russia', 'Russian', 'Moscow', 'Kremlin', 'Putin'],
  SAU: ['Saudi Arabia', 'Saudi', 'Riyadh'],
  SDN: ['Sudan', 'Sudanese', 'Khartoum'],
  SOM: ['Somalia', 'Somali', 'Mogadishu'],
  ZAF: ['South Africa'],
  SSD: ['South Sudan', 'Juba'],
  SYR: ['Syria', 'Syrian', 'Damascus', 'Assad'],
  TWN: ['Taiwan', 'Taiwanese', 'Taipei'],
  TJK: ['Tajikistan'],
  THA: ['Thailand', 'Thai', 'Bangkok'],
  TUR: ['Turkey', 'Turkish', 'Ankara', 'Erdogan', 'Türkiye'],
  TKM: ['Turkmenistan'],
  UGA: ['Uganda', 'Ugandan'],
  UKR: ['Ukraine', 'Ukrainian', 'Kyiv', 'Zelensky', 'Kharkiv', 'Donbas'],
  USA: ['United States', 'American', 'Washington', 'Pentagon', 'US military'],
  UZB: ['Uzbekistan'],
  VEN: ['Venezuela', 'Venezuelan', 'Maduro'],
  VNM: ['Vietnam', 'Vietnamese'],
  YEM: ['Yemen', 'Yemeni', 'Houthi', 'Sanaa'],
};

// ISO3 → ISO2 for flag emojis
const ISO3_TO_ISO2 = {
  AFG:'AF',AGO:'AO',ARG:'AR',ARM:'AM',AUS:'AU',AZE:'AZ',BGD:'BD',BRA:'BR',BFA:'BF',
  CAF:'CF',CAN:'CA',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COD:'CD',EGY:'EG',ETH:'ET',
  FRA:'FR',DEU:'DE',GEO:'GE',GBR:'GB',HTI:'HT',HND:'HN',IDN:'ID',IND:'IN',IRN:'IR',
  IRQ:'IQ',ISR:'IL',JPN:'JP',KAZ:'KZ',KEN:'KE',PRK:'KP',KOR:'KR',LBN:'LB',LBY:'LY',
  MLI:'ML',MAR:'MA',MEX:'MX',MDA:'MD',MOZ:'MZ',MMR:'MM',NER:'NE',NGA:'NG',NPL:'NP',
  NZL:'NZ',PAK:'PK',PER:'PE',PHL:'PH',PSE:'PS',POL:'PL',RUS:'RU',SAU:'SA',SDN:'SD',
  SOM:'SO',ZAF:'ZA',SSD:'SS',SYR:'SY',TWN:'TW',TJK:'TJ',THA:'TH',TUR:'TR',TKM:'TM',
  UGA:'UG',UKR:'UA',USA:'US',UZB:'UZ',VEN:'VE',VNM:'VN',YEM:'YE',
  SGP:'SG',MYS:'MY',KHM:'KH',LAO:'LA',MNG:'MN',LKA:'LK',
  CUB:'CU',ECU:'EC',BOL:'BO',PRY:'PY',URY:'UY',GTM:'GT',CRI:'CR',
  NLD:'NL',BEL:'BE',ESP:'ES',ITA:'IT',PRT:'PT',SWE:'SE',NOR:'NO',DNK:'DK',FIN:'FI',
  CHE:'CH',AUT:'AT',CZE:'CZ',HUN:'HU',ROU:'RO',BGR:'BG',GRC:'GR',SRB:'RS',HRV:'HR',
  TZA:'TZ',ZWE:'ZW',ZMB:'ZM',CMR:'CM',GHA:'GH',SEN:'SN',CIV:'CI',TUN:'TN',DZA:'DZ',
  LBR:'LR',SLE:'SL',GNB:'GW',MRT:'MR',
};

function scoreCountryRisk(iso3, conflictEvents) {
  const code = iso3.toUpperCase();
  const keywords = ISO3_KEYWORDS[code];
  if (!keywords || keywords.length === 0) {
    return { iso3: code, risk_score: 0, event_count: 0, trend: 'stable', top_events: [] };
  }

  const events = conflictEvents || getEvents();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const relevant = events.filter(e => {
    const text = `${e.title} ${e.summary || ''} ${e.sourcecountry || ''}`;
    return keywords.some(kw => text.includes(kw)) && new Date(e.seendate) >= thirtyDaysAgo;
  });

  if (relevant.length === 0) {
    return { iso3: code, risk_score: 0, event_count: 0, trend: 'stable', top_events: [] };
  }

  // Event count component (0–100): 10 events ≈ 100
  const countScore = Math.min(relevant.length * 10, 100);

  // Severity component (0–100): severity is 3–10
  const avgSeverity = relevant.reduce((s, e) => s + (e.severity || 5), 0) / relevant.length;
  const severityScore = ((avgSeverity - 3) / 7) * 100;

  // Trend: recent 7 days vs prior 23 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = relevant.filter(e => new Date(e.seendate) >= sevenDaysAgo);
  const older = relevant.filter(e => new Date(e.seendate) < sevenDaysAgo);
  const recentRate = recent.length / 7;
  const olderRate = older.length > 0 ? older.length / 23 : recentRate;
  let trend = 'stable';
  if (recentRate > olderRate * 1.3) trend = 'increasing';
  else if (recentRate < olderRate * 0.7 && olderRate > 0) trend = 'decreasing';

  const trendMult = trend === 'increasing' ? 1.2 : trend === 'decreasing' ? 0.8 : 1.0;

  const raw = (countScore * 0.3 + severityScore * 0.4) * trendMult;
  const risk_score = Math.min(Math.max(Math.round(raw), 0), 100);

  return {
    iso3: code,
    iso2: ISO3_TO_ISO2[code] || null,
    risk_score,
    event_count: relevant.length,
    trend,
    top_events: relevant.slice(0, 3).map(e => ({
      title: e.title,
      severity: e.severity,
      date: e.seendate,
      url: e.url,
    })),
  };
}

function scoreSupplyRouteRisk(sourceIso3, destinationIso3) {
  const events = getEvents();
  const src = scoreCountryRisk(sourceIso3, events);
  const dst = scoreCountryRisk(destinationIso3, events);
  return {
    source: sourceIso3,
    destination: destinationIso3,
    route_risk_score: Math.round((src.risk_score + dst.risk_score) / 2),
    source_risk: src,
    destination_risk: dst,
  };
}

module.exports = { scoreCountryRisk, scoreSupplyRouteRisk, ISO3_KEYWORDS, ISO3_TO_ISO2 };
