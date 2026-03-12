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

async function loadStockReturns(sp500Companies, startDate) {
  if (!sp500Companies?.length || !startDate) return [];
  const startTime = startDate.getTime();
  const sorted = [...sp500Companies]
    .filter((r) => r.Symbol && !r.Symbol.includes('.'))
    .sort((a, b) => (parseFloat(b.Marketcap) || 0) - (parseFloat(a.Marketcap) || 0));
  const topSymbols = sorted.slice(0, 80).map((r) => r.Symbol);

  const results = [];
  const batchSize = 10;
  for (let i = 0; i < topSymbols.length; i += batchSize) {
    const batch = topSymbols.slice(i, i + batchSize);
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
          const meta = sp500Companies.find((c) => c.Symbol === sym);
          const prices = series.map((r) => r.close);
          return {
            symbol: sym,
            name: meta?.Shortname || meta?.Longname || sym,
            startPrice,
            endPrice,
            pctChange,
            priceHistory: prices,
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

function renderWorstViz(container, data) {
  if (!container || !data) return;
  const { companies, allocations, initialMoney, finalValue, startDateLabel } = data;
  const loss = initialMoney - finalValue;
  const pctLoss = initialMoney > 0 ? (loss / initialMoney) * 100 : 0;
  const heroValueClass = finalValue < 0 ? 'personalize-viz-value-negative' : finalValue < initialMoney ? 'personalize-viz-value-below' : 'personalize-viz-value-positive';

  container.innerHTML = `
    <div class="personalize-viz-worst">
      <div class="personalize-viz-hero">
        <span class="personalize-viz-label">Your portfolio would be worth</span>
        <span class="personalize-viz-value ${heroValueClass}"><span class="animate-num" data-target="${finalValue}" data-prefix="$" data-decimals="0"></span></span>
        <span class="personalize-viz-gain negative">−$<span class="animate-num" data-target="${loss}" data-decimals="0"></span> (−<span class="animate-num" data-target="${pctLoss}" data-suffix="%" data-decimals="1"></span>)</span>
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

export function initPersonalizeModal(sp500Companies) {
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

  function updateNavVisibility() {
    navLeft?.setAttribute('aria-hidden', currentSlide === 0 ? 'true' : 'false');
    navRight?.setAttribute('aria-hidden', currentSlide === SLIDE_COUNT - 1 ? 'true' : 'false');
    dotsContainer?.querySelectorAll('.personalize-dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentSlide);
    });
    modal?.classList.toggle('personalize-worst-active', currentSlide === 2);
  }

  function goToSlide(index) {
    if (index < 0 || index >= SLIDE_COUNT) return;
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
      const companyCount = Math.min(10, Math.max(1, parseInt(data.company_count, 10) || 3));
      const allocations = (data.allocations || []).slice(0, companyCount).map((a) => parseFloat(a) || 0);
      const initialMoney = parseFloat(data.available_money) || 0;

      const bestVizEl = document.getElementById('personalize-best-viz');
      const worstVizEl = document.getElementById('personalize-worst-viz');

      bestVizEl.innerHTML = '<p class="personalize-loading">Loading…</p>';
      worstVizEl.innerHTML = '<p class="personalize-loading">Loading…</p>';

      const returns = await loadStockReturns(sp500Companies, startDate);
      const best = [...returns].sort((a, b) => b.pctChange - a.pctChange).slice(0, companyCount);
      const worst = [...returns].sort((a, b) => a.pctChange - b.pctChange).slice(0, companyCount);

      if (!best.length || !worst.length) {
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
        allocations: normAllocations.slice(0, worst.length),
        initialMoney,
        finalValue: computePortfolioValue(worst, normAllocations.slice(0, worst.length), initialMoney) ?? initialMoney,
        startDateLabel,
      };

      renderBestViz(bestVizEl, bestData);
      renderWorstViz(worstVizEl, worstData);

      currentSlide = 0;
      slidesContainer.style.transform = 'translateX(0vw)';
      updateNavVisibility();
    },
  };
}
