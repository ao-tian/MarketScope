import * as DataLoader from '../data/DataLoader.js';
import { getMetricHelpHtml } from '../utils/metricHelp.js';
import { renderCryptoBubbles } from '../utils/bubbleChart.js';
import { renderMAChart } from '../utils/maChart.js';

function formatDateLabel(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toDateInputValue(d) {
  if (!d || !(d instanceof Date)) return '';
  return d.toISOString().slice(0, 10);
}

export function initCryptoPlayfield(container, { cryptoList }) {
  const cryptoMap = new Map(
    (cryptoList || []).map((c) => [c.symbol?.toUpperCase(), c])
  );
  const symbols = (cryptoList || []).map((c) => c.symbol);

  let currentSymbol = null;
  let currentData = null;
  let dataStart = null;
  let dataEnd = null;

  const searchEl = container.querySelector('.playfield-search');
  const searchInput = container.querySelector('.playfield-search-input');
  const resultsEl = container.querySelector('.playfield-search-results');
  const stockPanel = container.querySelector('.playfield-stock-panel');
  const chartWrap = container.querySelector('.playfield-chart');
  const dataRangeBanner = container.querySelector('.playfield-data-range-banner');
  const dateStartInput = container.querySelector('.playfield-date-start');
  const dateEndInput = container.querySelector('.playfield-date-end');
  const dateApplyBtn = container.querySelector('.playfield-date-apply');
  const headerEl = container.querySelector('.playfield-stock-header');
  const priceEl = container.querySelector('.playfield-price');
  const changeEl = container.querySelector('.playfield-change');
  const metricsEl = container.querySelector('.playfield-metrics');
  const maChartWrap = container.querySelector('.playfield-ma-chart');
  const trendingEl = container.querySelector('.playfield-trending');
  const bubbleChartEl = container.querySelector('.playfield-bubble-chart');
  const goBackBtn = container.querySelector('.playfield-go-back');
  const backToMainBtn = container.querySelector('.playfield-back-to-main');
  const tutorialEl = container.querySelector('.playfield-chart-tutorial');

  let previousDateRange = null;

  function goBackToMain() {
    currentSymbol = null;
    currentData = null;
    dataStart = null;
    dataEnd = null;
    previousDateRange = null;
    searchInput.value = '';
    resultsEl.classList.remove('playfield-search-results-visible');
    stockPanel.classList.add('playfield-stock-panel-empty');
    headerEl.innerHTML = '<p class="playfield-prompt">Search for a cryptocurrency above, or click a bubble below</p>';
    priceEl.textContent = '';
    changeEl.innerHTML = '';
    dataRangeBanner.innerHTML = '';
    chartWrap.innerHTML = '';
    metricsEl.innerHTML = '';
    maChartWrap.innerHTML = '';
    goBackBtn?.setAttribute('hidden', '');
    tutorialEl?.classList.remove('playfield-chart-tutorial-hidden');
    const et = document.getElementById('event-toast');
    if (et) {
      et.classList.remove('event-toast-visible');
      et.setAttribute('aria-hidden', 'true');
      et.innerHTML = '';
    }
    renderEmptyState();
  }

  function renderEmptyState() {
    renderCryptoBubbles(bubbleChartEl, { cryptoList, onSelect: selectCrypto });
    renderTrendingCrypto();
  }

  function formatPrice(v) {
    if (v == null || isNaN(v)) return '—';
    return `$${Number(v).toFixed(2)}`;
  }

  function formatCap(v) {
    if (v == null || isNaN(v)) return '—';
    const n = Number(v);
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    return n.toLocaleString();
  }

  function filterSymbols(q) {
    if (!q || !cryptoList?.length) return [];
    const upper = String(q).toUpperCase();
    return cryptoList
      .filter((c) => c.symbol.toUpperCase().includes(upper) || c.name.toUpperCase().includes(upper))
      .slice(0, 50)
      .map((c) => c.symbol);
  }

  function renderSearchResults(matches) {
    resultsEl.innerHTML = '';
    resultsEl.classList.toggle('playfield-search-results-visible', !!matches?.length);
    if (!matches?.length) return;
    matches.forEach((sym) => {
      const meta = cryptoMap.get(sym);
      const name = meta?.name || sym;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'playfield-search-item';
      el.innerHTML = `<span class="playfield-search-symbol">${sym}</span><span class="playfield-search-name">${name}</span>`;
      el.onclick = () => selectCrypto(sym);
      resultsEl.appendChild(el);
    });
  }

  function selectCrypto(sym) {
    currentSymbol = sym;
    searchInput.value = sym;
    resultsEl.classList.remove('playfield-search-results-visible');
    stockPanel.classList.remove('playfield-stock-panel-empty');
    loadAndRenderCrypto(sym);
  }

  function updateDateInputs() {
    if (!dataStart || !dataEnd || !dateStartInput || !dateEndInput) return;
    dateStartInput.min = toDateInputValue(dataStart);
    dateStartInput.max = toDateInputValue(dataEnd);
    dateEndInput.min = toDateInputValue(dataStart);
    dateEndInput.max = toDateInputValue(dataEnd);
    dateStartInput.value = toDateInputValue(dataStart);
    dateEndInput.value = toDateInputValue(dataEnd);
  }

  async function loadAndRenderCrypto(sym) {
    headerEl.innerHTML = '<span class="playfield-loading">Loading…</span>';
    priceEl.textContent = '—';
    changeEl.innerHTML = '';
    metricsEl.innerHTML = '';
    dataRangeBanner.innerHTML = '';
    chartWrap.innerHTML = '';
    maChartWrap.innerHTML = '';
    previousDateRange = null;
    goBackBtn?.setAttribute('hidden', '');
    tutorialEl?.classList.remove('playfield-chart-tutorial-hidden');
    const et = document.getElementById('event-toast');
    et?.classList.remove('event-toast-visible');
    et?.setAttribute('aria-hidden', 'true');
    if (et) et.innerHTML = '';
    try {
      const ohlcv = await DataLoader.loadCrypto(sym);
      currentData = ohlcv;
      dataStart = ohlcv.length ? ohlcv[0].date : null;
      dataEnd = ohlcv.length ? ohlcv[ohlcv.length - 1].date : null;
      updateDateInputs();
      if (dataRangeBanner) {
        dataRangeBanner.innerHTML = `Data available: <strong>${formatDateLabel(dataStart)}</strong> — <strong>${formatDateLabel(dataEnd)}</strong>`;
        dataRangeBanner.classList.add('playfield-data-range-visible');
      }
      renderCryptoDetail(sym, ohlcv);
      renderChart(ohlcv);
    } catch (e) {
      headerEl.innerHTML = `<span class="playfield-error">Failed to load data for ${sym}</span>`;
    }
  }

  function renderCryptoDetail(sym, displayData, fullData = null) {
    const ohlcv = displayData;
    const full = fullData || ohlcv;
    const meta = cryptoMap.get(sym);
    const last = ohlcv[ohlcv.length - 1];
    const prev = ohlcv[ohlcv.length - 2];
    const first = ohlcv[0];
    const close = last?.close ?? 0;
    const firstClose = first?.close ?? close;
    const prevClose = prev?.close ?? firstClose;
    const change = close - firstClose;
    const pct = firstClose ? (change / firstClose) * 100 : 0;
    const isPositive = change >= 0;

    const displayName = meta?.name || sym;

    headerEl.innerHTML = `
      <div class="playfield-header-left">
        <div class="playfield-logo">${displayName.charAt(0)}</div>
        <div>
          <h1 class="playfield-company-name">${displayName}</h1>
          <p class="playfield-ticker">CRYPTO: ${sym}</p>
        </div>
      </div>
    `;

    priceEl.textContent = `${formatPrice(close)} USD`;
    const lastDateStr = last?.date ? formatDateLabel(last.date) : '';
    changeEl.innerHTML = `
      <span class="playfield-change-value ${isPositive ? 'positive' : 'negative'}">
        ${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${pct.toFixed(2)}%)
      </span>
      <span class="playfield-change-label">over selected range ${lastDateStr ? `· thru ${lastDateStr}` : ''}</span>
    `;

    const open = first?.open ?? firstClose;
    const high = ohlcv.length ? Math.max(...ohlcv.map((d) => d.high)) : last?.high ?? close;
    const low = ohlcv.length ? Math.min(...ohlcv.map((d) => d.low)) : last?.low ?? close;
    const endDate = last?.date;
    const for52wk = endDate
      ? full.filter((d) => d.date <= endDate).slice(-252)
      : full.slice(-252);
    const week52 = for52wk.length ? Math.max(...for52wk.map((d) => d.high)) : null;
    const week52Low = for52wk.length ? Math.min(...for52wk.map((d) => d.low)) : null;
    const mktCap = last?.marketcap ?? (for52wk.length ? for52wk[for52wk.length - 1]?.marketcap : null);

    metricsEl.innerHTML = `
      <div class="playfield-metrics-row">
      <table class="playfield-metrics-table">
        <tbody>
          <tr>
            <td><span class="playfield-metric-label">Open <button type="button" class="playfield-metric-help" aria-label="What does Open mean?" data-metric="open">?</button></span><span class="playfield-metric-value">${formatPrice(open)}</span></td>
            <td><span class="playfield-metric-label">High <button type="button" class="playfield-metric-help" aria-label="What does High mean?" data-metric="high">?</button></span><span class="playfield-metric-value">${formatPrice(high)}</span></td>
            <td><span class="playfield-metric-label">Low <button type="button" class="playfield-metric-help" aria-label="What does Low mean?" data-metric="low">?</button></span><span class="playfield-metric-value">${formatPrice(low)}</span></td>
          </tr>
          <tr>
            <td><span class="playfield-metric-label">Mkt cap <button type="button" class="playfield-metric-help" aria-label="What does Mkt cap mean?" data-metric="mktcap">?</button></span><span class="playfield-metric-value">${formatCap(mktCap)}</span></td>
            <td><span class="playfield-metric-label">52-wk high <button type="button" class="playfield-metric-help" aria-label="What does 52-wk high mean?" data-metric="week52high">?</button></span><span class="playfield-metric-value">${formatPrice(week52)}</span></td>
            <td><span class="playfield-metric-label">52-wk low <button type="button" class="playfield-metric-help" aria-label="What does 52-wk low mean?" data-metric="week52low">?</button></span><span class="playfield-metric-value">${formatPrice(week52Low)}</span></td>
          </tr>
        </tbody>
      </table>
      </div>
      <div class="playfield-metric-tooltip" role="dialog" aria-hidden="true">
        <div class="playfield-metric-tooltip-content"></div>
        <button type="button" class="playfield-metric-tooltip-close" aria-label="Close">×</button>
      </div>
    `;

    const tooltip = metricsEl.querySelector('.playfield-metric-tooltip');
    const tooltipContent = metricsEl.querySelector('.playfield-metric-tooltip-content');
    const tooltipClose = metricsEl.querySelector('.playfield-metric-tooltip-close');

    function hideTooltip() {
      tooltip?.setAttribute('aria-hidden', 'true');
      tooltip?.classList.remove('playfield-metric-tooltip-visible');
    }

    tooltipClose?.addEventListener('click', hideTooltip);

    metricsEl.querySelectorAll('.playfield-metric-help').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.getAttribute('data-metric');
        const html = getMetricHelpHtml(key);
        if (tooltipContent) tooltipContent.innerHTML = html;
        tooltip?.setAttribute('aria-hidden', 'false');
        tooltip?.classList.add('playfield-metric-tooltip-visible');
      });
    });

    renderMAChart(maChartWrap, ohlcv);
  }

  function getDataForDateRange(ohlcv, startDate, endDate) {
    if (!ohlcv?.length) return [];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return ohlcv.filter((d) => {
      const t = d.date.getTime();
      if (start && t < start.getTime()) return false;
      if (end && t > end.getTime()) return false;
      return true;
    });
  }

  function renderChart(ohlcv) {
    const startVal = dateStartInput?.value || null;
    const endVal = dateEndInput?.value || null;
    const data = getDataForDateRange(ohlcv, startVal, endVal);
    if (!data.length) {
      chartWrap.innerHTML = '<p class="playfield-chart-empty">No data for selected range</p>';
      return;
    }

    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const width = chartWrap.clientWidth - margin.left - margin.right;
    const height = 440 - margin.top - margin.bottom;

    const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, width]);
    const y = d3.scaleLinear().domain(d3.extent(data, (d) => d.close)).nice().range([height, 0]);

    const svg = d3
      .select(chartWrap)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .style('display', 'block');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .attr('class', 'playfield-chart-grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-height));

    g.append('g').attr('class', 'playfield-chart-grid').call(d3.axisLeft(y).ticks(5).tickSize(-width));

    const lastClose = data[data.length - 1]?.close ?? 0;
    const firstClose = data[0]?.close ?? lastClose;
    const isUp = lastClose >= firstClose;

    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.close))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('class', `playfield-chart-line ${isUp ? 'positive' : 'negative'}`)
      .attr('d', line);

    g.append('circle')
      .attr('cx', x(data[data.length - 1]?.date))
      .attr('cy', y(lastClose))
      .attr('r', 4)
      .attr('class', `playfield-chart-dot ${isUp ? 'positive' : 'negative'}`);

    const prevClose = data.length >= 2 ? data[data.length - 2]?.close : firstClose;
    g.append('text')
      .attr('x', width + 8)
      .attr('y', y(prevClose))
      .attr('class', 'playfield-chart-prev')
      .text(`Previous close ${formatPrice(prevClose)}`);

    DataLoader.loadFinancialEvents().then((events) => {
      const domain = x.domain();
      const minT = domain[0].getTime();
      const maxT = domain[1].getTime();
      const inRange = events.filter((e) => {
        const t = new Date(e.date).getTime();
        return t >= minT && t <= maxT;
      });
      const eventToast = document.getElementById('event-toast');
      inRange.forEach((evt) => {
        const evtDate = new Date(evt.date);
        const cx = x(evtDate);
        if (cx >= 0 && cx <= width) {
          g.append('line')
            .attr('class', 'playfield-chart-event-line')
            .attr('x1', cx)
            .attr('y1', 10)
            .attr('x2', cx)
            .attr('y2', height);
          const circle = g
            .append('circle')
            .attr('class', 'playfield-chart-event-bubble')
            .attr('cx', cx)
            .attr('cy', 10)
            .attr('r', 6)
            .attr('data-event', JSON.stringify(evt))
            .style('pointer-events', 'all');
          circle.on('click', (e) => {
            e.stopPropagation();
            if (!eventToast || !currentData || !dataStart || !dataEnd) return;
            const d = JSON.parse(circle.attr('data-event'));
            const dateStr = formatDateLabel(new Date(d.date));
            const evtDate = new Date(d.date);

            previousDateRange = {
              start: dateStartInput.value,
              end: dateEndInput.value,
            };

            const padMs = 90 * 24 * 60 * 60 * 1000;
            let zoomStart = new Date(evtDate.getTime() - padMs);
            let zoomEnd = new Date(evtDate.getTime() + padMs);
            if (zoomStart < dataStart) zoomStart = dataStart;
            if (zoomEnd > dataEnd) zoomEnd = dataEnd;

            dateStartInput.value = toDateInputValue(zoomStart);
            dateEndInput.value = toDateInputValue(zoomEnd);
            chartWrap.innerHTML = '';
            const filtered = getDataForDateRange(currentData, dateStartInput.value, dateEndInput.value);
            if (filtered.length) {
              renderCryptoDetail(currentSymbol, filtered, currentData);
              renderChart(currentData);
            } else {
              renderChart(currentData);
            }
            goBackBtn?.removeAttribute('hidden');
            tutorialEl?.classList.add('playfield-chart-tutorial-hidden');

            eventToast.innerHTML = `
              <button type="button" class="event-toast-close" aria-label="Close">×</button>
              <div class="event-toast-category">${d.category}</div>
              <div class="event-toast-title">${d.title}</div>
              <div class="event-toast-date">${dateStr}</div>
              <div class="event-toast-desc">${d.description}</div>
            `;
            eventToast.classList.add('event-toast-visible');
            eventToast.setAttribute('aria-hidden', 'false');
            eventToast.querySelector('.event-toast-close')?.addEventListener('click', () => {
              eventToast.classList.remove('event-toast-visible');
              eventToast.setAttribute('aria-hidden', 'true');
              eventToast.innerHTML = '';
            });
          });
        }
      });
    });
  }

  function applyDateFilter() {
    if (!currentData || !dateStartInput || !dateEndInput || !dataStart || !dataEnd) return;
    const minStr = toDateInputValue(dataStart);
    const maxStr = toDateInputValue(dataEnd);
    let start = dateStartInput.value;
    let end = dateEndInput.value;
    if (start && (start < minStr || start > maxStr)) {
      start = minStr;
      dateStartInput.value = start;
    }
    if (end && (end < minStr || end > maxStr)) {
      end = maxStr;
      dateEndInput.value = end;
    }
    if (start && end && start > end) {
      dateStartInput.value = end;
      dateEndInput.value = start;
    }
    chartWrap.innerHTML = '';
    const filtered = getDataForDateRange(currentData, start, end);
    if (filtered.length) {
      renderCryptoDetail(currentSymbol, filtered, currentData);
      renderChart(currentData);
    } else {
      renderChart(currentData);
    }
  }

  dateApplyBtn?.addEventListener('click', applyDateFilter);
  backToMainBtn?.addEventListener('click', goBackToMain);

  goBackBtn?.addEventListener('click', () => {
    if (!previousDateRange || !dateStartInput || !dateEndInput) return;
    dateStartInput.value = previousDateRange.start;
    dateEndInput.value = previousDateRange.end;
    previousDateRange = null;
    goBackBtn?.setAttribute('hidden', '');
    tutorialEl?.classList.remove('playfield-chart-tutorial-hidden');
    const eventToast = document.getElementById('event-toast');
    if (eventToast) {
      eventToast.classList.remove('event-toast-visible');
      eventToast.setAttribute('aria-hidden', 'true');
      eventToast.innerHTML = '';
    }
    chartWrap.innerHTML = '';
    const filtered = getDataForDateRange(currentData, dateStartInput.value, dateEndInput.value);
    if (filtered.length) {
      renderCryptoDetail(currentSymbol, filtered, currentData);
      renderChart(currentData);
    } else {
      renderChart(currentData);
    }
  });

  searchInput?.addEventListener('input', (e) => {
    renderSearchResults(filterSymbols(e.target.value));
  });
  searchInput?.addEventListener('focus', () => {
    if (searchInput.value) renderSearchResults(filterSymbols(searchInput.value));
  });
  document.addEventListener('click', (e) => {
    if (!searchEl?.contains(e.target)) resultsEl?.classList.remove('playfield-search-results-visible');
  });

  stockPanel.classList.add('playfield-stock-panel-empty');
  headerEl.innerHTML = '<p class="playfield-prompt">Search for a cryptocurrency above, or click a bubble below</p>';
  renderEmptyState();

  return { resetToMain: goBackToMain };

  function renderTrendingCrypto() {
    if (!trendingEl || !cryptoList?.length) return;
    const top = (cryptoList || []).slice(0, 10);
    trendingEl.innerHTML = `
      <p class="playfield-trending-title">Popular cryptocurrencies to explore</p>
      <div class="playfield-trending-grid">
        ${top
          .map(
            (c) =>
              `<button type="button" class="playfield-trending-item" data-symbol="${c.symbol}">
                <span class="playfield-trending-symbol">${c.symbol}</span>
                <span class="playfield-trending-name">${(c.name || c.symbol).slice(0, 18)}${(c.name || '').length > 18 ? '…' : ''}</span>
              </button>`
          )
          .join('')}
      </div>
    `;
    trendingEl.querySelectorAll('.playfield-trending-item').forEach((btn) => {
      btn.addEventListener('click', () => selectCrypto(btn.dataset.symbol));
    });
  }
}
