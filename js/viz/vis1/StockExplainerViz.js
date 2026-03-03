/**
 * A fun, cartoon-style explainer that teaches "What is a stock?" using real S&P 500 data.
 * Uses sector breakdown and S&P 500 index over time.
 */

import { BaseViz } from '../BaseViz.js';

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

    const wrap = document.createElement('div');
    wrap.className = 'stock-explainer';

    // Panel 1: What is a stock? — comic-strip style
    const panel1 = document.createElement('div');
    panel1.className = 'explainer-panel explainer-comic';
    panel1.innerHTML = `
      <h3 class="explainer-heading">What is a stock?</h3>
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
      <h3 class="explainer-heading">The S&P 500: America's economy in slices</h3>
      <p class="explainer-desc">These ${sectors.reduce((s, x) => s + x.count, 0)} companies are grouped into sectors. Technology is the biggest slice!</p>
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
        <h3 class="explainer-heading">The ride: S&P 500 from ${yearStart} to ${yearEnd}</h3>
        <p class="explainer-desc">Stocks don't go in a straight line. Here's the real S&P 500 index — up <strong>${pctChange}%</strong> over this period (with plenty of bumps along the way).</p>
        <div class="explainer-chart-wrap">
          <svg class="explainer-mini-chart" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path class="explainer-line" d="" fill="none" stroke-width="3"/>
          </svg>
        </div>
      `;
    } else {
      panel3Html = `
        <h3 class="explainer-heading">The ride: Stocks go up... and down</h3>
        <p class="explainer-desc">Stock prices change every day. Sometimes they rise, sometimes they fall. That's the market!</p>
      `;
    }
    const panel3 = document.createElement('div');
    panel3.className = 'explainer-panel explainer-ride';
    panel3.innerHTML = panel3Html;
    wrap.appendChild(panel3);

    container.appendChild(wrap);

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
    this.container?.querySelector('.stock-explainer')?.remove();
    super.unmount();
  }
}
