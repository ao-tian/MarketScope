/**
 * Renders 15-day (orange) and 45-day (purple) moving average chart with context brush.
 * Yellow dots mark crossover points. Legend sits below the brush to avoid overlap.
 */

const MA_MODAL_ID = 'playfield-ma-learn-more-modal';

const MA_PLOT_H = 380;
const MA_BRUSH_H = 48;
const MA_X_LABEL_BELOW = 52;
const MA_PLOT_TO_BRUSH_GAP = 16;

function formatPrice(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toFixed(2)}`;
}

function formatDateLabel(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function bisectDateByX(arr, xVal) {
  if (!arr?.length) return 0;
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].date < xVal) lo = mid;
    else hi = mid;
  }
  return xVal - arr[lo].date > arr[hi].date - xVal ? hi : lo;
}

function openMALearnMoreModal() {
  const modal = document.getElementById(MA_MODAL_ID);
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('playfield-ma-modal-visible');
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('playfield-ma-modal-visible');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  modal.querySelector('.playfield-ma-modal-close')?.addEventListener('click', close, { once: true });
  modal.querySelector('.playfield-ma-modal-backdrop')?.addEventListener('click', close, { once: true });
  document.addEventListener('keydown', onKey);
}

function computeMA(ohlcv, window) {
  if (!ohlcv?.length) return [];
  const result = [];
  for (let i = 0; i < ohlcv.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = ohlcv.slice(start, i + 1);
    const sum = slice.reduce((s, d) => s + (d.close ?? 0), 0);
    const ma = slice.length ? sum / slice.length : ohlcv[i].close;
    result.push({ date: ohlcv[i].date, ma });
  }
  return result;
}

function findCrossovers(ma15Data, ma45Data) {
  const crossovers = [];
  for (let i = 1; i < ma15Data.length && i < ma45Data.length; i++) {
    const diffPrev = ma15Data[i - 1].ma - ma45Data[i - 1].ma;
    const diffCur = ma15Data[i].ma - ma45Data[i].ma;
    if (diffPrev * diffCur < 0) {
      const t = Math.abs(diffPrev) / (Math.abs(diffPrev) + Math.abs(diffCur));
      const date = new Date(
        ma15Data[i - 1].date.getTime() +
          t * (ma15Data[i].date.getTime() - ma15Data[i - 1].date.getTime())
      );
      const value = ma15Data[i - 1].ma + t * (ma15Data[i].ma - ma15Data[i - 1].ma);
      crossovers.push({ date, value });
    }
  }
  return crossovers;
}

function sliceSeriesByDomain(series, d0, d1) {
  const t0 = d0.getTime();
  const t1 = d1.getTime();
  return series.filter((d) => {
    const t = d.date.getTime();
    return t >= t0 && t <= t1;
  });
}

export function renderMAChart(container, ohlcv) {
  if (!container || !ohlcv?.length) return;
  container.innerHTML = '';

  const ma15 = computeMA(ohlcv, 15);
  const ma45 = computeMA(ohlcv, 45);
  const crossoversFull = findCrossovers(ma15, ma45);

  if (ma15.length < 2) return;

  container.insertAdjacentHTML(
    'afterbegin',
    `<div class="playfield-ma-chart-header">
      <div class="playfield-ma-chart-title-row">
        <h3 class="playfield-ma-chart-title">15-day & 45-day moving averages</h3>
        <button type="button" class="playfield-ma-learn-more" aria-label="Learn more about moving averages">Learn more</button>
      </div>
      <p class="playfield-ma-chart-desc">Shows smoothed price trends. The orange line reacts faster to recent moves; the purple line reflects longer-term trend. Yellow dots mark crossover points where the two averages intersect—often used as buy/sell signals.</p>
    </div>`
  );

  container.querySelector('.playfield-ma-learn-more')?.addEventListener('click', openMALearnMoreModal);

  const margin = { top: 24, right: 56, bottom: 14, left: 68 };
  const width = Math.max(320, (container.clientWidth || 400) - margin.left - margin.right);
  const fullDomain = d3.extent(ohlcv, (d) => d.date);

  const xContext = d3.scaleTime().domain(fullDomain).range([0, width]);
  const xFocus = d3.scaleTime().domain(fullDomain).range([0, width]);
  const yContext = d3
    .scaleLinear()
    .domain(d3.extent(ohlcv, (d) => d.close))
    .range([MA_BRUSH_H - 6, 4]);

  let yFocus = d3.scaleLinear().range([MA_PLOT_H, 0]);

  const lineCurve = d3.curveMonotoneX;
  const lineCtx = d3
    .line()
    .x((d) => xContext(d.date))
    .y((d) => yContext(d.close))
    .curve(lineCurve);

  const contextTop = margin.top + MA_PLOT_H + MA_X_LABEL_BELOW + MA_PLOT_TO_BRUSH_GAP;
  const svgHeight = contextTop + MA_BRUSH_H + margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('class', 'playfield-ma-chart-svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', svgHeight);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const path15 = g.append('path').attr('class', 'playfield-ma-line playfield-ma-line-15');
  const path45 = g.append('path').attr('class', 'playfield-ma-line playfield-ma-line-45');
  const crossoverG = g.append('g').attr('class', 'playfield-ma-crossover-layer');

  const gridX = g.append('g').attr('class', 'playfield-ma-axis playfield-ma-axis-x').attr('transform', `translate(0,${MA_PLOT_H})`);
  const gridY = g.append('g').attr('class', 'playfield-ma-axis playfield-ma-axis-y');

  let vis15ForHover = ma15;
  let vis45ForHover = ma45;

  const hoverOverlay = g
    .append('rect')
    .attr('class', 'playfield-ma-hover-overlay')
    .attr('width', width)
    .attr('height', MA_PLOT_H)
    .attr('fill', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'crosshair');

  const crosshairG = g.append('g').attr('class', 'playfield-ma-focus-crosshair').style('display', 'none');
  crosshairG
    .append('line')
    .attr('class', 'playfield-ma-crosshair playfield-ma-crosshair-v')
    .attr('y1', 0)
    .attr('y2', MA_PLOT_H);
  crosshairG.append('circle').attr('class', 'playfield-ma-hover-dot-15').attr('r', 5);
  crosshairG.append('circle').attr('class', 'playfield-ma-hover-dot-45').attr('r', 5);
  const labelG = crosshairG.append('g').attr('class', 'playfield-ma-focus-label-wrap');
  const infoText = labelG.append('text').attr('class', 'playfield-ma-focus-info').attr('text-anchor', 'start');

  g.append('text')
    .attr('class', 'playfield-ma-axis-label playfield-ma-axis-label-x')
    .attr('x', width / 2)
    .attr('y', MA_PLOT_H + 48)
    .attr('text-anchor', 'middle')
    .text('Date');

  g.append('text')
    .attr('class', 'playfield-ma-axis-label playfield-ma-axis-label-y')
    .attr('transform', `translate(-42, ${MA_PLOT_H / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Price ($)');

  const contextG = svg.append('g').attr('transform', `translate(${margin.left},${contextTop})`);
  contextG.append('path').datum(ohlcv).attr('class', 'playfield-ma-context-line').attr('d', lineCtx);

  const line15 = d3.line().curve(lineCurve);
  const line45 = d3.line().curve(lineCurve);

  function updateMAFocus() {
    const [d0, d1] = xFocus.domain();
    let vis15 = sliceSeriesByDomain(ma15, d0, d1);
    let vis45 = sliceSeriesByDomain(ma45, d0, d1);

    if (vis15.length < 2) {
      xFocus.domain(fullDomain);
      vis15 = ma15;
      vis45 = ma45;
    }

    const allVals = [...vis15.map((d) => d.ma), ...vis45.map((d) => d.ma)];
    const ext = d3.extent(allVals);
    const yPad = (ext[1] - ext[0]) * 0.08 || 1;
    yFocus.domain([ext[0] - yPad, ext[1] + yPad]).nice();

    path15
      .datum(vis15)
      .attr(
        'd',
        line15
          .x((d) => xFocus(d.date))
          .y((d) => yFocus(d.ma))
      );
    path45
      .datum(vis45)
      .attr(
        'd',
        line45
          .x((d) => xFocus(d.date))
          .y((d) => yFocus(d.ma))
      );

    const t0 = xFocus.domain()[0].getTime();
    const t1 = xFocus.domain()[1].getTime();
    const visCross = crossoversFull.filter((c) => {
      const t = c.date.getTime();
      return t >= t0 && t <= t1;
    });

    crossoverG
      .selectAll('circle')
      .data(visCross)
      .join('circle')
      .attr('class', 'playfield-ma-crossover')
      .attr('cx', (c) => xFocus(c.date))
      .attr('cy', (c) => yFocus(c.value))
      .attr('r', 5);

    gridX.call(d3.axisBottom(xFocus).ticks(6).tickSize(-MA_PLOT_H));
    gridY.call(d3.axisLeft(yFocus).ticks(5).tickSize(-width));

    vis15ForHover = vis15;
    vis45ForHover = vis45;
  }

  hoverOverlay
    .on('mouseover', () => crosshairG.style('display', null))
    .on('mouseout', () => crosshairG.style('display', 'none'))
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event, this);
      const xVal = xFocus.invert(mx);
      const arr = vis15ForHover;
      if (!arr?.length || !vis45ForHover?.length) return;
      const i = Math.min(Math.max(0, bisectDateByX(arr, xVal)), arr.length - 1);
      const d15 = vis15ForHover[i];
      const d45 = vis45ForHover[i];
      if (!d15 || !d45) return;
      const cx = xFocus(d15.date);
      const cy15 = yFocus(d15.ma);
      const cy45 = yFocus(d45.ma);
      crosshairG.select('.playfield-ma-crosshair-v').attr('x1', cx).attr('x2', cx);
      crosshairG.select('.playfield-ma-hover-dot-15').attr('cx', cx).attr('cy', cy15);
      crosshairG.select('.playfield-ma-hover-dot-45').attr('cx', cx).attr('cy', cy45);
      infoText.selectAll('tspan').remove();
      const lines = [
        `Time: ${formatDateLabel(d15.date)}`,
        `15-day MA: ${formatPrice(d15.ma)}`,
        `45-day MA: ${formatPrice(d45.ma)}`,
      ];
      lines.forEach((line, idx) => {
        infoText.append('tspan').attr('x', 0).attr('dy', idx === 0 ? '0' : '1.28em').text(line);
      });
      const estW = 220;
      const estH = 72;
      let lx = cx + 12;
      let ly = Math.min(cy15, cy45) - 8;
      if (lx + estW > width) lx = Math.max(4, cx - estW - 12);
      if (ly < 14) ly = Math.max(cy15, cy45) + 16;
      if (ly + estH > MA_PLOT_H - 4) ly = MA_PLOT_H - estH - 4;
      labelG.attr('transform', `translate(${lx}, ${ly})`);
    });

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, MA_BRUSH_H],
    ])
    .on('end', function brushEnded(event) {
      if (!event.selection) {
        xFocus.domain(fullDomain);
        brushG.call(brush.move, [0, width]);
      } else {
        const [x0, x1] = event.selection;
        xFocus.domain([xContext.invert(x0), xContext.invert(x1)]);
      }
      updateMAFocus();
    });

  const brushG = contextG.append('g').attr('class', 'playfield-ma-chart-brush-g').call(brush);
  brushG.call(brush.move, [0, width]);

  const hint = document.createElement('p');
  hint.className = 'playfield-ma-brush-hint playfield-ma-brush-hint-below';
  hint.innerHTML =
    '<strong>MA time brush:</strong> Drag the gold handles on the strip above this note to zoom the moving-average chart. This is separate from the <strong>price</strong> chart brush.';
  container.appendChild(hint);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'playfield-ma-chart-reset-zoom';
  resetBtn.textContent = 'Reset MA zoom';
  resetBtn.title = 'Show full range on this moving-average panel';
  resetBtn.addEventListener('click', () => {
    xFocus.domain(fullDomain);
    brushG.call(brush.move, [0, width]);
    updateMAFocus();
  });
  container.appendChild(resetBtn);

  const legend = document.createElement('div');
  legend.className = 'playfield-ma-legend-row';
  legend.innerHTML = `
    <span class="playfield-ma-legend-chip"><span class="playfield-ma-legend-line playfield-ma-legend-15"></span> 15-day</span>
    <span class="playfield-ma-legend-chip"><span class="playfield-ma-legend-line playfield-ma-legend-45"></span> 45-day</span>
    <span class="playfield-ma-legend-chip"><span class="playfield-ma-legend-dot"></span> Crossover</span>
  `;
  container.appendChild(legend);

  updateMAFocus();
}
