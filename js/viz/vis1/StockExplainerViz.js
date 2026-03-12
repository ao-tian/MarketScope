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
      <span class="stock-explainer-legend-heading">S&P 500</span>
      <span class="stock-explainer-legend-label">Sector breakdown by market cap</span>
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
      <h3 class="viz-title explainer-section-title">The S&P 500: America's economy in slices</h3>
      <p class="viz-caption-desc explainer-section-desc">These ${sectors.reduce((s, x) => s + x.count, 0)} companies are grouped into sectors. Technology is the biggest slice!</p>
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
        <h3 class="viz-title explainer-section-title">The ride: S&P 500 from ${yearStart} to ${yearEnd}</h3>
        <p class="viz-caption-desc explainer-section-desc">Stocks don't go in a straight line. Here's the real S&P 500 index — up <strong>${pctChange}%</strong> over this period (with plenty of bumps along the way).</p>
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
      <p class="viz-caption-desc explainer-section-desc">Proportions by market cap. Click a sector to see all companies—then click any symbol to explore that stock.</p>
      <div class="explainer-gics-tree"></div>
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
      <p class="viz-caption-desc explainer-section-desc">Explore real price data: <strong>drag the brush</strong> below each chart to zoom into a time range, <strong>hover</strong> for prices, <strong>click</strong> any point to see "what if" return, <strong>click yellow markers</strong> for event details, and use <strong>?</strong> for metric help.</p>
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

    wrap.appendChild(panel5);

    // Load stock data and render interactive charts
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

    // Load and render GICS concentric chart
    (async () => {
      try {
        const gicsRows = await loadGicsMap();
        const gicsTree = buildGicsTree(gicsRows);
        const companyData = mapCompaniesToGics(Array.isArray(companies) ? companies : [], gicsTree);
        const mergedTree = mergeCompaniesIntoTree(gicsTree, companyData);
        const totalCap = mergedTree.reduce((s, x) => s + (x.marketCap || 0), 0);
        const treeEl = panel4.querySelector('.explainer-gics-tree');
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
    this.container?.querySelector('.stock-explainer-root')?.remove();
    super.unmount();
  }
}
