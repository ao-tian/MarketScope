/**
 * Interactive tutorial stock chart: click to explore price at any point.
 * Shows event markers and metrics table with ? tooltips.
 * Requires global d3 (loaded via script tag).
 */

import { getMetricHelpHtml } from './metricHelp.js';

function formatPrice(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toFixed(2)}`;
}

function formatDate(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCap(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

/**
 * @param {HTMLElement} container - Parent element
 * @param {Object} options
 * @param {Array} options.ohlcv - { date, open, high, low, close }
 * @param {string} options.symbol - e.g. AAPL
 * @param {string} options.name - Display name
 * @param {'good'|'bad'} options.type - Affects line color
 * @param {number} [options.marketCap] - For metrics table
 * @param {Array} [options.events] - [{ date, title, category, description }]
 */
export function renderTutorialStockChart(container, options) {
  const { ohlcv, symbol, name, type, marketCap = null, events = [] } = options;
  if (!container || !ohlcv?.length) return;

  container.innerHTML = '';

  const chartWrap = document.createElement('div');
  chartWrap.className = `tutorial-chart-wrap tutorial-chart-${type}`;

  const metricsWrap = document.createElement('div');
  metricsWrap.className = 'tutorial-metrics-wrap';

  const first = ohlcv[0];
  const last = ohlcv[ohlcv.length - 1];
  const open = first?.open ?? first?.close;
  const high = Math.max(...ohlcv.map((d) => d.high));
  const low = Math.min(...ohlcv.map((d) => d.low));
  const close = last?.close ?? 0;
  const endDate = last?.date;
  const for52wk = endDate
    ? ohlcv.filter((d) => d.date <= endDate).slice(-252)
    : ohlcv.slice(-252);
  const week52High = for52wk.length ? Math.max(...for52wk.map((d) => d.high)) : null;
  const week52Low = for52wk.length ? Math.min(...for52wk.map((d) => d.low)) : null;

  const margin = { top: 24, right: 50, bottom: 8, left: 56 };
  const brushHeight = 44;
  const chartWidth = 420;
  const chartHeight = 200 + brushHeight;
  const width = chartWidth - margin.left - margin.right;
  const height = chartHeight - margin.top - margin.bottom - brushHeight;
  const contextY = height + margin.top + 4;

  const fullDomain = d3.extent(ohlcv, (d) => d.date);
  const xContext = d3.scaleTime().domain(fullDomain).range([0, width]);
  const xFocus = d3.scaleTime().domain(fullDomain).range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(ohlcv, (d) => d.close)).nice().range([height, 0]);
  const yContext = d3.scaleLinear().domain(d3.extent(ohlcv, (d) => d.close)).range([brushHeight - 8, 4]);

  const svg = d3
    .select(chartWrap)
    .append('svg')
    .attr('viewBox', `0 0 ${chartWidth} ${chartHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('display', 'block')
    .style('max-width', '100%')
    .style('height', 'auto');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const contextG = svg.append('g').attr('transform', `translate(${margin.left},${contextY})`);

  // Clip chart content so the line never exceeds bounds when zoomed
  const chartClipId = `tutorial-chart-clip-${Math.random().toString(36).slice(2, 9)}`;
  svg
    .append('defs')
    .append('clipPath')
    .attr('id', chartClipId)
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height);

  g.attr('clip-path', `url(#${chartClipId})`);

  const isUp = close >= (first?.close ?? close);
  const line = d3
    .line()
    .x((d) => xFocus(d.date))
    .y((d) => y(d.close))
    .curve(d3.curveMonotoneX);
  const lineContext = d3
    .line()
    .x((d) => xContext(d.date))
    .y((d) => yContext(d.close))
    .curve(d3.curveMonotoneX);

  // Focus chart elements (will be updated when brush changes)
  const focusPath = g.append('path').attr('class', `tutorial-chart-line ${isUp ? 'positive' : 'negative'}`);
  const focusGridX = g.append('g').attr('class', 'tutorial-chart-grid').attr('transform', `translate(0,${height})`);
  const focusGridY = g.append('g').attr('class', 'tutorial-chart-grid');

  function updateFocus() {
    focusPath.datum(ohlcv).attr('d', line);
    focusGridX.call(d3.axisBottom(xFocus).ticks(5).tickSize(-height));
    focusGridY.call(d3.axisLeft(y).ticks(4).tickSize(-width));
    updateEventMarkers();
  }

  // Event popup (for click on marker)
  const eventPopup = document.createElement('div');
  eventPopup.className = 'tutorial-event-popup';
  eventPopup.setAttribute('aria-hidden', 'true');
  eventPopup.innerHTML = `
    <div class="tutorial-event-popup-inner">
      <button type="button" class="tutorial-event-popup-close" aria-label="Close">×</button>
      <div class="tutorial-event-popup-category"></div>
      <h4 class="tutorial-event-popup-title"></h4>
      <p class="tutorial-event-popup-desc"></p>
    </div>
  `;
  container.appendChild(eventPopup);

  function showEventPopup(evt) {
    eventPopup.querySelector('.tutorial-event-popup-category').textContent = evt.category || '';
    eventPopup.querySelector('.tutorial-event-popup-title').textContent = evt.title || 'Event';
    eventPopup.querySelector('.tutorial-event-popup-desc').textContent = evt.description || '';
    eventPopup.setAttribute('aria-hidden', 'false');
    eventPopup.classList.add('tutorial-event-popup-visible');
    eventPopup.querySelector('.tutorial-event-popup-close').onclick = () => hideEventPopup();
  }

  function hideEventPopup() {
    eventPopup.setAttribute('aria-hidden', 'true');
    eventPopup.classList.remove('tutorial-event-popup-visible');
  }

  eventPopup.addEventListener('click', (e) => {
    if (e.target === eventPopup) hideEventPopup();
  });

  const eventLinesGroup = g.append('g').attr('class', 'tutorial-chart-event-lines');

  function updateEventMarkers() {
    const domain = xFocus.domain();
    const minT = domain[0].getTime();
    const maxT = domain[1].getTime();
    const inRange = events.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= minT && t <= maxT;
    });

    eventLinesGroup.selectAll('*').remove();
    eventCirclesGroup.selectAll('*').remove();

    inRange.forEach((evt) => {
      const evtDate = new Date(evt.date);
      const cx = xFocus(evtDate);
      if (cx >= 0 && cx <= width) {
        eventLinesGroup
          .append('line')
          .attr('class', 'tutorial-chart-event-line')
          .attr('x1', cx)
          .attr('y1', 0)
          .attr('x2', cx)
          .attr('y2', height);

        const circle = eventCirclesGroup
          .append('circle')
          .attr('class', 'tutorial-chart-event-bubble')
          .attr('cx', cx)
          .attr('cy', 0)
          .attr('r', 6)
          .attr('data-event', JSON.stringify(evt))
          .style('cursor', 'pointer');

        circle.append('title').text(`Click for details: ${evt.title}\n${formatDate(evtDate)}`);
        circle.on('click', (e) => {
          e.stopPropagation();
          showEventPopup(evt);
        });
      }
    });
  }

  // Crosshair / click interaction
  const focus = g.append('g').attr('class', 'tutorial-chart-focus').style('display', 'none');

  focus
    .append('line')
    .attr('class', 'tutorial-chart-crosshair-v')
    .attr('y1', 0)
    .attr('y2', height);

  focus
    .append('circle')
    .attr('class', `tutorial-chart-focus-dot ${isUp ? 'positive' : 'negative'}`)
    .attr('r', 4);

  const focusLabel = focus
    .append('text')
    .attr('class', 'tutorial-chart-focus-label')
    .attr('dy', -8)
    .attr('text-anchor', 'middle');

  function bisectDate(arr, xVal) {
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].date < xVal) lo = mid;
      else hi = mid;
    }
    return xVal - arr[lo].date > arr[hi].date - xVal ? hi : lo;
  }

  const overlay = g
    .append('rect')
    .attr('class', 'tutorial-chart-overlay')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'crosshair');

  // Event circles on top of overlay so they can receive hover and click
  const eventCirclesGroup = g.append('g').attr('class', 'tutorial-chart-event-bubbles').style('pointer-events', 'all');

  overlay.on('mouseover', () => focus.style('display', null));
  overlay.on('mouseout', () => focus.style('display', 'none'));

  overlay.on('mousemove', function (event) {
    const [mx] = d3.pointer(event, this);
    const xVal = xFocus.invert(mx);
    const i = Math.min(bisectDate(ohlcv, xVal), ohlcv.length - 1);
    const d = ohlcv[i];
    if (!d) return;

    focus
      .select('.tutorial-chart-crosshair-v')
      .attr('x1', xFocus(d.date))
      .attr('x2', xFocus(d.date));
    focus
      .select('.tutorial-chart-focus-dot')
      .attr('cx', xFocus(d.date))
      .attr('cy', y(d.close));
    focusLabel
      .attr('x', xFocus(d.date))
      .attr('y', y(d.close))
      .text(`${formatDate(d.date)} · ${formatPrice(d.close)}`);
  });

  const whatIfCallout = document.createElement('div');
  whatIfCallout.className = 'tutorial-whatif-callout';
  whatIfCallout.setAttribute('aria-live', 'polite');
  whatIfCallout.innerHTML = '<span class="tutorial-whatif-label">Drag the brush below to zoom. Click any point to see "what if" return.</span>';
  chartWrap.appendChild(whatIfCallout);

  overlay.on('click', function (event) {
    const [mx] = d3.pointer(event, this);
    const xVal = xFocus.invert(mx);
    const i = Math.min(bisectDate(ohlcv, xVal), ohlcv.length - 1);
    const d = ohlcv[i];
    if (!d) return;

    focus.style('display', null);

    const buyPrice = d.close;
    const sellPrice = last.close;
    const returnPct = buyPrice ? (((sellPrice - buyPrice) / buyPrice) * 100) : 0;
    const isGain = returnPct >= 0;

    whatIfCallout.innerHTML = `
      <span class="tutorial-whatif-result">
        <strong>If you bought on ${formatDate(d.date)} at ${formatPrice(buyPrice)}</strong>, by period end (${formatDate(last.date)}) your return would be
        <span class="tutorial-whatif-pct ${isGain ? 'positive' : 'negative'}">${isGain ? '+' : ''}${returnPct.toFixed(1)}%</span>
      </span>
    `;
    whatIfCallout.classList.add('tutorial-whatif-has-result');
  });

  // Context chart (mini overview) + brush
  contextG
    .append('path')
    .datum(ohlcv)
    .attr('class', `tutorial-chart-context-line ${isUp ? 'positive' : 'negative'}`)
    .attr('d', lineContext);

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, brushHeight],
    ])
    .on('end', function (event) {
      if (!event.selection) {
        xFocus.domain(fullDomain);
        brushG.call(brush.move, [0, width]);
      } else {
        const [x0, x1] = event.selection;
        const selStart = xContext.invert(x0);
        const selEnd = xContext.invert(x1);
        xFocus.domain([selStart, selEnd]);
      }
      updateFocus();
      focus.style('display', 'none');
    });

  const brushG = contextG.append('g').attr('class', 'tutorial-chart-brush').call(brush);

  // Initial brush selection: full range (user can then narrow to zoom)
  brushG.call(brush.move, [0, width]);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'tutorial-chart-reset-zoom';
  resetBtn.textContent = 'Reset zoom';
  resetBtn.title = 'Show full time range';
  resetBtn.addEventListener('click', () => {
    xFocus.domain(fullDomain);
    brushG.call(brush.move, [0, width]);
    updateFocus();
  });

  chartWrap.appendChild(resetBtn);

  updateFocus();
  updateEventMarkers();

  container.appendChild(chartWrap);

  // Metrics table with ? tooltips
  const hint = document.createElement('p');
  hint.className = 'tutorial-chart-hint';
  hint.textContent = 'Drag the brush to zoom into a time range. Hover for prices, click for "what if" return, click yellow markers for event details.';
  container.appendChild(hint);

  metricsWrap.innerHTML = `
    <table class="tutorial-metrics-table">
      <tbody>
        <tr>
          <td><span class="tutorial-metric-label">OPEN</span><span class="tutorial-metric-cell"><span class="tutorial-metric-value">${formatPrice(open)}</span><button type="button" class="tutorial-metric-help" aria-label="What does Open mean?" data-metric="open">?</button></span></td>
          <td><span class="tutorial-metric-label">HIGH</span><span class="tutorial-metric-cell"><span class="tutorial-metric-value">${formatPrice(high)}</span><button type="button" class="tutorial-metric-help" aria-label="What does High mean?" data-metric="high">?</button></span></td>
          <td><span class="tutorial-metric-label">LOW</span><span class="tutorial-metric-cell"><span class="tutorial-metric-value">${formatPrice(low)}</span><button type="button" class="tutorial-metric-help" aria-label="What does Low mean?" data-metric="low">?</button></span></td>
        </tr>
        <tr>
          <td><span class="tutorial-metric-label">MKT CAP</span><span class="tutorial-metric-cell"><span class="tutorial-metric-value">${formatCap(marketCap)}</span><button type="button" class="tutorial-metric-help" aria-label="What does Mkt cap mean?" data-metric="mktcap">?</button></span></td>
          <td><span class="tutorial-metric-label">52-WK HIGH</span><span class="tutorial-metric-cell"><span class="tutorial-metric-value">${formatPrice(week52High)}</span><button type="button" class="tutorial-metric-help" aria-label="What does 52-wk high mean?" data-metric="week52high">?</button></span></td>
          <td><span class="tutorial-metric-label">52-WK LOW</span><span class="tutorial-metric-cell"><span class="tutorial-metric-value">${formatPrice(week52Low)}</span><button type="button" class="tutorial-metric-help" aria-label="What does 52-wk low mean?" data-metric="week52low">?</button></span></td>
        </tr>
      </tbody>
    </table>
    <div class="tutorial-metric-tooltip" role="tooltip" aria-hidden="true">
      <div class="tutorial-metric-tooltip-content"></div>
    </div>
  `;

  const tooltip = metricsWrap.querySelector('.tutorial-metric-tooltip');
  const tooltipContent = metricsWrap.querySelector('.tutorial-metric-tooltip-content');
  let hideTimer = null;

  function showTooltip(btn) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    const key = btn.getAttribute('data-metric');
    const html = getMetricHelpHtml(key);
    if (tooltipContent) tooltipContent.innerHTML = html;
    const rect = btn.getBoundingClientRect();
    const wrapRect = metricsWrap.getBoundingClientRect();
    tooltip.style.left = `${rect.left - wrapRect.left}px`;
    tooltip.style.top = `${rect.top - wrapRect.top - 8}px`;
    tooltip.style.transform = 'translateY(-100%)';
    tooltip?.setAttribute('aria-hidden', 'false');
    tooltip?.classList.add('tutorial-metric-tooltip-visible');
  }

  function hideTooltip() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      tooltip?.setAttribute('aria-hidden', 'true');
      tooltip?.classList.remove('tutorial-metric-tooltip-visible');
    }, 120);
  }

  function cancelHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  metricsWrap.querySelectorAll('.tutorial-metric-help').forEach((btn) => {
    btn.addEventListener('mouseenter', () => showTooltip(btn));
    btn.addEventListener('mouseleave', hideTooltip);
  });
  tooltip?.addEventListener('mouseenter', cancelHide);
  tooltip?.addEventListener('mouseleave', hideTooltip);

  container.appendChild(metricsWrap);
}
