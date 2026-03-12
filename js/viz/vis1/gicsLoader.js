/**
 * Load and parse GICS (Global Industry Classification Standard) hierarchy.
 * Maps S&P 500 companies to the GICS tree for drill-down exploration.
 */

const SECTOR_MAP = {
  Technology: 'Information Technology',
  'Consumer Cyclical': 'Consumer Discretionary',
  'Consumer Defensive': 'Consumer Staples',
  Healthcare: 'Health Care',
  'Financial Services': 'Financials',
};

export async function loadGicsMap() {
  const url = 'data/GICS/gics-map-2018.csv';
  const d3 = window.d3;
  if (d3?.csv) {
    return d3.csv(url);
  }
  const res = await fetch(url);
  const text = await res.text();
  if (d3?.csvParse) return d3.csvParse(text);
  return [];
}

/**
 * Build a hierarchical tree from GICS rows.
 * Structure: Sector → Industry Group → Industry → Sub-Industry
 */
export function buildGicsTree(gicsRows) {
  const bySector = new Map();
  for (const row of gicsRows || []) {
    const sectorName = row.Sector?.trim();
    if (!sectorName) continue;

    let sector = bySector.get(sectorName);
    if (!sector) {
      sector = { name: sectorName, id: row.SectorId, groups: new Map(), companies: [], marketCap: 0 };
      bySector.set(sectorName, sector);
    }

    const igName = row.IndustryGroup?.trim();
    if (igName) {
      let group = sector.groups.get(igName);
      if (!group) {
        group = { name: igName, id: row.IndustryGroupId, industries: new Map() };
        sector.groups.set(igName, group);
      }

      const indName = row.Industry?.trim();
      if (indName) {
        let industry = group.industries.get(indName);
        if (!industry) {
          industry = { name: indName, id: row.IndustryId, subIndustries: [] };
          group.industries.set(indName, industry);
        }

        const subName = row.SubIndustry?.trim();
        if (subName) {
          industry.subIndustries.push({
            name: subName,
            id: row.SubIndustryId,
            description: row.SubIndustryDescription?.trim() || '',
          });
        }
      }
    }
  }

  return Array.from(bySector.values()).map((s) => ({
    ...s,
    groups: Array.from(s.groups.values()).map((g) => ({
      ...g,
      industries: Array.from(g.industries.values()).map((i) => ({
        ...i,
        subIndustries: i.subIndustries || [],
      })),
    })),
  }));
}

function parseFoundedYear(summary) {
  if (!summary || typeof summary !== 'string') return null;
  const m = summary.match(/(?:founded|incorporated) in (\d{4})/i);
  return m ? m[1] : null;
}

/**
 * Map S&P 500 companies to GICS sectors (and optionally deeper).
 * Companies have Sector and Industry from the dataset.
 */
export function mapCompaniesToGics(companies, gicsTree) {
  const bySector = new Map();
  for (const c of companies || []) {
    const rawSector = (c.Sector || c.sector || '').trim();
    const gicsSector = SECTOR_MAP[rawSector] || rawSector;
    const cap = parseFloat(c.Marketcap || c.marketcap || 0) || 0;

    if (!bySector.has(gicsSector)) {
      bySector.set(gicsSector, { companies: [], marketCap: 0 });
    }
    const slot = bySector.get(gicsSector);
    const summary = c.Longbusinesssummary || c.longbusinesssummary || '';
    slot.companies.push({
      symbol: c.Symbol || c.symbol,
      name: c.Shortname || c.shortname || c.Longname || c.name,
      longName: (c.Longname || c.Shortname || c.longname || c.shortname || '').trim(),
      industry: (c.Industry || c.industry || '').trim(),
      marketCap: cap,
      foundedYear: parseFoundedYear(summary),
    });
    slot.marketCap += cap;
  }

  return { bySector: Object.fromEntries(bySector), totalCap: [...bySector.values()].reduce((s, x) => s + x.marketCap, 0) };
}

/**
 * Merge company data into GICS tree for display.
 */
export function mergeCompaniesIntoTree(gicsTree, companyData) {
  const { bySector } = companyData;
  return gicsTree.map((sector) => {
    const data = bySector[sector.name] || { companies: [], marketCap: 0 };
    return {
      ...sector,
      count: data.companies.length,
      marketCap: data.marketCap,
      companies: data.companies,
    };
  });
}
