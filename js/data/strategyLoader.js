/**
 * Loads investment strategies from CSV files and maps issuer names to symbols.
 */

import { loadCsv } from './DataLoader.js';

const STRATEGY_FILES = [
  'berkshire_hathaway_2023-12-31.csv',
  'viking_global_investors_lp_2023-12-31.csv',
  'pershing_square_capital_management_lp_2023-12-31.csv',
  'lone_pine_capital_llc_2023-12-31.csv',
  'appaloosa_lp_2023-12-31.csv',
  'greenlight_capital_inc_2023-12-31.csv',
  'third_point_llc_2023-12-31.csv',
  'baupost_group_llc_2023-12-31.csv',
  'capital_research_global_investors_2023-12-31.csv',
];

const STRATEGY_META = {
  'berkshire_hathaway_2023-12-31': {
    displayName: 'Berkshire Hathaway',
    description: 'Warren Buffett\'s conglomerate. Focuses on undervalued, high-quality companies with durable competitive advantages, strong management, and predictable cash flows. Long-term buy-and-hold approach.',
  },
  'viking_global_investors_lp_2023-12-31': {
    displayName: 'Viking Global Investors',
    description: 'Long/short equity hedge fund. Seeks growth companies with sustainable competitive advantages. Concentrated portfolio with fundamental research.',
  },
  'pershing_square_capital_management_lp_2023-12-31': {
    displayName: 'Pershing Square',
    description: 'Bill Ackman\'s concentrated activist fund. Targets undervalued companies, pushes for strategic changes. High-conviction, concentrated positions.',
  },
  'lone_pine_capital_llc_2023-12-31': {
    displayName: 'Lone Pine Capital',
    description: 'Long equity fund founded by Tiger Cubs. Invests in high-quality growth companies with strong secular tailwinds. Fundamental, bottom-up research.',
  },
  'appaloosa_lp_2023-12-31': {
    displayName: 'Appaloosa',
    description: 'David Tepper\'s distressed and event-driven fund. Targets mispriced securities, corporate restructurings, and special situations.',
  },
  'greenlight_capital_inc_2023-12-31': {
    displayName: 'Greenlight Capital',
    description: 'David Einhorn\'s value-oriented fund. Long undervalued stocks, short overvalued. Deep fundamental analysis, contrarian positions.',
  },
  'third_point_llc_2023-12-31': {
    displayName: 'Third Point',
    description: 'Dan Loeb\'s event-driven and activist fund. Targets companies undergoing change. Combines value investing with catalyst-driven events.',
  },
  'baupost_group_llc_2023-12-31': {
    displayName: 'Baupost Group',
    description: 'Seth Klarman\'s value fund. Seeks mispriced securities, distress, and special situations. Patient, opportunistic approach with margin of safety.',
  },
  'capital_research_global_investors_2023-12-31': {
    displayName: 'Capital Research Global Investors',
    description: 'One of the world\'s largest active managers. Diversified, long-term approach across global equities. Fundamental research-driven.',
  },
};

function issuerToSymbol(issuer, sp500Companies, usStockSymbols) {
  if (!issuer || typeof issuer !== 'string') return null;
  const u = issuer.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  const words = u.split(/\s+/).filter((w) => w.length > 1);

  const symbolSet = new Set((usStockSymbols || []).map((s) => String(s).toUpperCase()));

  for (const c of sp500Companies || []) {
    const sym = (c.Symbol || '').toUpperCase();
    if (!sym || sym.length > 6) continue;
    const short = (c.Shortname || '').toUpperCase();
    const long = (c.Longname || '').toUpperCase();
    const shortWords = short.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const longWords = long.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);

    let score = 0;
    for (const w of words) {
      if (w.length < 3) continue;
      if (short.includes(w) || long.includes(w)) score += 2;
      if (shortWords.some((sw) => sw.startsWith(w) || w.startsWith(sw))) score += 1;
      if (longWords.some((lw) => lw.startsWith(w) || w.startsWith(lw))) score += 1;
    }
    if (score >= 2 && symbolSet.has(sym)) return sym;
  }

  const abbrevMap = {
    'APPLE': 'AAPL', 'BANK AMER': 'BAC', 'AMERICAN EXPRESS': 'AXP', 'COCA COLA': 'KO',
    'CHEVRON': 'CVX', 'OCCIDENTAL': 'OXY', 'KRAFT HEINZ': 'KHC', 'MOODYS': 'MCO',
    'DAVITA': 'DVA', 'VISA': 'V', 'MASTERCARD': 'MA', 'AMAZON': 'AMZN', 'SNOWFLAKE': 'SNOW',
    'AON': 'AON', 'ALLY': 'ALLY', 'PARAMOUNT': 'PARA', 'T-MOBILE': 'TMUS', 'HP INC': 'HPQ',
    'KROGER': 'KR', 'CITIGROUP': 'C', 'VERISIGN': 'VRSN', 'CAPITAL ONE': 'COF',
    'META PLATFORMS': 'META', 'MICROSOFT': 'MSFT', 'ALPHABET': 'GOOGL', 'NVIDIA': 'NVDA',
    'JOHNSON': 'JNJ', 'JPMORGAN': 'JPM', 'UNITEDHEALTH': 'UNH', 'EXXON': 'XOM',
    'HOME DEPOT': 'HD', 'PROCTER': 'PG', 'COSTCO': 'COST', 'NETFLIX': 'NFLX',
    'UNITED PARCEL': 'UPS', 'MCKESSON': 'MCK', 'DANAHER': 'DHR', 'PHILIP MORRIS': 'PM',
    'FORTIVE': 'FTV', 'AMERIPRISE': 'AMP', 'ADVANCED MICRO': 'AMD', 'GENERAL ELECTRIC': 'GE',
    'DEERE': 'DE', 'WORKDAY': 'WDAY', 'PROGRESSIVE': 'PGR', 'BRIDGEBIO': 'BBIO',
  };

  const uClean = u.replace(/\s+(INC|CORP|CO|PLC|LTD|LP|LLC|NEW|N)\s*$/i, '').trim();
  for (const [key, sym] of Object.entries(abbrevMap)) {
    if (u.includes(key) || uClean.includes(key.replace(/\s/g, ''))) {
      if (symbolSet.has(sym)) return sym;
    }
  }

  return null;
}

export async function loadStrategies() {
  const strategies = [];

  for (const file of STRATEGY_FILES) {
    try {
      const data = await loadCsv(`strategies/${file}`);
      const key = file.replace('.csv', '');
      const meta = STRATEGY_META[key] || { displayName: key.replace(/_/g, ' '), description: '' };
      strategies.push({
        id: key,
        displayName: meta.displayName,
        description: meta.description,
        holdings: data.map((r) => ({
          issuer: (r.issuer || '').trim(),
          rank: parseInt(r.rank, 10) || 0,
          weight: parseFloat(r.weight) || 0,
        })).filter((h) => h.weight >= 1 && h.issuer),
      });
    } catch (e) {
      console.warn('Failed to load strategy', file, e);
    }
  }

  return strategies;
}

export function resolveStrategyHoldings(strategy, sp500Companies, usStockSymbols, maxCount) {
  if (!strategy?.holdings?.length) return [];
  const symbolSet = new Set((usStockSymbols || []).map((s) => String(s).toUpperCase()));
  const results = [];
  const seen = new Set();

  for (const h of strategy.holdings) {
    if (results.length >= maxCount) break;
    const sym = issuerToSymbol(h.issuer, sp500Companies, usStockSymbols);
    if (sym && symbolSet.has(sym) && !seen.has(sym)) {
      seen.add(sym);
      const meta = sp500Companies?.find((c) => (c.Symbol || '').toUpperCase() === sym);
      results.push({
        symbol: sym,
        name: meta?.Shortname || meta?.Longname || h.issuer,
        weight: h.weight,
      });
    }
  }

  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  if (totalWeight > 0) {
    results.forEach((r) => {
      r.allocPct = (r.weight / totalWeight) * 100;
    });
  } else {
    const n = results.length;
    results.forEach((r) => { r.allocPct = n > 0 ? 100 / n : 0; });
  }

  return results;
}

export { STRATEGY_META };
