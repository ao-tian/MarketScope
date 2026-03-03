/**
 * Renders 15-day (orange) and 45-day (purple) moving average chart.
 * Yellow dots mark crossover points where the two MAs intersect.
 */

const MA_MODAL_ID = 'playfield-ma-learn-more-modal';

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

/**
 * Finds crossover points where ma15 crosses ma45.
 * Both arrays must share the same dates (aligned by index).
 */
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

export function renderMAChart(container, ohlcv) {
  if (!container || !ohlcv?.length) return;
  container.innerHTML = '';

  const ma15 = computeMA(ohlcv, 15);
  const ma45 = computeMA(ohlcv, 45);
  const crossovers = findCrossovers(ma15, ma45);

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

  const learnMoreBtn = container.querySelector('.playfield-ma-learn-more');
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', openMALearnMoreModal);
  }

  const margin = { top: 20, right: 52, bottom: 110, left: 60 };
  const width = Math.max(320, (container.clientWidth || 400) - margin.left - margin.right);
  const height = 300;

  const x = d3.scaleTime().domain(d3.extent(ma15, (d) => d.date)).range([0, width]);
  const allVals = [...ma15.map((d) => d.ma), ...ma45.map((d) => d.ma)];
  const yExtent = d3.extent(allVals);
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 1;
  const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).range([height, 0]);

  const lineCurve = d3.curveMonotoneX;
  const line15 = d3.line().x((d) => x(d.date)).y((d) => y(d.ma)).curve(lineCurve);
  const line45 = d3.line().x((d) => x(d.date)).y((d) => y(d.ma)).curve(lineCurve);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('class', 'playfield-ma-chart-svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  g.append('path')
    .datum(ma15)
    .attr('class', 'playfield-ma-line playfield-ma-line-15')
    .attr('d', line15);

  g.append('path')
    .datum(ma45)
    .attr('class', 'playfield-ma-line playfield-ma-line-45')
    .attr('d', line45);

  g.selectAll('.playfield-ma-crossover')
    .data(crossovers)
    .join('circle')
    .attr('class', 'playfield-ma-crossover')
    .attr('cx', (d) => x(d.date))
    .attr('cy', (d) => y(d.value))
    .attr('r', 4);

  g.append('g')
    .attr('class', 'playfield-ma-axis playfield-ma-axis-x')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(-height));

  g.append('text')
    .attr('class', 'playfield-ma-axis-label playfield-ma-axis-label-x')
    .attr('x', width / 2)
    .attr('y', height + 48)
    .attr('text-anchor', 'middle')
    .text('Date');

  g.append('g')
    .attr('class', 'playfield-ma-axis playfield-ma-axis-y')
    .call(d3.axisLeft(y).ticks(5).tickSize(-width));

  g.append('text')
    .attr('class', 'playfield-ma-axis-label playfield-ma-axis-label-y')
    .attr('transform', `translate(-36, ${height / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Price ($)');

  const legendY = height + 88;
  const legendX = margin.left + (width / 2) - 85;
  const legend = svg
    .append('g')
    .attr('class', 'playfield-ma-legend')
    .attr('transform', `translate(${legendX}, ${legendY})`);
  legend.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0).attr('class', 'playfield-ma-legend-15');
  legend.append('text').attr('x', 22).attr('y', 4).attr('class', 'playfield-ma-legend-text').text('15-day');
  legend.append('line').attr('x1', 70).attr('x2', 88).attr('y1', 0).attr('y2', 0).attr('class', 'playfield-ma-legend-45');
  legend.append('text').attr('x', 92).attr('y', 4).attr('class', 'playfield-ma-legend-text').text('45-day');
  legend.append('circle').attr('cx', 145).attr('cy', 0).attr('r', 4).attr('class', 'playfield-ma-legend-crossover');
  legend.append('text').attr('x', 154).attr('y', 4).attr('class', 'playfield-ma-legend-text').text('Crossover');
}
