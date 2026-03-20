const DATA_BASE = 'data';

/** CSP-safe CSV loader: uses d3.text + csvParseRows instead of d3.csv (which uses unsafe-eval) */
async function loadCsvCspSafe(url) {
  const text = await d3.text(url);
  const rows = d3.csvParseRows(text);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
}

export async function loadCsv(path) {
  const url = `${DATA_BASE}/${path}`;
  return loadCsvCspSafe(url);
}

export async function loadCsvs(map) {
  const entries = Object.entries(map).map(async ([key, path]) => {
    const data = await loadCsv(path);
    return [key, data];
  });
  const results = await Promise.all(entries);
  return Object.fromEntries(results);
}

export async function loadUSStock(symbol) {
  const slug = String(symbol).toLowerCase();
  const path = `US_Stocks/Stocks/${slug}.us.txt`;
  const data = await loadCsv(path);
  return data.map((d) => ({
    date: new Date(d.Date),
    open: +d.Open,
    high: +d.High,
    low: +d.Low,
    close: +d.Close,
    volume: +d.Volume,
  }));
}

export async function loadUSStockSymbols() {
  const res = await fetch(`${DATA_BASE}/US_Stocks/symbols.json`);
  return res.json();
}

export async function loadCrypto(symbol) {
  const list = await loadCryptoList();
  const meta = list.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase());
  if (!meta) throw new Error(`Unknown crypto: ${symbol}`);
  const slug = meta.name.replace(/\s+/g, '');
  const path = `cryptocurrency/coin_${slug}.csv`;
  const data = await loadCsv(path);
  return data.map((d) => ({
    date: new Date(d.Date),
    open: +d.Open,
    high: +d.High,
    low: +d.Low,
    close: +d.Close,
    volume: +d.Volume,
    marketcap: +d.Marketcap || null,
  }));
}

let _cryptoListPromise = null;
export async function loadCryptoList() {
  if (!_cryptoListPromise) {
    _cryptoListPromise = fetch(`${DATA_BASE}/cryptocurrency/symbols.json`).then((r) => r.json());
  }
  return _cryptoListPromise;
}

export async function loadFinancialEvents() {
  const res = await fetch(`${DATA_BASE}/events/financial_crises.json`);
  return res.json();
}

export const datasets = {
  sp500Index: () => loadCsv('S&P_500/sp500_index.csv'),
  sp500Companies: () => loadCsv('S&P_500/sp500_companies.csv'),
  usMarketEvents: () => loadCsv('events/us_market_events.csv'),
  financials: () => loadCsv('S&P_500/financials.csv'),
};
