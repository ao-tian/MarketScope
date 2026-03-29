/**
 * Playfield main price chart with mini context + brush; syncs 15/45-day MA to brushed range.
 * Pattern matches tutorial chart: gold brush strip under focus chart.
 */

const BRUSH_H = 52;
const FOCUS_H = 340;
/** Space between focus plot (x-axis) and the context brush so tick labels do not overlap the strip. */
const FOCUS_TO_BRUSH_GAP = 30;

export function renderPlayfieldPriceBrushChart(chartWrap, options) {
  const {
    data,
    formatPrice,
    formatDateLabel,
    maChartWrap,
    renderMAChart,
    decorateFocus,
  } = options;

  if (!chartWrap || !data?.length) {
    chartWrap.innerHTML = '<p class="playfield-chart-empty">No data for selected range</p>';
    return;
  }

  chartWrap.innerHTML = '';

  const margin = { top: 20, right: 60, bottom: 18, left: 60 };
  const width = Math.max(280, chartWrap.clientWidth - margin.left - margin.right);
  const totalSvgH = margin.top + FOCUS_H + FOCUS_TO_BRUSH_GAP + BRUSH_H + 36 + margin.bottom;

  const fullDomain = d3.extent(data, (d) => d.date);
  let visibleData = data;

  const xContext = d3.scaleTime().domain(fullDomain).range([0, width]);
  const xFocus = d3.scaleTime().domain(fullDomain).range([0, width]);
  const yContext = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.close))
    .range([BRUSH_H - 6, 4]);

  function yFocusDomain(vis) {
    const ext = d3.extent(vis, (d) => d.close);
    const pad = (ext[1] - ext[0]) * 0.06 || 1;
    return [ext[0] - pad, ext[1] + pad];
  }

  let yFocus = d3.scaleLinear().domain(yFocusDomain(visibleData)).nice().range([FOCUS_H, 0]);

  const svg = d3
    .select(chartWrap)
    .append('svg')
    .attr('class', 'playfield-price-brush-svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', totalSvgH)
    .style('display', 'block');

  const gFocus = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const contextG = svg.append('g').attr('transform', `translate(${margin.left},${margin.top + FOCUS_H + FOCUS_TO_BRUSH_GAP})`);

  const gridX = gFocus.append('g').attr('class', 'playfield-chart-grid').attr('transform', `translate(0,${FOCUS_H})`);
  const gridY = gFocus.append('g').attr('class', 'playfield-chart-grid');

  const line = d3.line().curve(d3.curveMonotoneX);
  const lineCtx = d3
    .line()
    .x((d) => xContext(d.date))
    .y((d) => yContext(d.close))
    .curve(d3.curveMonotoneX);

  const pathFocus = gFocus.append('path').attr('class', 'playfield-chart-line');
  const dotFocus = gFocus.append('circle').attr('class', 'playfield-chart-dot').attr('r', 4);
  const prevLbl = gFocus.append('text').attr('class', 'playfield-chart-prev').attr('x', width + 8);

  function bisectDate(arr, xVal) {
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

  const hoverOverlay = gFocus
    .append('rect')
    .attr('class', 'playfield-chart-hover-overlay')
    .attr('width', width)
    .attr('height', FOCUS_H)
    .attr('fill', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'crosshair');

  const crosshairG = gFocus.append('g').attr('class', 'playfield-chart-focus-crosshair').style('display', 'none');
  crosshairG
    .append('line')
    .attr('class', 'playfield-chart-crosshair playfield-chart-crosshair-v')
    .attr('y1', 0)
    .attr('y2', FOCUS_H);
  crosshairG
    .append('line')
    .attr('class', 'playfield-chart-crosshair playfield-chart-crosshair-h')
    .attr('x1', 0)
    .attr('x2', width);
  crosshairG
    .append('circle')
    .attr(
      'class',
      `playfield-chart-focus-dot ${(data[data.length - 1]?.close ?? 0) >= (data[0]?.close ?? 0) ? 'positive' : 'negative'}`
    )
    .attr('r', 4);
  const focusLabel = crosshairG
    .append('text')
    .attr('class', 'playfield-chart-focus-label')
    .attr('text-anchor', 'middle');

  const eventsLayer = gFocus.append('g').attr('class', 'playfield-chart-events-layer');

  contextG
    .append('path')
    .datum(data)
    .attr('class', 'playfield-chart-context-line')
    .attr('d', lineCtx);

  function sliceByDomain(d0, d1) {
    const t0 = d0.getTime();
    const t1 = d1.getTime();
    return data.filter((d) => {
      const t = d.date.getTime();
      return t >= t0 && t <= t1;
    });
  }

  function updateFocus() {
    visibleData = sliceByDomain(xFocus.domain()[0], xFocus.domain()[1]);
    if (visibleData.length < 2) {
      visibleData = data;
      xFocus.domain(fullDomain);
    }

    yFocus.domain(yFocusDomain(visibleData)).nice().range([FOCUS_H, 0]);

    const last = visibleData[visibleData.length - 1];
    const first = visibleData[0];
    const lastClose = last?.close ?? 0;
    const firstClose = first?.close ?? lastClose;
    const isUp = lastClose >= firstClose;

    crosshairG.select('.playfield-chart-focus-dot').attr('class', `playfield-chart-focus-dot ${isUp ? 'positive' : 'negative'}`);

    pathFocus
      .datum(visibleData)
      .attr('class', `playfield-chart-line ${isUp ? 'positive' : 'negative'}`)
      .attr('d', line.x((d) => xFocus(d.date)).y((d) => yFocus(d.close)));

    gridX.call(d3.axisBottom(xFocus).ticks(6).tickSize(-FOCUS_H));
    gridY.call(d3.axisLeft(yFocus).ticks(5).tickSize(-width));

    dotFocus
      .attr('cx', xFocus(last.date))
      .attr('cy', yFocus(lastClose))
      .attr('class', `playfield-chart-dot ${isUp ? 'positive' : 'negative'}`);

    const prevClose = visibleData.length >= 2 ? visibleData[visibleData.length - 2].close : firstClose;
    prevLbl.attr('y', yFocus(prevClose)).text(`Previous close ${formatPrice(prevClose)}`);

    if (maChartWrap && typeof renderMAChart === 'function') {
      renderMAChart(maChartWrap, visibleData);
    }

    eventsLayer.selectAll('*').remove();
    decorateFocus?.({
      g: eventsLayer,
      xFocus,
      y: yFocus,
      width,
      height: FOCUS_H,
      visibleData,
      dataFull: data,
    });
  }

  hoverOverlay.on('mouseover', () => crosshairG.style('display', null));
  hoverOverlay.on('mouseout', () => crosshairG.style('display', 'none'));
  hoverOverlay.on('mousemove', function (event) {
    const [mx] = d3.pointer(event, this);
    const xVal = xFocus.invert(mx);
    const i = Math.min(Math.max(0, bisectDate(visibleData, xVal)), visibleData.length - 1);
    const d = visibleData[i];
    if (!d) return;
    const cx = xFocus(d.date);
    const cy = yFocus(d.close);
    crosshairG.select('.playfield-chart-crosshair-v').attr('x1', cx).attr('x2', cx);
    crosshairG.select('.playfield-chart-crosshair-h').attr('y1', cy).attr('y2', cy);
    crosshairG.select('.playfield-chart-focus-dot').attr('cx', cx).attr('cy', cy);
    focusLabel
      .attr('x', cx)
      .attr('y', cy)
      .attr('dy', cy < 28 ? '1.1em' : '-0.65em')
      .text(`${formatDateLabel(d.date)} · ${formatPrice(d.close)}`);
  });

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, BRUSH_H],
    ])
    .on('end', function brushEnded(event) {
      if (!event.selection) {
        xFocus.domain(fullDomain);
        brushG.call(brush.move, [0, width]);
      } else {
        const [x0, x1] = event.selection;
        xFocus.domain([xContext.invert(x0), xContext.invert(x1)]);
      }
      updateFocus();
    });

  const brushG = contextG.append('g').attr('class', 'playfield-chart-brush-g').call(brush);

  brushG.call(brush.move, [0, width]);

  const hint = document.createElement('p');
  hint.className = 'playfield-chart-brush-hint';
  hint.innerHTML =
    '<strong>Time brush:</strong> Drag the gold handles on the strip below (with extra space under the axis). The MA panel matches this date window and has its <strong>own brush</strong> under the moving-average lines. <strong>Hover</strong> the price chart for crosshairs, date, and price.';
  chartWrap.appendChild(hint);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'playfield-chart-reset-zoom';
  resetBtn.textContent = 'Reset zoom';
  resetBtn.title = 'Show full range for current date filter';
  resetBtn.addEventListener('click', () => {
    xFocus.domain(fullDomain);
    brushG.call(brush.move, [0, width]);
    updateFocus();
  });
  chartWrap.appendChild(resetBtn);

  updateFocus();
}
