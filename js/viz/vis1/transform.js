/**
 * Transform S&P 500 companies data for the stock distribution map.
 * Aggregates by state: company count and total market cap.
 */

/** Parse founding year from Longbusinesssummary text. Returns null if not found. */
function parseFoundingYear(summary) {
  if (!summary || typeof summary !== 'string') return null;
  const m = summary.match(/\b(?:founded|incorporated|established)\s+(?:in\s+)?(\d{4})\b/i);
  return m ? parseInt(m[1], 10) : null;
}

const STATE_TO_FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56',
};

export function transformCompaniesByState(companies) {
  if (!companies?.length) return { byState: {}, maxCount: 0, maxMarketCap: 0 };

  const byState = {};
  for (const row of companies) {
    const state = row.State?.trim?.() || row.state;
    if (!state || !STATE_TO_FIPS[state]) continue;

    const fips = STATE_TO_FIPS[state];
    const marketCap = parseFloat(row.Marketcap || row.marketcap || 0) || 0;

    if (!byState[fips]) {
      byState[fips] = { fips, state, count: 0, marketCap: 0, companies: [] };
    }
    byState[fips].count += 1;
    byState[fips].marketCap += marketCap;
    byState[fips].companies.push({
      symbol: row.Symbol || row.symbol,
      name: row.Shortname || row.shortname || row.Longname,
      marketCap,
      sector: row.Sector || row.sector,
      industry: row.Industry || row.industry,
      city: row.City || row.city,
      state: row.State?.trim?.() || row.state,
      currentPrice: parseFloat(row.Currentprice || row.currentprice || 0) || null,
      employees: parseInt(row.Fulltimeemployees || row.fulltimeemployees || 0, 10) || null,
    });
  }

  const values = Object.values(byState);
  return {
    byState,
    maxCount: Math.max(1, ...values.map((s) => s.count)),
    maxMarketCap: Math.max(1, ...values.map((s) => s.marketCap)),
  };
}

/**
 * Build time-indexed byState snapshots by founding year.
 * For each year Y, includes companies founded <= Y.
 * Returns { byYear: { year: { byState, maxCount } }, years: number[] }
 */
export function transformCompaniesByStateWithTime(companies) {
  if (!companies?.length) return { byYear: {}, years: [] };

  const companiesWithYear = companies.map((row) => {
    const summary = row.Longbusinesssummary || row.longbusinesssummary || '';
    const foundingYear = parseFoundingYear(summary);
    return { row, foundingYear: foundingYear ?? 1900 };
  });

  const minYear = Math.min(1900, ...companiesWithYear.map((c) => c.foundingYear));
  const maxYear = new Date().getFullYear();
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const byYear = {};
  for (const year of years) {
    const filtered = companiesWithYear.filter((c) => c.foundingYear <= year).map((c) => c.row);
    const { byState, maxCount } = transformCompaniesByState(filtered);
    byYear[year] = { byState, maxCount };
  }

  return { byYear, years };
}
