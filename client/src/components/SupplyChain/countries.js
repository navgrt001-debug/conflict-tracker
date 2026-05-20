// ISO3, ISO2, and display name for searchable country picker + flag emojis

export const COUNTRIES = [
  {iso3:'AFG',iso2:'AF',name:'Afghanistan'},{iso3:'AGO',iso2:'AO',name:'Angola'},
  {iso3:'ARG',iso2:'AR',name:'Argentina'},{iso3:'ARM',iso2:'AM',name:'Armenia'},
  {iso3:'AUS',iso2:'AU',name:'Australia'},{iso3:'AUT',iso2:'AT',name:'Austria'},
  {iso3:'AZE',iso2:'AZ',name:'Azerbaijan'},{iso3:'BGD',iso2:'BD',name:'Bangladesh'},
  {iso3:'BEL',iso2:'BE',name:'Belgium'},{iso3:'BOL',iso2:'BO',name:'Bolivia'},
  {iso3:'BRA',iso2:'BR',name:'Brazil'},{iso3:'BFA',iso2:'BF',name:'Burkina Faso'},
  {iso3:'CAF',iso2:'CF',name:'Central African Republic'},{iso3:'CAN',iso2:'CA',name:'Canada'},
  {iso3:'TCD',iso2:'TD',name:'Chad'},{iso3:'CHL',iso2:'CL',name:'Chile'},
  {iso3:'CHN',iso2:'CN',name:'China'},{iso3:'COL',iso2:'CO',name:'Colombia'},
  {iso3:'COD',iso2:'CD',name:'Congo (DRC)'},{iso3:'CIV',iso2:'CI',name:"Côte d'Ivoire"},
  {iso3:'CRI',iso2:'CR',name:'Costa Rica'},{iso3:'CUB',iso2:'CU',name:'Cuba'},
  {iso3:'CZE',iso2:'CZ',name:'Czech Republic'},{iso3:'DNK',iso2:'DK',name:'Denmark'},
  {iso3:'ECU',iso2:'EC',name:'Ecuador'},{iso3:'EGY',iso2:'EG',name:'Egypt'},
  {iso3:'ETH',iso2:'ET',name:'Ethiopia'},{iso3:'FIN',iso2:'FI',name:'Finland'},
  {iso3:'FRA',iso2:'FR',name:'France'},{iso3:'DEU',iso2:'DE',name:'Germany'},
  {iso3:'GHA',iso2:'GH',name:'Ghana'},{iso3:'GRC',iso2:'GR',name:'Greece'},
  {iso3:'GTM',iso2:'GT',name:'Guatemala'},{iso3:'GEO',iso2:'GE',name:'Georgia'},
  {iso3:'GBR',iso2:'GB',name:'United Kingdom'},{iso3:'HTI',iso2:'HT',name:'Haiti'},
  {iso3:'HND',iso2:'HN',name:'Honduras'},{iso3:'HUN',iso2:'HU',name:'Hungary'},
  {iso3:'IDN',iso2:'ID',name:'Indonesia'},{iso3:'IND',iso2:'IN',name:'India'},
  {iso3:'IRN',iso2:'IR',name:'Iran'},{iso3:'IRQ',iso2:'IQ',name:'Iraq'},
  {iso3:'ISR',iso2:'IL',name:'Israel'},{iso3:'ITA',iso2:'IT',name:'Italy'},
  {iso3:'JPN',iso2:'JP',name:'Japan'},{iso3:'KAZ',iso2:'KZ',name:'Kazakhstan'},
  {iso3:'KEN',iso2:'KE',name:'Kenya'},{iso3:'PRK',iso2:'KP',name:'North Korea'},
  {iso3:'KOR',iso2:'KR',name:'South Korea'},{iso3:'LBN',iso2:'LB',name:'Lebanon'},
  {iso3:'LBY',iso2:'LY',name:'Libya'},{iso3:'MYS',iso2:'MY',name:'Malaysia'},
  {iso3:'MLI',iso2:'ML',name:'Mali'},{iso3:'MAR',iso2:'MA',name:'Morocco'},
  {iso3:'MEX',iso2:'MX',name:'Mexico'},{iso3:'MDA',iso2:'MD',name:'Moldova'},
  {iso3:'MNG',iso2:'MN',name:'Mongolia'},{iso3:'MOZ',iso2:'MZ',name:'Mozambique'},
  {iso3:'MMR',iso2:'MM',name:'Myanmar'},{iso3:'NLD',iso2:'NL',name:'Netherlands'},
  {iso3:'NZL',iso2:'NZ',name:'New Zealand'},{iso3:'NER',iso2:'NE',name:'Niger'},
  {iso3:'NGA',iso2:'NG',name:'Nigeria'},{iso3:'NOR',iso2:'NO',name:'Norway'},
  {iso3:'NPL',iso2:'NP',name:'Nepal'},{iso3:'PAK',iso2:'PK',name:'Pakistan'},
  {iso3:'PER',iso2:'PE',name:'Peru'},{iso3:'PHL',iso2:'PH',name:'Philippines'},
  {iso3:'PSE',iso2:'PS',name:'Palestine'},{iso3:'POL',iso2:'PL',name:'Poland'},
  {iso3:'PRT',iso2:'PT',name:'Portugal'},{iso3:'PRY',iso2:'PY',name:'Paraguay'},
  {iso3:'ROU',iso2:'RO',name:'Romania'},{iso3:'RUS',iso2:'RU',name:'Russia'},
  {iso3:'SAU',iso2:'SA',name:'Saudi Arabia'},{iso3:'SDN',iso2:'SD',name:'Sudan'},
  {iso3:'SEN',iso2:'SN',name:'Senegal'},{iso3:'SGP',iso2:'SG',name:'Singapore'},
  {iso3:'ZAF',iso2:'ZA',name:'South Africa'},{iso3:'SSD',iso2:'SS',name:'South Sudan'},
  {iso3:'ESP',iso2:'ES',name:'Spain'},{iso3:'LKA',iso2:'LK',name:'Sri Lanka'},
  {iso3:'SWE',iso2:'SE',name:'Sweden'},{iso3:'CHE',iso2:'CH',name:'Switzerland'},
  {iso3:'SYR',iso2:'SY',name:'Syria'},{iso3:'TWN',iso2:'TW',name:'Taiwan'},
  {iso3:'TJK',iso2:'TJ',name:'Tajikistan'},{iso3:'TZA',iso2:'TZ',name:'Tanzania'},
  {iso3:'THA',iso2:'TH',name:'Thailand'},{iso3:'TUN',iso2:'TN',name:'Tunisia'},
  {iso3:'TUR',iso2:'TR',name:'Turkey'},{iso3:'TKM',iso2:'TM',name:'Turkmenistan'},
  {iso3:'UGA',iso2:'UG',name:'Uganda'},{iso3:'UKR',iso2:'UA',name:'Ukraine'},
  {iso3:'USA',iso2:'US',name:'United States'},{iso3:'URY',iso2:'UY',name:'Uruguay'},
  {iso3:'UZB',iso2:'UZ',name:'Uzbekistan'},{iso3:'VEN',iso2:'VE',name:'Venezuela'},
  {iso3:'VNM',iso2:'VN',name:'Vietnam'},{iso3:'YEM',iso2:'YE',name:'Yemen'},
  {iso3:'ZMB',iso2:'ZM',name:'Zambia'},{iso3:'ZWE',iso2:'ZW',name:'Zimbabwe'},
  {iso3:'DZA',iso2:'DZ',name:'Algeria'},{iso3:'SOM',iso2:'SO',name:'Somalia'},
  {iso3:'CMR',iso2:'CM',name:'Cameroon'},{iso3:'AZE',iso2:'AZ',name:'Azerbaijan'},
  {iso3:'KHM',iso2:'KH',name:'Cambodia'},{iso3:'LAO',iso2:'LA',name:'Laos'},
];

export function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '🌍';
  const base = 0x1F1E6 - 65;
  return String.fromCodePoint(iso2.toUpperCase().charCodeAt(0) + base) +
         String.fromCodePoint(iso2.toUpperCase().charCodeAt(1) + base);
}

export function findCountry(iso3) {
  return COUNTRIES.find(c => c.iso3 === iso3?.toUpperCase()) || null;
}
