/**
 * Spotify-style horizontal personalized results modal.
 * Left/right arrows, smooth transitions, best/worst case viz.
 */

import * as DataLoader from '../data/DataLoader.js';

const SLIDE_COUNT = 3;

function getStartDate(data) {
  if (!data) return null;
  if (data.start_mode === 'birth') return data.dob ? new Date(data.dob) : null;
  if (data.start_mode === 'date' && data.start_date) return new Date(data.start_date);
  return null;
}

function formatDateLabel(d) {
  if (!d || !(d instanceof Date)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sparklineSvgPath(prices) {
  if (!prices?.length) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 140;
  const h = 48;
  const step = (w - 4) / Math.max(1, prices.length - 1);
  const pts = prices.map((p, i) => {
    const x = 2 + i * step;
    const y = h - 2 - ((p - min) / range) * (h - 4);
    return `${x},${y}`;
  });
  return `M ${pts.join(' L ')}`;
}

/**
 * Build candidate symbols from all US stocks. Prioritizes S&P 500 (by market cap),
 * then adds other US symbols for small caps and extreme gainers/decliners.
 */
function buildCandidateSymbols(usStockSymbols, sp500Companies, maxSymbols = 500) {
  const allSymbols = usStockSymbols || [];
  const seen = new Set();
  const candidates = [];

  // S&P 500 first, sorted by market cap (largest = more likely to have data)
  const sp500 = [...(sp500Companies || [])]
    .filter((r) => r.Symbol && !r.Symbol.includes('.'))
    .sort((a, b) => (parseFloat(b.Marketcap) || 0) - (parseFloat(a.Marketcap) || 0));
  for (const c of sp500) {
    const s = c.Symbol.toUpperCase();
    if (!seen.has(s)) {
      seen.add(s);
      candidates.push(c.Symbol);
    }
  }

  // Add other US symbols (small caps, mid caps) for wider gain/loss range
  for (const sym of allSymbols) {
    if (candidates.length >= maxSymbols) break;
    const s = String(sym).toUpperCase();
    if (s.includes('.') || s.length > 6 || seen.has(s)) continue;
    seen.add(s);
    candidates.push(s);
  }

  return candidates.slice(0, maxSymbols);
}

async function loadStockReturnsForSymbols(symbols, sp500Companies, startDate) {
  if (!startDate || !symbols?.length) return [];
  const startTime = startDate.getTime();
  const candidateSymbols = symbols.map((s) => String(s).toUpperCase()).filter(Boolean);

  const results = [];
  const batchSize = 10;
  for (let i = 0; i < candidateSymbols.length; i += batchSize) {
    const batch = candidateSymbols.slice(i, i + batchSize);
    const loaded = await Promise.all(
      batch.map(async (sym) => {
        try {
          const rows = await DataLoader.loadUSStock(sym);
          if (!rows?.length) return null;
          const sortedRows = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
          const startIdx = sortedRows.findIndex((r) => r.date.getTime() >= startTime);
          if (startIdx < 0) return null;
          const series = sortedRows.slice(startIdx);
          const firstRow = series[0];
          const lastRow = series[series.length - 1];
          const startPrice = firstRow.close;
          const endPrice = lastRow.close;
          const pctChange = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
          const meta = sp500Companies?.find((c) => c.Symbol?.toUpperCase() === sym.toUpperCase());
          const prices = series.map((r) => r.close);
          const timeSeries = series.map((r) => ({ date: r.date, close: r.close }));
          return {
            symbol: sym,
            name: meta?.Shortname || meta?.Longname || sym,
            startPrice,
            endPrice,
            pctChange,
            priceHistory: prices,
            timeSeries,
            startDate: firstRow.date,
          };
        } catch {
          return null;
        }
      })
    );
    results.push(...loaded.filter(Boolean));
  }
  return results;
}

async function loadStockReturns(usStockSymbols, sp500Companies, startDate) {
  if (!startDate) return [];
  const startTime = startDate.getTime();
  const candidateSymbols = buildCandidateSymbols(usStockSymbols, sp500Companies, 500);
  if (!candidateSymbols.length) return [];

  const results = [];
  const batchSize = 10;
  for (let i = 0; i < candidateSymbols.length; i += batchSize) {
    const batch = candidateSymbols.slice(i, i + batchSize);
    const loaded = await Promise.all(
      batch.map(async (sym) => {
        try {
          const rows = await DataLoader.loadUSStock(sym);
          if (!rows?.length) return null;
          const sortedRows = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
          const startIdx = sortedRows.findIndex((r) => r.date.getTime() >= startTime);
          if (startIdx < 0) return null;
          const series = sortedRows.slice(startIdx);
          const firstRow = series[0];
          const lastRow = series[series.length - 1];
          const startPrice = firstRow.close;
          const endPrice = lastRow.close;
          const pctChange = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
          const meta = sp500Companies?.find((c) => c.Symbol?.toUpperCase() === sym.toUpperCase());
          const prices = series.map((r) => r.close);
          const timeSeries = series.map((r) => ({ date: r.date, close: r.close }));
          return {
            symbol: sym,
            name: meta?.Shortname || meta?.Longname || sym,
            startPrice,
            endPrice,
            pctChange,
            priceHistory: prices,
            timeSeries,
            startDate: firstRow.date,
          };
        } catch {
          return null;
        }
      })
    );
    results.push(...loaded.filter(Boolean));
  }
  return results;
}

/**
 * Compute portfolio value over time. Aligns dates across stocks (forward-fill).
 * @returns {{ date: Date, value: number }[]}
 */
function computePortfolioValueOverTime(companies, allocations, initialMoney) {
  if (!companies?.length || !allocations?.length) return [];
  const allocs = companies.map((c, i) => (allocations[i] ?? 100 / companies.length) / 100);
  const allDates = new Set();
  companies.forEach((c) => {
    (c.timeSeries || []).forEach((r) => allDates.add(r.date.getTime()));
  });
  const sortedDates = Array.from(allDates).sort((a, b) => a - b).map((t) => new Date(t));
  if (!sortedDates.length) return [];

  const getPriceAt = (company, targetTime) => {
    const ts = company.timeSeries || [];
    let last = company.startPrice;
    for (const r of ts) {
      if (r.date.getTime() <= targetTime) last = r.close;
      else break;
    }
    return last;
  };

  return sortedDates.map((date) => {
    const t = date.getTime();
    let value = 0;
    companies.forEach((c, i) => {
      const price = getPriceAt(c, t);
      const invested = initialMoney * allocs[i];
      const growth = c.startPrice > 0 ? price / c.startPrice : 1;
      value += invested * growth;
    });
    return { date, value };
  });
}

function computePortfolioValue(companies, allocations, initialMoney) {
  if (!companies?.length || !allocations?.length || companies.length !== allocations.length) return null;
  let finalValue = 0;
  companies.forEach((c, i) => {
    const pct = allocations[i] / 100;
    const invested = initialMoney * pct;
    const growth = 1 + c.pctChange / 100;
    finalValue += invested * growth;
  });
  return finalValue;
}

const NUM_ANIM_DURATION = 4200;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateNumber(el, target, opts = {}) {
  const { prefix = '', suffix = '', decimals = 0 } = opts;
  const start = 0;
  el.textContent = `${prefix}0${suffix}`;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / NUM_ANIM_DURATION);
    const eased = easeOutCubic(t);
    const current = start + (target - start) * eased;
    const val = decimals === 0 ? Math.round(current) : current.toFixed(decimals);
    const formatted = decimals > 0 ? Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
    el.textContent = `${prefix}${formatted}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function runNumberAnimations(container) {
  if (!container) return;
  container.querySelectorAll('.animate-num').forEach((el) => {
    const target = parseFloat(el.dataset.target);
    if (isNaN(target)) return;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals, 10) || 0;
    animateNumber(el, target, { prefix, suffix, decimals });
  });
}

function renderBestViz(container, data) {
  if (!container || !data) return;
  const { companies, allocations, initialMoney, finalValue, startDateLabel } = data;
  const gain = finalValue - initialMoney;
  const pctGain = initialMoney > 0 ? (gain / initialMoney) * 100 : 0;

  container.innerHTML = `
    <div class="personalize-viz-best">
      <div class="personalize-viz-hero">
        <span class="personalize-viz-label">Your portfolio would be worth</span>
        <span class="personalize-viz-value personalize-viz-value-positive"><span class="animate-num" data-target="${finalValue}" data-prefix="$" data-decimals="0"></span></span>
        <span class="personalize-viz-gain"><span class="animate-num" data-target="${gain}" data-prefix="+$" data-decimals="0"></span> (<span class="animate-num" data-target="${pctGain}" data-prefix="${pctGain >= 0 ? '+' : ''}" data-suffix="%" data-decimals="1"></span>)</span>
        <p class="personalize-viz-desc">If you had invested $${initialMoney.toLocaleString(undefined, { maximumFractionDigits: 0 })} in the top performers${startDateLabel ? ` from ${startDateLabel}` : ''}, here’s how each pick would have grown.</p>
      </div>
      <div class="personalize-viz-breakdown">
        <h3>Top performers</h3>
        <ul class="personalize-viz-list">
          ${companies
            .map(
              (c, i) => {
                const pct = allocations[i] ?? 100 / companies.length;
                const invested = (initialMoney * pct) / 100;
                const finalAmt = invested * (1 + c.pctChange / 100);
                const pathD = c.priceHistory?.length ? sparklineSvgPath(c.priceHistory) : '';
                return `
            <li class="personalize-viz-row">
              <div class="personalize-viz-row-main">
                <span class="personalize-viz-symbol">${c.symbol}</span>
                <span class="personalize-viz-name">${(c.name || c.symbol).slice(0, 36)}</span>
                <span class="personalize-viz-pct">${pct.toFixed(1)}%</span>
                <span class="personalize-viz-return positive">+${c.pctChange.toFixed(1)}%</span>
              </div>
              ${pathD ? `<svg class="personalize-viz-sparkline" viewBox="0 0 140 48" preserveAspectRatio="none" aria-hidden="true"><path d="${pathD}" fill="none" stroke="var(--accent-green)" stroke-width="2"/></svg>` : ''}
              <p class="personalize-viz-row-desc">Investing $${invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}${c.startDate ? ` at ${formatDateLabel(c.startDate)}` : ''} → $<span class="animate-num" data-target="${finalAmt}" data-decimals="0"></span> now (+$<span class="animate-num" data-target="${finalAmt - invested}" data-decimals="0"></span> earned)</p>
            </li>`;
              }
            )
            .join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderOwnPicksViz(container, data) {
  if (!container || !data) return;
  const { companies, allocations, initialMoney, finalValue, startDateLabel } = data;
  const gain = finalValue - initialMoney;
  const pctChange = initialMoney > 0 ? (gain / initialMoney) * 100 : 0;
  const isGain = gain >= 0;
  const gainAbs = Math.abs(gain);
  const pctAbs = Math.abs(pctChange);

  container.innerHTML = `
    <div class="personalize-viz-own">
      <div class="personalize-viz-hero">
        <span class="personalize-viz-label">Your portfolio would be worth</span>
        <span class="personalize-viz-value ${isGain ? 'personalize-viz-value-positive' : 'personalize-viz-value-below'}"><span class="animate-num" data-target="${finalValue}" data-prefix="$" data-decimals="0"></span></span>
        <span class="personalize-viz-gain ${isGain ? '' : 'negative'}">${isGain ? '+' : '−'}$<span class="animate-num" data-target="${gainAbs}" data-decimals="0"></span> (${isGain ? '+' : '−'}<span class="animate-num" data-target="${pctAbs}" data-suffix="%" data-decimals="1"></span>)</span>
        <p class="personalize-viz-desc">${isGain ? 'You would have earned money' : 'You would have lost money'} on your chosen allocation${startDateLabel ? ` from ${startDateLabel}` : ''}.</p>
      </div>
      <div class="personalize-viz-breakdown">
        <h3>Your picks</h3>
        <ul class="personalize-viz-list">
          ${companies
            .map(
              (c, i) => {
                const pct = allocations[i] ?? 100 / companies.length;
                const invested = (initialMoney * pct) / 100;
                const finalAmt = invested * (1 + c.pctChange / 100);
                const earned = finalAmt - invested;
                const earnedAbs = Math.abs(earned);
                const pathD = c.priceHistory?.length ? sparklineSvgPath(c.priceHistory) : '';
                const rowClass = c.pctChange >= 0 ? 'positive' : 'negative';
                return `
            <li class="personalize-viz-row">
              <div class="personalize-viz-row-main">
                <span class="personalize-viz-symbol">${c.symbol}</span>
                <span class="personalize-viz-name">${(c.name || c.symbol).slice(0, 36)}</span>
                <span class="personalize-viz-pct">${pct.toFixed(1)}%</span>
                <span class="personalize-viz-return ${rowClass}">${c.pctChange >= 0 ? '+' : ''}${c.pctChange.toFixed(1)}%</span>
              </div>
              ${pathD ? `<svg class="personalize-viz-sparkline" viewBox="0 0 140 48" preserveAspectRatio="none" aria-hidden="true"><path d="${pathD}" fill="none" stroke="${c.pctChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}" stroke-width="2"/></svg>` : ''}
              <p class="personalize-viz-row-desc">Investing $${invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}${c.startDate ? ` at ${formatDateLabel(c.startDate)}` : ''} → $<span class="animate-num" data-target="${finalAmt}" data-decimals="0"></span> now (${earned >= 0 ? '+' : '−'}$<span class="animate-num" data-target="${earnedAbs}" data-decimals="0"></span>)</p>
            </li>`;
              }
            )
            .join('')}
        </ul>
      </div>
    </div>
  `;
}

/**
 * Align a series to a unified date range (forward-fill) so all lines span the full chart.
 */
function alignSeriesToDates(series, allDates, initialMoney) {
  if (!allDates?.length) return [];
  const sorted = [...allDates].sort((a, b) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? b.getTime() : b));
  if (!series?.length) return [];
  let idx = 0;
  let lastVal = initialMoney;
  return sorted.map((d) => {
    const t = d instanceof Date ? d.getTime() : d;
    const dObj = d instanceof Date ? d : new Date(d);
    while (idx < series.length && series[idx].date.getTime() <= t) {
      lastVal = series[idx].value;
      idx++;
    }
    return { date: dObj, value: lastVal };
  });
}

/**
 * Render comparison line chart: best (green), worst (red), your (white), baseline (gold).
 * Shaded areas: red between yours–worst, green between yours–best. Floating company bubbles.
 * @param {HTMLElement} container
 * @param {{ bestSeries: {date:Date,value:number}[], worstSeries: {date:Date,value:number}[], yourSeries: {date:Date,value:number}[], initialMoney: number, companies?: {symbol:string}[] }}
 */
function renderComparisonChart(container, { bestSeries, worstSeries, yourSeries, initialMoney, companies = [] }) {
  const d3 = globalThis.d3;
  if (!container || !d3) return;
  const hasData = (bestSeries?.length || worstSeries?.length || yourSeries?.length);
  if (!hasData) {
    container.innerHTML = '<p class="personalize-loading">Not enough data for comparison.</p>';
    return;
  }

  const margin = { top: 24, right: 28, bottom: 44, left: 60 };
  const width = Math.min(640, Math.max(520, (container.clientWidth || 700) - margin.left - margin.right));
  const height = 300;

  container.innerHTML = '';

  const explanation = container.appendChild(document.createElement('p'));
  explanation.className = 'personalize-comparison-explanation';
  explanation.innerHTML = `This chart shows how your portfolio value would have changed over time compared with two hypothetical extremes. <strong>Best</strong> (green) is an equal-weighted portfolio of the top performers; <strong>Worst</strong> (red) is the same for the biggest decliners. The <strong>red shaded area</strong> is the gap between your strategy and worst—more red means you stayed further above the worst outcome. The <strong>green shaded area</strong> is the gap between your strategy and best—it shows how much room there was to improve. The <strong>gold dashed line</strong> is your original investment amount.`;

  const allDates = new Set();
  [bestSeries, worstSeries, yourSeries].forEach((s) => (s || []).forEach((d) => allDates.add(d.date.getTime())));
  const sortedDates = Array.from(allDates).sort((a, b) => a - b).map((t) => new Date(t));
  const xDomain = d3.extent(sortedDates);

  const bestAligned = alignSeriesToDates(bestSeries, sortedDates, initialMoney);
  let worstAligned = alignSeriesToDates(worstSeries, sortedDates, initialMoney);
  const yourAligned = alignSeriesToDates(yourSeries, sortedDates, initialMoney);

  if (!worstAligned.length && worstSeries?.length) {
    worstAligned = worstSeries;
  }

  const allValues = [...bestAligned.map((d) => d.value), ...worstAligned.map((d) => d.value), ...yourAligned.map((d) => d.value), initialMoney];
  const valMin = Math.min(...allValues);
  const valMax = Math.max(...allValues);
  const yMin = Math.min(0, valMin) - 100;
  const yMax = Math.max(valMax, initialMoney) * 1.05;
  const yDomain = [yMin, yMax];

  const xScale = d3.scaleTime().domain(xDomain).range([0, width]);
  const yScale = d3.scaleLinear().domain(yDomain).range([height, 0]);

  const line = d3.line().defined((d) => d != null && !Number.isNaN(d.value)).x((d) => xScale(d.date)).y((d) => yScale(d.value)).curve(d3.curveMonotoneX);

  const area = d3.area().defined((d) => d != null && !Number.isNaN(d.y0) && !Number.isNaN(d.y1)).x((d) => xScale(d.date)).y0((d) => yScale(d.y0)).y1((d) => yScale(d.y1)).curve(d3.curveMonotoneX);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'personalize-comparison-chart')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg.append('g').attr('transform', `translate(0,${height})`).attr('class', 'personalize-comparison-x').call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%b %Y')));
  svg.append('g').attr('class', 'personalize-comparison-y').call(d3.axisLeft(yScale).ticks(5).tickFormat((v) => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toString())));

  // Shaded areas (drawn under lines)
  const n = Math.min(yourAligned.length, worstAligned.length, bestAligned.length);
  if (n > 0) {
    const redBandData = yourAligned.slice(0, n).map((d, i) => ({
      date: d.date,
      y0: Math.min(worstAligned[i].value, d.value),
      y1: Math.max(worstAligned[i].value, d.value),
    }));
    const greenBandData = yourAligned.slice(0, n).map((d, i) => ({
      date: d.date,
      y0: Math.min(d.value, bestAligned[i].value),
      y1: Math.max(d.value, bestAligned[i].value),
    }));
    svg.append('path').attr('d', area(redBandData)).attr('fill', 'rgba(255,68,68,0.25)').attr('class', 'personalize-comparison-area personalize-comparison-area-red');
    svg.append('path').attr('d', area(greenBandData)).attr('fill', 'rgba(34,197,94,0.25)').attr('class', 'personalize-comparison-area personalize-comparison-area-green');
  }

  const baselineData = [{ date: xDomain[0], value: initialMoney }, { date: xDomain[1], value: initialMoney }];
  svg.append('path').attr('d', line(baselineData)).attr('fill', 'none').attr('stroke', '#d4af37').attr('stroke-width', 2).attr('stroke-dasharray', '5,4').attr('class', 'personalize-comparison-baseline');

  if (bestAligned.length) {
    svg.append('path').attr('d', line(bestAligned)).attr('fill', 'none').attr('stroke', '#22c55e').attr('stroke-width', 2).attr('class', 'personalize-comparison-line personalize-comparison-best');
  }
  if (worstAligned.length) {
    svg.append('path').attr('d', line(worstAligned)).attr('fill', 'none').attr('stroke', '#ff4444').attr('stroke-width', 3).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('class', 'personalize-comparison-line personalize-comparison-worst');
  }
  if (yourAligned.length) {
    svg.append('path').attr('d', line(yourAligned)).attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-width', 2).attr('class', 'personalize-comparison-line personalize-comparison-yours');
  }

  // Floating company bubbles (kept fully inside chart area; radius 20)
  const bubbleR = 20;
  const pad = bubbleR + 10;
  const symbols = (companies || []).map((c) => c?.symbol).filter(Boolean).slice(0, 12);
  if (symbols.length > 0) {
    const bubblesGroup = svg.append('g').attr('class', 'personalize-comparison-bubbles');
    const innerW = width - 2 * pad;
    const innerH = height - 2 * pad;
    const bubbleData = symbols.map((symbol, i) => {
      const baseX = pad + Math.max(0, Math.min(1, 0.15 + 0.7 * (0.3 + 0.5 * Math.sin(i * 1.7)))) * innerW;
      const baseY = pad + Math.max(0, Math.min(1, 0.2 + 0.6 * (0.3 + 0.5 * Math.cos(i * 2.1)))) * innerH;
      return { symbol, baseX, baseY, phase: i * 0.8 };
    });
    bubblesGroup
      .selectAll('g.personalize-comparison-bubble')
      .data(bubbleData)
      .join('g')
      .attr('class', 'personalize-comparison-bubble')
      .attr('transform', (d) => `translate(${d.baseX},${d.baseY})`)
      .style('cursor', 'default')
      .attr('aria-hidden', 'true')
      .each(function (d) {
        const g = d3.select(this);
        const inner = g.append('g').attr('class', 'personalize-comparison-bubble-float').style('animation-delay', `-${d.phase}s`);
        inner
          .append('circle')
          .attr('r', 20)
          .attr('fill', 'rgba(212,175,55,0.28)')
          .attr('stroke', 'rgba(212,175,55,0.65)')
          .attr('stroke-width', 1.5)
          .attr('class', 'personalize-comparison-bubble-circle');
        inner
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', 'rgba(255,255,255,0.95)')
          .attr('font-size', '10px')
          .attr('font-weight', '600')
          .attr('pointer-events', 'none')
          .text(d.symbol);
      });
  }

  const legend = container.appendChild(document.createElement('div'));
  legend.className = 'personalize-comparison-legend';
  legend.innerHTML = `
    <span class="personalize-comparison-legend-item"><span class="personalize-comparison-legend-dot" style="background:#22c55e"></span> Best (equal weight)</span>
    <span class="personalize-comparison-legend-item"><span class="personalize-comparison-legend-dot" style="background:#ff4444"></span> Worst (decliners)</span>
    <span class="personalize-comparison-legend-item"><span class="personalize-comparison-legend-dot" style="background:#fff;border:2px solid rgba(255,255,255,0.8)"></span> Your strategy</span>
    <span class="personalize-comparison-legend-item"><span class="personalize-comparison-legend-dot" style="background:#d4af37;border:none"></span> Original $${initialMoney.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
  `;
}

function renderWorstViz(container, data) {
  if (!container || !data) return;
  const { companies, allocations, initialMoney, finalValue, startDateLabel } = data;
  const loss = initialMoney - finalValue;
  const pctLoss = initialMoney > 0 ? (loss / initialMoney) * 100 : 0;
  const lossAbs = Math.abs(loss);
  const pctLossAbs = Math.abs(pctLoss);
  const heroValueClass = finalValue < 0 ? 'personalize-viz-value-negative' : finalValue < initialMoney ? 'personalize-viz-value-below' : 'personalize-viz-value-positive';

  container.innerHTML = `
    <div class="personalize-viz-worst">
      <div class="personalize-viz-hero">
        <span class="personalize-viz-label">Your portfolio would be worth</span>
        <span class="personalize-viz-value ${heroValueClass}"><span class="animate-num" data-target="${finalValue}" data-prefix="$" data-decimals="0"></span></span>
        <span class="personalize-viz-gain negative">−$<span class="animate-num" data-target="${lossAbs}" data-decimals="0"></span> (−<span class="animate-num" data-target="${pctLossAbs}" data-suffix="%" data-decimals="1"></span>)</span>
        <p class="personalize-viz-desc">If you had invested $${initialMoney.toLocaleString(undefined, { maximumFractionDigits: 0 })} in the biggest decliners${startDateLabel ? ` from ${startDateLabel}` : ''}, here’s how much you would have lost from each.</p>
      </div>
      <div class="personalize-viz-breakdown">
        <h3>Biggest decliners</h3>
        <ul class="personalize-viz-list">
          ${companies
            .map(
              (c, i) => {
                const pct = allocations[i] ?? 100 / companies.length;
                const invested = (initialMoney * pct) / 100;
                const finalAmt = invested * (1 + c.pctChange / 100);
                const lost = invested - finalAmt;
                const pathD = c.priceHistory?.length ? sparklineSvgPath(c.priceHistory) : '';
                return `
            <li class="personalize-viz-row">
              <div class="personalize-viz-row-main">
                <span class="personalize-viz-symbol">${c.symbol}</span>
                <span class="personalize-viz-name">${(c.name || c.symbol).slice(0, 36)}</span>
                <span class="personalize-viz-pct">${pct.toFixed(1)}%</span>
                <span class="personalize-viz-return negative">${c.pctChange.toFixed(1)}%</span>
              </div>
              ${pathD ? `<svg class="personalize-viz-sparkline" viewBox="0 0 140 48" preserveAspectRatio="none" aria-hidden="true"><path d="${pathD}" fill="none" stroke="var(--accent-red)" stroke-width="2"/></svg>` : ''}
              <p class="personalize-viz-row-desc">Investing $${invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}${c.startDate ? ` at ${formatDateLabel(c.startDate)}` : ''} → $<span class="animate-num" data-target="${finalAmt}" data-decimals="0"></span> now (−$<span class="animate-num" data-target="${lost}" data-decimals="0"></span> lost)</p>
            </li>`;
              }
            )
            .join('')}
        </ul>
      </div>
    </div>
  `;
}

const MONEY_CHARS = ['$', '¢', '¤'];
const MONEY_COUNT = 28;

function initMoneyBackground(container) {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < MONEY_COUNT; i++) {
    const el = document.createElement('span');
    el.className = 'personalize-money-icon';
    el.textContent = MONEY_CHARS[i % MONEY_CHARS.length];
    el.style.left = `${(i * 37) % 100}%`;
    el.style.animationDelay = `${(i * 0.4) % 8}s`;
    container.appendChild(el);
  }
}

export function initPersonalizeModal(sp500Companies, usStockSymbols = []) {
  const modal = document.getElementById('personalize-modal');
  const moneyBg = document.getElementById('personalize-money-bg');
  const slidesContainer = document.getElementById('personalize-slides');
  const slides = modal?.querySelectorAll('.personalize-slide');
  const navLeft = modal?.querySelector('.personalize-nav-left');
  const navRight = modal?.querySelector('.personalize-nav-right');
  const dotsContainer = document.getElementById('personalize-dots');

  if (!modal || !slides?.length) return;

  initMoneyBackground(moneyBg);

  let currentSlide = 0;
  let bestData = null;
  let worstData = null;
  let slideCount = SLIDE_COUNT;

  function updateNavVisibility() {
    navLeft?.setAttribute('aria-hidden', currentSlide === 0 ? 'true' : 'false');
    navRight?.setAttribute('aria-hidden', currentSlide === slideCount - 1 ? 'true' : 'false');
    dotsContainer?.querySelectorAll('.personalize-dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentSlide);
      d.hidden = i >= slideCount;
    });
    modal?.classList.toggle('personalize-worst-active', currentSlide === 2 && slideCount === 3);
  }

  function goToSlide(index) {
    if (index < 0 || index >= slideCount) return;
    const prevSlide = slides[currentSlide];
    const nextSlide = slides[index];

    prevSlide?.classList.add('personalize-slide-transition-out');
    setTimeout(() => {
      prevSlide?.classList.remove('personalize-slide-transition-out');
      currentSlide = index;
      slidesContainer.style.transform = `translateX(${-index * 100}vw)`;
      nextSlide?.classList.add('personalize-slide-transition-in');
      setTimeout(() => {
        nextSlide?.classList.remove('personalize-slide-transition-in');
        if (index === 1) runNumberAnimations(document.getElementById('personalize-best-viz'));
        else if (index === 2) runNumberAnimations(document.getElementById('personalize-worst-viz'));
      }, 400);
      updateNavVisibility();
    }, 280);
  }

  navLeft?.addEventListener('click', () => goToSlide(currentSlide - 1));
  navRight?.addEventListener('click', () => goToSlide(currentSlide + 1));

  for (let i = 0; i < SLIDE_COUNT; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `personalize-dot${i === 0 ? ' active' : ''}`;
    dot.setAttribute('aria-label', `Go to section ${i + 1}`);
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer?.appendChild(dot);
  }

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
    else if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
  });

  return {
    async loadAndRender(data) {
      const startDate = getStartDate(data);
      const companyCount = Math.min(10, Math.max(1, parseInt(data.company_count, 10) || 4));
      let allocations = (data.allocations || []).slice(0, companyCount).map((a) => parseFloat(a) || 0);
      const initialMoney = parseFloat(data.available_money) || 0;
      const isOwnMode = data.invest_mode === 'own' && data.selected_symbols?.length;
      const isStrategyMode = data.invest_mode === 'plan' && data.strategy && data.strategy !== 'best-worst' && data.selected_symbols?.length;

      const bestVizEl = document.getElementById('personalize-best-viz');
      const worstVizEl = document.getElementById('personalize-worst-viz');

      bestVizEl.innerHTML = '<p class="personalize-loading">Loading…</p>';
      worstVizEl.innerHTML = '<p class="personalize-loading">Loading…</p>';

      let best;
      let worst;
      if (isOwnMode || isStrategyMode) {
        const returns = await loadStockReturnsForSymbols(data.selected_symbols, sp500Companies, startDate);
        best = returns;
        worst = [...returns].sort((a, b) => a.pctChange - b.pctChange).slice(0, companyCount);
        allocations = (data.allocations || []).slice(0, returns.length).map((a) => parseFloat(a) || 0);
        while (allocations.length < best.length) allocations.push(100 / best.length);
      } else {
        const returns = await loadStockReturns(usStockSymbols, sp500Companies, startDate);
        best = [...returns].sort((a, b) => b.pctChange - a.pctChange).slice(0, companyCount);
        worst = [...returns].sort((a, b) => a.pctChange - b.pctChange).slice(0, companyCount);
      }

      const needWorst = !isOwnMode && !isStrategyMode;
      if (!best.length || (needWorst && !worst.length)) {
        bestVizEl.innerHTML = '<p class="personalize-loading">Not enough price data for this period. Try a different start date.</p>';
        worstVizEl.innerHTML = '<p class="personalize-loading">Not enough price data for this period. Try a different start date.</p>';
        return;
      }

      const n = best.length;
      while (allocations.length < n) {
        allocations.push(100 / n);
      }
      const allocsForCalc = allocations.slice(0, n);
      const allocSum = allocsForCalc.reduce((s, x) => s + x, 0);
      const normAllocations = allocSum > 0 ? allocsForCalc.map((a) => (a / allocSum) * 100) : allocsForCalc;
      const symbolToAlloc = new Map(best.map((c, i) => [c.symbol, normAllocations[i]]));
      const worstAllocations = worst.map((c) => symbolToAlloc.get(c.symbol) ?? 100 / worst.length);

      const startDateLabel = startDate ? formatDateLabel(startDate) : '';

      bestData = {
        companies: best,
        allocations: normAllocations,
        initialMoney,
        finalValue: computePortfolioValue(best, normAllocations, initialMoney) ?? initialMoney,
        startDateLabel,
      };
      worstData = {
        companies: worst,
        allocations: worstAllocations,
        initialMoney,
        finalValue: computePortfolioValue(worst, worstAllocations, initialMoney) ?? initialMoney,
        startDateLabel,
      };

      const bestTitleEl = document.querySelector('.personalize-slide-best .personalize-slide-title');
      const bestSubEl = document.querySelector('.personalize-slide-best .personalize-slide-subtitle');
      const worstSlide = document.querySelector('.personalize-slide-worst');
      const worstTitleEl = worstSlide?.querySelector('.personalize-slide-title');
      const worstSubEl = worstSlide?.querySelector('.personalize-slide-subtitle');

      if (isOwnMode) {
        slideCount = 3;
        if (worstSlide) {
          worstSlide.hidden = false;
          const worstTitleEl2 = worstSlide.querySelector('.personalize-slide-title');
          const worstSubEl2 = worstSlide.querySelector('.personalize-slide-subtitle');
          if (worstTitleEl2) worstTitleEl2.textContent = 'Compare strategies';
          if (worstSubEl2) worstSubEl2.textContent = 'Best vs worst vs your allocation over time';
        }
        renderOwnPicksViz(bestVizEl, bestData);
        const topPerformers = [...best].sort((a, b) => b.pctChange - a.pctChange).slice(0, companyCount);
        const topAllocations = topPerformers.map(() => 100 / topPerformers.length);
        const bestSeries = computePortfolioValueOverTime(topPerformers, topAllocations, initialMoney);
        const worstSeries = computePortfolioValueOverTime(worstData.companies, worstAllocations, initialMoney);
        const yourSeries = computePortfolioValueOverTime(bestData.companies, normAllocations, initialMoney);
        renderComparisonChart(worstVizEl, { bestSeries, worstSeries, yourSeries, initialMoney, companies: bestData.companies });
      } else if (isStrategyMode) {
        slideCount = 3;
        if (worstSlide) {
          worstSlide.hidden = false;
          const worstTitleEl2 = worstSlide.querySelector('.personalize-slide-title');
          const worstSubEl2 = worstSlide.querySelector('.personalize-slide-subtitle');
          if (worstTitleEl2) worstTitleEl2.textContent = 'Compare strategies';
          if (worstSubEl2) worstSubEl2.textContent = 'Best vs worst vs the strategy over time';
        }
        const strategyLabel = data.strategy_display_name || (data.strategy || '').replace(/[-_]/g, ' ').replace(/\d{4}-\d{2}-\d{2}/, '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
        if (bestTitleEl) bestTitleEl.textContent = `Strategy picks`;
        if (bestSubEl) bestSubEl.textContent = `How the ${strategyLabel}-style allocation would have performed`;
        renderOwnPicksViz(bestVizEl, bestData);
        const topPerformers = [...best].sort((a, b) => b.pctChange - a.pctChange).slice(0, companyCount);
        const topAllocations = topPerformers.map(() => 100 / topPerformers.length);
        const bestSeries = computePortfolioValueOverTime(topPerformers, topAllocations, initialMoney);
        const worstSeries = computePortfolioValueOverTime(worstData.companies, worstAllocations, initialMoney);
        const yourSeries = computePortfolioValueOverTime(bestData.companies, normAllocations, initialMoney);
        renderComparisonChart(worstVizEl, { bestSeries, worstSeries, yourSeries, initialMoney, companies: bestData.companies });
      } else {
        slideCount = 3;
        if (worstSlide) worstSlide.hidden = false;
        if (bestTitleEl) bestTitleEl.textContent = 'Best case';
        if (bestSubEl) bestSubEl.textContent = 'If you invested in the top performers from your start date';
        if (worstTitleEl) worstTitleEl.textContent = 'Worst case';
        if (worstSubEl) worstSubEl.textContent = 'If you invested in the biggest decliners from your start date';
        renderBestViz(bestVizEl, bestData);
        renderWorstViz(worstVizEl, worstData);
      }

      currentSlide = 0;
      slidesContainer.style.transform = 'translateX(0vw)';
      updateNavVisibility();
    },
  };
}
