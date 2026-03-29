/**
 * A fun, cartoon-style explainer that teaches "What is a stock?" using real S&P 500 data.
 * Uses sector breakdown and S&P 500 index over time.
 * Dedicated centered layout with max-width to prevent text overflow.
 */

import { BaseViz } from '../BaseViz.js';
import { loadGicsMap, buildGicsTree, mapCompaniesToGics, mergeCompaniesIntoTree } from './gicsLoader.js';
import { loadUSStock } from '../../data/DataLoader.js';
import { loadFinancialEvents } from '../../data/DataLoader.js';
import { renderTutorialStockChart } from '../../utils/tutorialStockChart.js';

function formatCap(v) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return v?.toLocaleString() || '0';
}

const GICS_SECTOR_COLORS = {
  'Information Technology': '#1e40af',
  'Consumer Discretionary': '#dc2626',
  'Communication Services': '#7c3aed',
  'Consumer Staples': '#16a34a',
  Financials: '#0d9488',
  'Health Care': '#0891b2',
  Energy: '#ca8a04',
  Industrials: '#4b5563',
  'Real Estate': '#be185d',
  Materials: '#65a30d',
  Utilities: '#0284c7',
  default: '#64748b',
};

function renderGicsConcentricChart(container, mergedTree, onSectorClick) {
  if (!container || !mergedTree?.length) return;
  container.innerHTML = '';

  const totalCap = mergedTree.reduce((s, x) => s + (x.marketCap || 0), 0);
  const sorted = [...mergedTree].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

  const chartSize = 320;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const innerRadius = chartSize * 0.28;
  const outerRadius = chartSize * 0.42;

  const pie = d3.pie().value((d) => d.marketCap || 0).sort(null);
  const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);

  const wrap = d3.select(container).append('div').attr('class', 'gics-chart-wrap');
  const svg = wrap
    .append('svg')
    .attr('class', 'gics-concentric-svg')
    .attr('width', chartSize)
    .attr('height', chartSize)
    .attr('viewBox', [0, 0, chartSize, chartSize]);

  const tooltip = wrap.append('div').attr('class', 'gics-chart-tooltip').attr('aria-hidden', 'true');

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const arcGroups = g
    .selectAll('.gics-sector-arc-wrap')
    .data(pie(sorted))
    .join('g')
    .attr('class', 'gics-sector-arc-wrap');

  arcGroups
    .append('path')
    .attr('class', 'gics-sector-arc')
    .attr('fill', (d) => GICS_SECTOR_COLORS[d.data.name] || GICS_SECTOR_COLORS.default)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('d', arc)
    .style('cursor', 'pointer')
    .style('opacity', 0.9)
    .on('mouseover', function (event, d) {
      d3.select(this).style('opacity', 1).attr('stroke-width', 3);
      const pct = totalCap ? ((d.data.marketCap || 0) / totalCap) * 100 : 0;
      const sector = d.data;
      tooltip
        .attr('aria-hidden', 'false')
        .classed('gics-chart-tooltip-visible', true)
        .html(`
          <div class="gics-chart-tooltip-header">
            <span class="gics-chart-tooltip-swatch" style="background:${GICS_SECTOR_COLORS[sector.name] || GICS_SECTOR_COLORS.default}"></span>
            <span class="gics-chart-tooltip-name">${sector.name}</span>
          </div>
          <div class="gics-chart-tooltip-pct">${pct.toFixed(1)}% of S&P 500</div>
          <div class="gics-chart-tooltip-cap">$${formatCap(sector.marketCap)} total</div>
          <div class="gics-chart-tooltip-count">${sector.count || 0} companies</div>
          <div class="gics-chart-tooltip-hint">Click to explore</div>
        `);
      const rect = wrap.node().getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      tooltip
        .style('left', `${Math.min(x + 12, rect.width - 200)}px`)
        .style('top', `${Math.min(y + 12, rect.height - 140)}px`);
    })
    .on('mousemove', function (event) {
      const rect = wrap.node().getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      tooltip
        .style('left', `${Math.min(x + 12, rect.width - 200)}px`)
        .style('top', `${Math.min(y + 12, rect.height - 140)}px`);
    })
    .on('mouseout', function () {
      d3.select(this).style('opacity', 0.9).attr('stroke-width', 2);
      tooltip.attr('aria-hidden', 'true').classed('gics-chart-tooltip-visible', false);
    })
    .on('click', (event, d) => onSectorClick?.(d.data));
}

function showSectorPopup(sector, totalCap, scrollTarget) {
  const existing = document.querySelector('.gics-sector-detail-popup');
  if (existing) existing.remove();

  const companies = (sector.companies || []).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  const pct = totalCap ? ((sector.marketCap || 0) / totalCap * 100).toFixed(1) : '0';

  const popup = document.createElement('div');
  popup.className = 'gics-sector-detail-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-labelledby', 'gics-sector-popup-title');

  const companiesHtml = companies
    .map(
      (c) =>
        `<button type="button" class="gics-sector-company-row" data-symbol="${(c.symbol || '').replace(/"/g, '&quot;')}">
          <span class="gics-sector-company-symbol">${c.symbol}</span>
          <span class="gics-sector-company-name">${(c.longName || c.name || c.symbol || '').slice(0, 48)}${(c.longName || c.name || '').length > 48 ? '…' : ''}</span>
          <span class="gics-sector-company-cap">$${formatCap(c.marketCap)}</span>
        </button>`
    )
    .join('');

  popup.innerHTML = `
    <div class="gics-sector-detail-popup-backdrop"></div>
    <div class="gics-sector-detail-popup-inner">
      <div class="gics-sector-detail-header">
        <button type="button" class="gics-sector-detail-back" aria-label="Go back to chart">← Go back</button>
        <button type="button" class="gics-sector-detail-close" aria-label="Close">×</button>
      </div>
      <h4 id="gics-sector-popup-title" class="gics-sector-detail-title">${sector.name}</h4>
      <div class="gics-sector-detail-stats">
        <span>${companies.length} companies</span>
        <span>$${formatCap(sector.marketCap)} total · ${pct}% of S&P 500</span>
      </div>
      ${sector.groups?.length ? `
      <div class="gics-sector-detail-groups">
        <strong>Industry groups:</strong> ${sector.groups.map((g) => g.name).join(', ')}
      </div>
      ` : ''}
      <p class="gics-sector-detail-hint">Click a company to explore that stock</p>
      <div class="gics-sector-detail-companies">
        ${companiesHtml}
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  popup.querySelector('.gics-sector-detail-popup-inner').setAttribute('tabindex', '-1');
  requestAnimationFrame(() => {
    popup.classList.add('gics-sector-detail-popup-visible');
    popup.querySelector('.gics-sector-detail-close')?.focus();
  });

  const close = () => {
    popup.classList.remove('gics-sector-detail-popup-visible');
    setTimeout(() => popup.remove(), 200);
  };

  const goBack = () => {
    close();
    window.dispatchEvent(new CustomEvent('marketscope:goBackToGics', { detail: { scrollTarget } }));
  };

  popup.querySelector('.gics-sector-detail-close')?.addEventListener('click', close);
  popup.querySelector('.gics-sector-detail-back')?.addEventListener('click', goBack);
  popup.querySelector('.gics-sector-detail-popup-backdrop')?.addEventListener('click', close);

  popup.querySelectorAll('.gics-sector-company-row').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sym = btn.dataset.symbol;
      if (sym) window.dispatchEvent(new CustomEvent('marketscope:openStock', { detail: { symbol: sym } }));
    });
  });

  popup.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function escLegendHtml(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function renderGicsSectorLegend(listEl, mergedTree) {
  if (!listEl || !mergedTree?.length) return;
  const sorted = [...mergedTree].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  listEl.innerHTML = sorted
    .map((s) => {
      const color = GICS_SECTOR_COLORS[s.name] || GICS_SECTOR_COLORS.default;
      return `<li class="explainer-gics-legend-item"><span class="explainer-gics-legend-swatch" style="background:${color}" aria-hidden="true"></span><span class="explainer-gics-legend-label">${escLegendHtml(s.name)}</span></li>`;
    })
    .join('');
}

function aggregateBySector(companies) {
  if (!companies?.length) return [];
  const bySector = {};
  for (const row of companies) {
    const sector = row.Sector || row.sector || 'Other';
    const cap = parseFloat(row.Marketcap || row.marketcap || 0) || 0;
    if (!bySector[sector]) bySector[sector] = { sector, marketCap: 0, count: 0 };
    bySector[sector].marketCap += cap;
    bySector[sector].count += 1;
  }
  return Object.values(bySector).sort((a, b) => b.marketCap - a.marketCap);
}

/** Hover / focus hints for the NVDA decoder-ring panel (keys match data-hint-key). */
const NVDA_FIELD_HINTS = {
  ticker: {
    title: 'Ticker symbol',
    desc: 'The short trading “code” (here NVDA) that brokers, charts, and news use to identify one stock. It is unique on a given exchange.',
  },
  name: {
    title: 'Company name',
    desc: 'The public company name you see on filings and in many apps next to the ticker. It is the legal operating name, not the ticker.',
  },
  exchange: {
    title: 'Stock exchange',
    desc: 'Where the stock trades (e.g. Nasdaq or NYSE). Different venues match buyers and sellers; the ticker + exchange tells the system exactly which security you mean.',
  },
  sector: {
    title: 'Sector',
    desc: 'A broad industry bucket (GICS sector). The S&P 500 is often split by sector so you can compare how big “Technology” is versus “Health Care,” and so on.',
  },
  industry: {
    title: 'Industry',
    desc: 'A narrower label under the sector—for example Semiconductors within Technology. It is more specific than sector but still a grouped category.',
  },
  price: {
    title: 'Share price',
    desc: 'The stock’s price in this dataset snapshot. It changes with trading; it is not a “score” for the company, just what one share last traded near in this data.',
  },
  mktcap: {
    title: 'Market capitalization',
    desc: 'Roughly share price × number of shares: the total dollar value the market puts on all outstanding stock. Used as a quick sense of company size in public markets.',
  },
  hq: {
    title: 'Headquarters',
    desc: 'Main corporate location from filings. It is context about the company, not where you need to live to buy the stock.',
  },
  employees: {
    title: 'Employees',
    desc: 'Reported headcount (approximate) from company data. It hints at scale of operations; it does not by itself say if the stock is a good investment.',
  },
  summary: {
    title: 'Business summary',
    desc: 'Plain-language description of what the company does, shortened here for space. Longer versions appear in annual reports and data providers.',
  },
  panel: {
    title: 'Why this mini card?',
    desc: 'Real listings repeat these same building blocks: ticker, name, venue, sector/industry, price, market cap, context, and a price history. Hover each dotted label to learn the field; hover the chart for day-by-day closes.',
  },
  chart: {
    title: 'Price trend (real history)',
    desc: 'This line plots actual daily closing prices from this app’s dataset (one point per trading day). Time runs left to right; height is share price. Hover anywhere on the chart to see which calendar day and closing price that point represents—not investment advice, just how to read the shape.',
  },
};

function escNvdaHtml(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function exchangeFriendly(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'NMS' || c === 'NASDAQ') return 'Nasdaq';
  if (c === 'NYQ' || c === 'NYSE') return 'NYSE';
  if (!c) return '—';
  return c;
}

function buildNvdaSamplePanelHtml(companies) {
  const row = (Array.isArray(companies) ? companies : []).find((c) => (c.Symbol || '').toUpperCase() === 'NVDA');
  const sym = row?.Symbol ? String(row.Symbol).toUpperCase() : 'NVDA';
  const longname = row?.Longname || row?.Shortname || 'NVIDIA Corporation';
  const exCode = row?.Exchange || 'NMS';
  const exLabel = exchangeFriendly(exCode);
  const sector = row?.Sector || 'Technology';
  const industry = row?.Industry || 'Semiconductors';
  const priceRaw = row?.Currentprice != null ? parseFloat(row.Currentprice) : 134.7;
  const priceStr = Number.isFinite(priceRaw) ? priceRaw.toFixed(2) : '—';
  const capNum = row?.Marketcap != null ? parseFloat(row.Marketcap) : 3.3e12;
  const capStr = Number.isFinite(capNum) ? `$${formatCap(capNum)}` : '—';
  const city = row?.City || 'Santa Clara';
  const state = row?.State || 'CA';
  const empRaw = row?.Fulltimeemployees != null ? parseInt(String(row.Fulltimeemployees).replace(/,/g, ''), 10) : 29600;
  const empStr = Number.isFinite(empRaw) ? empRaw.toLocaleString() : '—';
  let summary = row?.Longbusinesssummary || row?.Summary || '';
  if (summary.length > 220) summary = `${summary.slice(0, 217).trim()}…`;

  return `
      <h3 class="viz-title explainer-section-title">Sample stock: NVIDIA (<span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="ticker">${escNvdaHtml(sym)}</span>)</h3>
      <p class="viz-caption-desc explainer-section-desc explainer-nvda-intro">
        <span class="explainer-nvda-hint explainer-nvda-hint--soft" tabindex="0" role="button" data-hint-key="panel"><strong>Hover or focus</strong> each <span class="explainer-nvda-dotted">dotted</span> label</span>, and <strong>hover the chart</strong> for day-by-day prices—same ingredients you will see elsewhere in Stock Basics.
      </p>
      <div class="explainer-nvda-card" aria-label="NVIDIA sample listing">
        <div class="explainer-nvda-tooltip" aria-hidden="true">
          <strong class="explainer-nvda-tooltip-title"></strong>
          <p class="explainer-nvda-tooltip-desc"></p>
        </div>
        <div class="explainer-nvda-row explainer-nvda-row--hero">
          <span class="explainer-nvda-hint explainer-nvda-ticker" tabindex="0" role="button" data-hint-key="ticker">${escNvdaHtml(sym)}</span>
          <span class="explainer-nvda-sep" aria-hidden="true">·</span>
          <span class="explainer-nvda-hint explainer-nvda-co-name" tabindex="0" role="button" data-hint-key="name">${escNvdaHtml(longname)}</span>
        </div>
        <div class="explainer-nvda-row explainer-nvda-row--meta">
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="exchange"><span class="explainer-nvda-meta-label">Exchange</span> ${escNvdaHtml(exLabel)} <span class="explainer-nvda-paren">(${escNvdaHtml(exCode)})</span></span>
          <span class="explainer-nvda-dot" aria-hidden="true">·</span>
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="sector"><span class="explainer-nvda-meta-label">Sector</span> ${escNvdaHtml(sector)}</span>
          <span class="explainer-nvda-dot" aria-hidden="true">·</span>
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="industry"><span class="explainer-nvda-meta-label">Industry</span> ${escNvdaHtml(industry)}</span>
        </div>
        <div class="explainer-nvda-row explainer-nvda-row--nums">
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="price"><span class="explainer-nvda-meta-label">Price</span> $${escNvdaHtml(priceStr)}</span>
          <span class="explainer-nvda-dot" aria-hidden="true">·</span>
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="mktcap"><span class="explainer-nvda-meta-label">Mkt cap</span> ${escNvdaHtml(capStr)}</span>
        </div>
        <div class="explainer-nvda-row explainer-nvda-row--hq">
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="hq"><span class="explainer-nvda-meta-label">HQ</span> ${escNvdaHtml(city)}, ${escNvdaHtml(state)}</span>
          <span class="explainer-nvda-dot" aria-hidden="true">·</span>
          <span class="explainer-nvda-hint" tabindex="0" role="button" data-hint-key="employees"><span class="explainer-nvda-meta-label">Employees</span> ${escNvdaHtml(empStr)}</span>
        </div>
        <div class="explainer-nvda-chart-wrap explainer-nvda-chart-wrap--loading" aria-busy="true">
          <div class="explainer-nvda-chart-head">
            <span class="explainer-nvda-hint explainer-nvda-chart-title-hint" tabindex="0" role="button" data-hint-key="chart">Price trend · NVDA</span>
            <span class="explainer-nvda-chart-range" aria-live="polite"></span>
          </div>
          <p class="explainer-nvda-chart-status">Loading price history…</p>
          <div class="explainer-nvda-chart-inner" hidden>
            <svg class="explainer-nvda-chart-svg" role="img" aria-hidden="true"></svg>
            <div class="explainer-nvda-chart-scrub" aria-hidden="true"></div>
          </div>
          <p class="explainer-nvda-chart-fallback" hidden></p>
        </div>
        <p class="explainer-nvda-summary"><span class="explainer-nvda-hint explainer-nvda-summary-inner" tabindex="0" role="button" data-hint-key="summary">${escNvdaHtml(summary || 'NVIDIA designs GPUs and data-center platforms used in gaming, AI, and visualization.')}</span></p>
      </div>
    `;
}

function bisectNvdaDate(arr, xVal) {
  if (!arr.length) return 0;
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].date < xVal) lo = mid;
    else hi = mid;
  }
  return xVal - arr[lo].date > arr[hi].date - xVal ? hi : lo;
}

function formatNvdaChartDate(d) {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNvdaChartYTick(v) {
  if (!Number.isFinite(v)) return '';
  if (v >= 1000) return `$${Math.round(v / 100) / 10}k`;
  if (v >= 100) return `$${Math.round(v)}`;
  if (v >= 10) return `$${v.toFixed(1)}`;
  return `$${v.toFixed(2)}`;
}

/**
 * Renders ~10 years of NVDA daily closes; hover overlay shows date + close.
 * @returns {boolean} true if a chart was drawn
 */
function renderNvdaTrendChart(cardRoot, ohlcv) {
  const chartWrap = cardRoot.querySelector('.explainer-nvda-chart-wrap');
  const statusEl = cardRoot.querySelector('.explainer-nvda-chart-status');
  const inner = cardRoot.querySelector('.explainer-nvda-chart-inner');
  const svgEl = cardRoot.querySelector('.explainer-nvda-chart-svg');
  const scrubEl = cardRoot.querySelector('.explainer-nvda-chart-scrub');
  const rangeEl = cardRoot.querySelector('.explainer-nvda-chart-range');
  const fallbackEl = cardRoot.querySelector('.explainer-nvda-chart-fallback');

  if (!chartWrap || !inner || !svgEl || !scrubEl) return false;

  const fail = (msg) => {
    if (statusEl) statusEl.hidden = true;
    if (fallbackEl) {
      fallbackEl.hidden = false;
      fallbackEl.textContent = msg;
    }
    inner.hidden = true;
    chartWrap.classList.remove('explainer-nvda-chart-wrap--loading');
    chartWrap.setAttribute('aria-busy', 'false');
    return false;
  };

  if (!Array.isArray(ohlcv) || ohlcv.length < 2) {
    return fail('Could not load enough price history to draw a chart.');
  }

  const sorted = [...ohlcv]
    .filter((d) => d.date instanceof Date && !Number.isNaN(d.date) && Number.isFinite(d.close))
    .sort((a, b) => a.date - b.date);
  if (sorted.length < 2) {
    return fail('Could not load enough price history to draw a chart.');
  }

  const endDate = sorted[sorted.length - 1].date;
  const startCut = new Date(endDate);
  startCut.setFullYear(startCut.getFullYear() - 10);
  const series = sorted.filter((d) => d.date >= startCut);
  const use = series.length >= 2 ? series : sorted;

  const W = 760;
  const H = 210;
  const m = { t: 14, r: 18, b: 30, l: 62 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  if (statusEl) statusEl.hidden = true;
  inner.hidden = false;
  chartWrap.classList.remove('explainer-nvda-chart-wrap--loading');
  chartWrap.setAttribute('aria-busy', 'false');
  if (fallbackEl) fallbackEl.hidden = true;

  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgEl.removeAttribute('aria-hidden');
  svgEl.setAttribute(
    'aria-label',
    `NVDA closing prices from ${formatNvdaChartDate(use[0].date)} to ${formatNvdaChartDate(use[use.length - 1].date)}. Hover for a specific day.`
  );

  const x = d3.scaleTime().domain(d3.extent(use, (d) => d.date)).range([m.l, m.l + iw]);
  const [yMin, yMax] = d3.extent(use, (d) => d.close);
  const pad = Math.max((yMax - yMin) * 0.08, 0.01);
  const y = d3.scaleLinear().domain([yMin - pad, yMax + pad]).nice().range([m.t + ih, m.t]);

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  svg
    .append('rect')
    .attr('class', 'explainer-nvda-chart-plot-bg')
    .attr('x', m.l)
    .attr('y', m.t)
    .attr('width', iw)
    .attr('height', ih)
    .attr('rx', 10);

  const lineGen = d3
    .line()
    .defined((d) => Number.isFinite(d.close))
    .x((d) => x(d.date))
    .y((d) => y(d.close))
    .curve(d3.curveMonotoneX);

  svg
    .append('path')
    .datum(use)
    .attr('class', 'explainer-nvda-chart-line')
    .attr('fill', 'none')
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .attr('d', lineGen);

  const yTickVals = y.ticks(4);
  const axG = svg.append('g').attr('class', 'explainer-nvda-chart-y-axis');
  yTickVals.forEach((tv) => {
    axG
      .append('text')
      .attr('class', 'explainer-nvda-chart-tick explainer-nvda-chart-tick--y')
      .attr('x', m.l - 12)
      .attr('y', y(tv))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(formatNvdaChartYTick(tv));
  });

  const mid = use[Math.floor(use.length / 2)];
  const xTicks = [use[0].date, mid.date, use[use.length - 1].date];
  const xAx = svg.append('g').attr('class', 'explainer-nvda-chart-x-axis');
  xTicks.forEach((dt, i) => {
    xAx
      .append('text')
      .attr('class', 'explainer-nvda-chart-tick explainer-nvda-chart-tick--x')
      .attr('x', x(dt))
      .attr('y', H - 10)
      .attr('text-anchor', i === 0 ? 'start' : i === 2 ? 'end' : 'middle')
      .text(String(dt.getFullYear()));
  });

  const focus = svg.append('g').attr('class', 'explainer-nvda-chart-focus').style('display', 'none');
  focus
    .append('line')
    .attr('class', 'explainer-nvda-chart-cross-v')
    .attr('y1', m.t)
    .attr('y2', m.t + ih);
  focus.append('circle').attr('class', 'explainer-nvda-chart-focus-dot').attr('r', 5);

  const overlay = svg
    .append('rect')
    .attr('class', 'explainer-nvda-chart-overlay')
    .attr('x', m.l)
    .attr('y', m.t)
    .attr('width', iw)
    .attr('height', ih)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair');

  function showScrub(event) {
    const [mx, my] = d3.pointer(event, svgEl);
    if (mx < m.l || mx > m.l + iw || my < m.t || my > m.t + ih) {
      focus.style('display', 'none');
      scrubEl.classList.remove('explainer-nvda-chart-scrub-visible');
      scrubEl.setAttribute('aria-hidden', 'true');
      return;
    }
    const x0 = x.invert(mx);
    const i = bisectNvdaDate(use, x0);
    const d = use[i];
    if (!d) return;
    const cx = x(d.date);
    const cy = y(d.close);
    focus.style('display', null);
    focus.select('.explainer-nvda-chart-cross-v').attr('x1', cx).attr('x2', cx);
    focus.select('.explainer-nvda-chart-focus-dot').attr('cx', cx).attr('cy', cy);

    scrubEl.innerHTML = `<strong class="explainer-nvda-chart-scrub-date">${formatNvdaChartDate(d.date)}</strong><span class="explainer-nvda-chart-scrub-price">Close ${d.close.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}</span>`;
    scrubEl.classList.add('explainer-nvda-chart-scrub-visible');
    scrubEl.setAttribute('aria-hidden', 'false');

    const innerRect = inner.getBoundingClientRect();
    const pad = 10;
    let left = event.clientX - innerRect.left + pad;
    let top = event.clientY - innerRect.top - 52;
    const maxW = Math.min(280, innerRect.width - pad * 2);
    if (left + maxW > innerRect.width - pad) left = innerRect.width - maxW - pad;
    if (left < pad) left = pad;
    if (top < pad) top = event.clientY - innerRect.top + pad;
    scrubEl.style.left = `${left}px`;
    scrubEl.style.top = `${top}px`;
  }

  function hideScrub() {
    focus.style('display', 'none');
    scrubEl.classList.remove('explainer-nvda-chart-scrub-visible');
    scrubEl.setAttribute('aria-hidden', 'true');
  }

  overlay.on('mousemove', showScrub);
  overlay.on('mouseleave', hideScrub);

  if (rangeEl) {
    rangeEl.textContent = `${use[0].date.getFullYear()}–${use[use.length - 1].date.getFullYear()} · hover for daily close`;
  }

  return true;
}

function attachNvdaSampleHints(cardRoot) {
  const tooltip = cardRoot.querySelector('.explainer-nvda-tooltip');
  const titleEl = cardRoot.querySelector('.explainer-nvda-tooltip-title');
  const descEl = cardRoot.querySelector('.explainer-nvda-tooltip-desc');
  const terms = cardRoot.querySelectorAll('.explainer-nvda-hint[data-hint-key]');
  if (!tooltip || !titleEl || !descEl) return;

  let hideTimer = null;

  function placeNear(el, clientX, clientY) {
    const pad = 10;
    const cr = cardRoot.getBoundingClientRect();
    let x = clientX - cr.left + 14;
    let y = clientY - cr.top + 14;
    if (!Number.isFinite(clientX)) {
      const er = el.getBoundingClientRect();
      x = er.left - cr.left + er.width / 2;
      y = er.bottom - cr.top + 12;
    }

    function clampToCard() {
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      let nx = x;
      let ny = y;
      if (!Number.isFinite(clientX)) {
        nx -= tw / 2;
      }
      if (nx + tw > cardRoot.clientWidth - pad) nx = cardRoot.clientWidth - tw - pad;
      if (ny + th > cardRoot.clientHeight - pad) ny = cardRoot.clientHeight - th - pad;
      if (nx < pad) nx = pad;
      if (ny < pad) ny = pad;
      tooltip.style.left = `${nx}px`;
      tooltip.style.top = `${ny}px`;
    }

    tooltip.style.left = `${Math.max(pad, x)}px`;
    tooltip.style.top = `${Math.max(pad, y)}px`;
    requestAnimationFrame(clampToCard);
  }

  function show(el, e) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const key = el.getAttribute('data-hint-key');
    const hint = key ? NVDA_FIELD_HINTS[key] : null;
    if (!hint) return;
    titleEl.textContent = hint.title;
    descEl.textContent = hint.desc;
    tooltip.classList.add('explainer-nvda-tooltip-visible');
    tooltip.setAttribute('aria-hidden', 'false');
    const cx = e && typeof e.clientX === 'number' ? e.clientX : NaN;
    const cy = e && typeof e.clientY === 'number' ? e.clientY : NaN;
    placeNear(el, cx, cy);
  }

  function move(e) {
    if (!tooltip.classList.contains('explainer-nvda-tooltip-visible')) return;
    placeNear(e.currentTarget || cardRoot, e.clientX, e.clientY);
  }

  function hide() {
    hideTimer = setTimeout(() => {
      tooltip.classList.remove('explainer-nvda-tooltip-visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }, 80);
  }

  function cancelHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  terms.forEach((el) => {
    el.addEventListener('mouseenter', (e) => show(el, e));
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', (e) => show(el, e));
    el.addEventListener('blur', hide);
  });

  tooltip.addEventListener('mouseenter', cancelHide);
  tooltip.addEventListener('mouseleave', hide);
}

export class StockExplainerViz extends BaseViz {
  async mount(container, data, options = {}) {
    super.mount(container, data, options);
    this.container.innerHTML = '';

    const companies = data?.sp500Companies ?? data;
    const indexData = data?.sp500Index;
    const sectors = aggregateBySector(Array.isArray(companies) ? companies : []);

    const totalCap = sectors.reduce((s, x) => s + x.marketCap, 0);

    /* Dedicated explainer layout: centered column, no map structure */
    const root = document.createElement('div');
    root.className = 'stock-explainer-root';

    const header = document.createElement('div');
    header.className = 'stock-explainer-header';
    const titleEl = document.createElement('h2');
    titleEl.className = 'stock-explainer-title';
    titleEl.textContent = 'Stock Basics';
    header.appendChild(titleEl);
    if (options.introText) {
      const descEl = document.createElement('p');
      descEl.className = 'stock-explainer-intro';
      descEl.textContent = options.introText;
      header.appendChild(descEl);
    }
    const legendEl = document.createElement('div');
    legendEl.className = 'stock-explainer-legend';
    legendEl.innerHTML = `
      <span class="stock-explainer-legend-heading">America's top public companies</span>
      <span class="stock-explainer-legend-label">Often called “the S&amp;P 500”—about 500 of the largest U.S. stocks, shown by sector and size</span>
    `;
    header.appendChild(legendEl);
    root.appendChild(header);

    const wrap = document.createElement('div');
    wrap.className = 'stock-explainer';

    // Panel 1: What is a stock? — comic-strip style
    const panel1 = document.createElement('div');
    panel1.className = 'explainer-panel explainer-comic';
    panel1.innerHTML = `
      <h3 class="viz-title explainer-section-title">What is a stock?</h3>
      <div class="explainer-steps">
        <div class="explainer-step">
          <span>A company needs money to grow</span>
        </div>
        <div class="explainer-step-arrow">→</div>
        <div class="explainer-step">
          <span>It sells <em>shares</em> (pieces of itself)</span>
        </div>
        <div class="explainer-step-arrow">→</div>
        <div class="explainer-step">
          <span>You buy shares = you <strong>own</strong> part of the company</span>
        </div>
        <div class="explainer-step-arrow">→</div>
        <div class="explainer-step explainer-step-highlight">
          <span>Price goes up? You can sell for profit. Down? You might lose.</span>
        </div>
      </div>
    `;
    wrap.appendChild(panel1);

    const panelNvda = document.createElement('div');
    panelNvda.className = 'explainer-panel explainer-nvda-sample';
    panelNvda.innerHTML = buildNvdaSamplePanelHtml(Array.isArray(companies) ? companies : []);
    wrap.appendChild(panelNvda);
    const nvdaCard = panelNvda.querySelector('.explainer-nvda-card');
    if (nvdaCard) attachNvdaSampleHints(nvdaCard);
    (async () => {
      if (!nvdaCard) return;
      try {
        const hist = await loadUSStock('NVDA');
        renderNvdaTrendChart(nvdaCard, hist);
      } catch (e) {
        console.warn('NVDA explainer chart:', e);
        const wrap = nvdaCard.querySelector('.explainer-nvda-chart-wrap');
        const st = nvdaCard.querySelector('.explainer-nvda-chart-status');
        const fb = nvdaCard.querySelector('.explainer-nvda-chart-fallback');
        if (st) st.hidden = true;
        if (fb) {
          fb.hidden = false;
          fb.textContent = 'Could not load price history. Try refreshing.';
        }
        wrap?.classList.remove('explainer-nvda-chart-wrap--loading');
        wrap?.setAttribute('aria-busy', 'false');
      }
    })();

    // Panel 2: S&P 500 by sector — donut / horizontal bars
    const panel2 = document.createElement('div');
    panel2.className = 'explainer-panel explainer-sectors';
    const sectorList = sectors
      .slice(0, 8)
      .map(
        (s) =>
          `<div class="explainer-sector-row">
            <span class="explainer-sector-name">${s.sector}</span>
            <div class="explainer-sector-bar-wrap">
              <div class="explainer-sector-bar" style="width:${totalCap ? (s.marketCap / totalCap) * 100 : 0}%"></div>
            </div>
            <span class="explainer-sector-pct">${totalCap ? ((s.marketCap / totalCap) * 100).toFixed(1) : 0}%</span>
          </div>`
      )
      .join('');
    panel2.innerHTML = `
      <h3 class="viz-title explainer-section-title">America's top ~500 stocks, sliced by industry</h3>
      <p class="viz-caption-desc explainer-section-desc">Analysts track a basket of about <strong>500 of the largest U.S. companies</strong> people can invest in (commonly called the “S&amp;P 500”). Here are those companies grouped by <strong>sector</strong>—technology is usually the biggest slice!—by total market value.</p>
      <div class="explainer-sector-list">${sectorList}</div>
    `;
    wrap.appendChild(panel2);

    // Panel 3: Price over time — playful line
    let panel3Html = '';
    if (indexData?.length >= 2) {
      const parsed = indexData.map((d) => ({
        date: new Date(d.Date),
        value: parseFloat(d['S&P500'] || d.S_P500 || d.close) || 0,
      }));
      const extent = [parsed[0].value, parsed[parsed.length - 1].value];
      const pctChange = extent[0] ? (((extent[1] - extent[0]) / extent[0]) * 100).toFixed(1) : '?';
      const yearStart = parsed[0].date.getFullYear();
      const yearEnd = parsed[parsed.length - 1].date.getFullYear();

      panel3Html = `
        <h3 class="viz-title explainer-section-title">The ride: that same basket of top U.S. stocks (${yearStart}–${yearEnd})</h3>
        <p class="viz-caption-desc explainer-section-desc">Prices don't move in a straight line. This line tracks the combined value of those ~500 big U.S. stocks over time — overall it was up <strong>${pctChange}%</strong> in our data range (with plenty of bumps).</p>
        <div class="explainer-chart-wrap">
          <svg class="explainer-mini-chart" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path class="explainer-line" d="" fill="none" stroke-width="3"/>
          </svg>
        </div>
      `;
    } else {
      panel3Html = `
        <h3 class="viz-title explainer-section-title">The ride: Stocks go up... and down</h3>
        <p class="viz-caption-desc explainer-section-desc">Stock prices change every day. Sometimes they rise, sometimes they fall. That's the market!</p>
      `;
    }
    const panel3 = document.createElement('div');
    panel3.className = 'explainer-panel explainer-ride';
    panel3.innerHTML = panel3Html;
    wrap.appendChild(panel3);

    // Panel 4: GICS drill-down
    const panel4 = document.createElement('div');
    panel4.className = 'explainer-panel explainer-gics';
    panel4.innerHTML = `
      <div class="explainer-gics-heading-row">
        <h3 class="viz-title explainer-section-title">Explore the GICS Hierarchy</h3>
        <button type="button" class="gics-help-btn" aria-label="What is this section?">?</button>
      </div>
      <div class="gics-help-popup" role="dialog" aria-hidden="true">
        <div class="gics-help-popup-inner">
          <button type="button" class="gics-help-popup-close" aria-label="Close">×</button>
          <h4 class="gics-help-popup-title">What is the GICS Hierarchy?</h4>
          <p class="gics-help-popup-text">GICS (Global Industry Classification Standard) organizes companies into a tree: <strong>Sector → Industry Group → Industry → Sub-Industry</strong>. Use this to find S&P 500 companies by sector—click a sector to see which stocks are in it, then click a symbol to explore that company. Helps you compare investments in the same industry.</p>
        </div>
      </div>
      <p class="viz-caption-desc explainer-section-desc">Ring sizes match each sector's share of market value. Click a sector to see companies—then click a ticker to explore that stock.</p>
      <div class="explainer-gics-chart-legend-row">
        <div class="explainer-gics-chart-col">
          <div class="explainer-gics-tree" aria-label="GICS sectors chart"></div>
        </div>
        <aside class="explainer-gics-legend-col" aria-label="Sectors">
          <ul class="explainer-gics-legend-list"></ul>
        </aside>
      </div>
    `;
    const gicsHelpBtn = panel4.querySelector('.gics-help-btn');
    const gicsHelpPopup = panel4.querySelector('.gics-help-popup');
    gicsHelpBtn?.addEventListener('click', () => {
      const shown = gicsHelpPopup.getAttribute('aria-hidden') !== 'true';
      gicsHelpPopup.setAttribute('aria-hidden', String(shown));
      gicsHelpPopup.classList.toggle('gics-help-popup-visible', !shown);
    });
    const closePopup = () => {
      gicsHelpPopup?.setAttribute('aria-hidden', 'true');
      gicsHelpPopup?.classList.remove('gics-help-popup-visible');
    };
    gicsHelpPopup?.addEventListener('click', (e) => {
      if (e.target === gicsHelpPopup) closePopup();
    });
    panel4.querySelector('.gics-help-popup-close')?.addEventListener('click', closePopup);
    wrap.appendChild(panel4);

    // Panel 5: Tutorial — Interactive good vs bad stock comparison
    const panel5 = document.createElement('div');
    panel5.className = 'explainer-panel explainer-tutorial';
    panel5.innerHTML = `
      <h3 class="viz-title explainer-section-title">Tutorial: How to Read a Stock</h3>
      <p class="viz-caption-desc explainer-section-desc"><strong>Time brush (gold bar under each chart):</strong> In data viz, a “brush” is a draggable window on a timeline. <strong>Drag the ends or the middle</strong> of that gold bar to pick a shorter date range—the big chart zooms to match so you can focus on one period. Click <strong>Reset zoom</strong> to see the full range again. <strong>Hover</strong> the main chart for prices; <strong>click</strong> for a simple “what if you bought then?” return; <strong>click gold dots along the top</strong> for event notes; use <strong>?</strong> next to metrics for definitions.</p>
      <div class="tutorial-charts-row">
        <div class="tutorial-chart-panel tutorial-chart-good">
          <h4 class="tutorial-chart-title">Strong stock: Apple (AAPL)</h4>
          <p class="tutorial-chart-subtitle">Steady growth from 2004 to 2016</p>
          <div class="tutorial-chart-container" data-symbol="AAPL"></div>
        </div>
        <div class="tutorial-chart-panel tutorial-chart-bad">
          <h4 class="tutorial-chart-title">Struggling stock: General Electric (GE)</h4>
          <p class="tutorial-chart-subtitle">Decline from 2015 to 2017</p>
          <div class="tutorial-chart-container" data-symbol="GE"></div>
        </div>
      </div>
    `;

    // Load stock data and render interactive charts (panel lives in #story-tutorial-anchor)
    (async () => {
      const goodContainer = panel5.querySelector('.tutorial-chart-good .tutorial-chart-container');
      const badContainer = panel5.querySelector('.tutorial-chart-bad .tutorial-chart-container');
      if (!goodContainer || !badContainer) return;

      try {
        const [aaplRaw, geRaw, events] = await Promise.all([
          loadUSStock('AAPL'),
          loadUSStock('GE'),
          loadFinancialEvents(),
        ]);

        const startAAPL = new Date('2004-01-01');
        const endAAPL = new Date('2016-12-31');
        const aapl = (aaplRaw || []).filter((d) => d.date >= startAAPL && d.date <= endAAPL);

        const startGE = new Date('2015-01-01');
        const endGE = new Date('2017-12-31');
        const ge = (geRaw || []).filter((d) => d.date >= startGE && d.date <= endGE);

        if (aapl.length) {
          renderTutorialStockChart(goodContainer, {
            ohlcv: aapl,
            symbol: 'AAPL',
            name: 'Apple',
            type: 'good',
            marketCap: 750e9,
            events,
          });
        } else {
          goodContainer.innerHTML = '<p class="tutorial-chart-error">Could not load AAPL data.</p>';
        }

        if (ge.length) {
          renderTutorialStockChart(badContainer, {
            ohlcv: ge,
            symbol: 'GE',
            name: 'General Electric',
            type: 'bad',
            marketCap: 200e9,
            events,
          });
        } else {
          badContainer.innerHTML = '<p class="tutorial-chart-error">Could not load GE data.</p>';
        }
      } catch (e) {
        console.warn('Tutorial charts failed to load:', e);
        goodContainer.innerHTML = '<p class="tutorial-chart-error">Could not load stock data. Try refreshing.</p>';
        badContainer.innerHTML = '';
      }
    })();

    root.appendChild(wrap);

    const tutorialHost = document.getElementById('story-tutorial-anchor');
    if (tutorialHost) {
      tutorialHost.innerHTML = '';
      tutorialHost.appendChild(panel5);
    } else {
      wrap.appendChild(panel5);
    }

    // Load and render GICS concentric chart
    (async () => {
      try {
        const gicsRows = await loadGicsMap();
        const gicsTree = buildGicsTree(gicsRows);
        const companyData = mapCompaniesToGics(Array.isArray(companies) ? companies : [], gicsTree);
        const mergedTree = mergeCompaniesIntoTree(gicsTree, companyData);
        const totalCap = mergedTree.reduce((s, x) => s + (x.marketCap || 0), 0);
        const treeEl = panel4.querySelector('.explainer-gics-tree');
        const legendListEl = panel4.querySelector('.explainer-gics-legend-list');
        renderGicsSectorLegend(legendListEl, mergedTree);
        renderGicsConcentricChart(treeEl, mergedTree, (sector) => {
          showSectorPopup(sector, totalCap, panel4);
        });
      } catch (e) {
        console.warn('Could not load GICS:', e);
        panel4.querySelector('.explainer-gics-tree').innerHTML =
          '<p class="explainer-gics-error">GICS data could not be loaded.</p>';
      }
    })();
    container.appendChild(root);

    // Draw the mini line chart with D3
    if (indexData?.length >= 2) {
      await new Promise((r) => requestAnimationFrame(r));
      const svgEl = wrap.querySelector('.explainer-mini-chart');
      const pathEl = wrap.querySelector('.explainer-line');
      if (svgEl && pathEl) {
        const parsed = indexData.map((d) => ({
          date: new Date(d.Date),
          value: parseFloat(d['S&P500'] || d.S_P500 || d.close) || 0,
        }));
        const x = d3.scaleTime().domain(d3.extent(parsed, (d) => d.date)).range([10, 390]);
        const y = d3.scaleLinear().domain(d3.extent(parsed, (d) => d.value)).range([110, 10]);
        const line = d3.line().x((d) => x(d.date)).y((d) => y(d.value)).curve(d3.curveMonotoneX);
        pathEl.setAttribute('d', line(parsed));
      }
    }
  }

  unmount() {
    document.getElementById('story-tutorial-anchor')?.replaceChildren();
    this.container?.querySelector('.stock-explainer-root')?.remove();
    super.unmount();
  }
}
