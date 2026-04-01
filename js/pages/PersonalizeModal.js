/**
 * Investing playfield: form on top, scrollable results (welcome + primary scenario;
 * worst-case slide only for the full-market “Best & Worst” strategy, not fund presets or own picks).
 */

import * as DataLoader from '../data/DataLoader.js';

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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SPARK_W = 140;
const SPARK_H = 88;

/**
 * Log-scaled Y when all prices are positive so multi-baggers show a visible climb
 * (linear hockey sticks look flat for most of the chart).
 */
function sparklineSvgPath(prices) {
  if (!prices?.length) return '';
  const vals = prices.map((p) => Number(p));
  const w = SPARK_W;
  const h = SPARK_H;
  const padX = 3;
  const padY = 4;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const innerTop = padY;
  const step = innerW / Math.max(1, vals.length - 1);

  const allPositive = vals.every((p) => p > 0 && Number.isFinite(p));
  let yAt;
  if (allPositive) {
    const logs = vals.map((p) => Math.log10(Math.max(p, 1e-12)));
    const minL = Math.min(...logs);
    const maxL = Math.max(...logs);
    const rangeL = Math.max(maxL - minL, 1e-9);
    yAt = (p) => {
      const l = Math.log10(Math.max(p, 1e-12));
      return innerTop + innerH - ((l - minL) / rangeL) * innerH;
    };
  } else {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = Math.max(max - min, 1e-9);
    yAt = (p) => innerTop + innerH - ((p - min) / range) * innerH;
  }

  const pts = vals.map((p, i) => {
    const x = padX + i * step;
    const y = yAt(p);
    return `${x},${y}`;
  });
  return `M ${pts.join(' L ')}`;
}

/**
 * @param {'best'|'own'|'worst'} mode
 */
function buildPersonalizePickCardsHtml(companies, allocations, initialMoney, mode) {
  if (!companies?.length) return '<ul class="personalize-picks-grid"></ul>';
  const uid = Math.random().toString(36).slice(2, 11);
  const items = companies
    .map((c, i) => {
      const pct = allocations[i] ?? 100 / companies.length;
      const invested = (initialMoney * pct) / 100;
      const finalAmt = invested * (1 + c.pctChange / 100);
      const earned = finalAmt - invested;
      const pathD = c.priceHistory?.length ? sparklineSvgPath(c.priceHistory) : '';
      const rowClass = c.pctChange >= 0 ? 'positive' : 'negative';
      const stroke = c.pctChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
      const nameFull = c.name || c.symbol;
      const nameShort = nameFull.length > 38 ? `${nameFull.slice(0, 36)}…` : nameFull;
      const startStr = c.startDate ? formatDateLabel(c.startDate) : 'your start date';
      const explainerId = `pick-expl-${uid}-${i}`;
      const investedR = Math.round(invested);
      const finalR = Math.round(finalAmt);
      const earnedR = Math.round(Math.abs(earned));
      const isGain = earned >= 0;
      const moveWord = isGain ? 'gain' : 'loss';
      let scenarioLine = '';
      if (mode === 'best') {
        scenarioLine =
          'In this <strong>best-case</strong> scenario, this stock ranked among the <strong>top performers</strong> from your start date.';
      } else if (mode === 'worst') {
        scenarioLine =
          'In this <strong>worst-case</strong> scenario, this stock ranked among the <strong>biggest decliners</strong> from your start date.';
      } else {
        scenarioLine =
          'This holding is part of <strong>your allocation</strong> (your own picks or the fund-style strategy you chose).';
      }
      const tipInner = `<div class="personalize-pick-tip-inner"><p>${scenarioLine}</p><p><strong>Portfolio weight</strong>: ${pct.toFixed(
        1
      )}% of your starting total → <strong>$${investedR.toLocaleString()}</strong> placed in <strong>${escapeHtml(
        c.symbol
      )}</strong> (<span class="personalize-pick-tip-name">${escapeHtml(nameFull)}</span>).</p><p><strong>Stock return</strong> over our historical window: ${c.pctChange >= 0 ? '+' : ''}${c.pctChange.toFixed(
        1
      )}% (from ${escapeHtml(startStr)} through the last date in our dataset).</p><p><strong>Value of this slice at the end</strong>: about $${finalR.toLocaleString()} (${
        isGain ? '+' : '−'
      }$${earnedR.toLocaleString()} vs. amount invested = paper ${moveWord}).</p><p class="personalize-pick-tip-foot">The mini chart uses a <strong>log scale on price</strong> so large gains show as a real climb instead of a long flat line with a spike at the end. Simulation only—historical closes, not advice or live quotes.</p></div>`;

      return `
            <li class="personalize-picks-grid-item">
              <article class="personalize-pick-card" tabindex="0" aria-describedby="${explainerId}">
                <div class="personalize-pick-card-head">
                  <span class="personalize-pick-symbol">${c.symbol}</span>
                  <span class="personalize-pick-badge personalize-pick-badge--${rowClass}">${c.pctChange >= 0 ? '+' : ''}${c.pctChange.toFixed(1)}%</span>
                </div>
                <p class="personalize-pick-name">${escapeHtml(nameShort)}</p>
                ${
                  pathD
                    ? `<div class="personalize-pick-spark"><svg class="personalize-pick-spark-svg" viewBox="0 0 ${SPARK_W} ${SPARK_H}" preserveAspectRatio="none" aria-hidden="true"><path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
                    : ''
                }
                <dl class="personalize-pick-stats">
                  <div><dt>Weight</dt><dd>${pct.toFixed(1)}%</dd></div>
                  <div><dt>Invested</dt><dd>$<span class="animate-num" data-target="${investedR}" data-decimals="0"></span></dd></div>
                  <div><dt>Value</dt><dd>$<span class="animate-num" data-target="${finalR}" data-decimals="0"></span></dd></div>
                </dl>
                <p class="personalize-pick-hover-hint"><span class="personalize-pick-hover-hint-icon" aria-hidden="true">?</span> Hover or tap for what these numbers mean</p>
                <div class="personalize-pick-tip" id="${explainerId}" role="tooltip">${tipInner}</div>
              </article>
            </li>`;
    })
    .join('');
  return `<ul class="personalize-picks-grid">${items}</ul>`;
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
        ${buildPersonalizePickCardsHtml(companies, allocations, initialMoney, 'best')}
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
        ${buildPersonalizePickCardsHtml(companies, allocations, initialMoney, 'own')}
      </div>
    </div>
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
        ${buildPersonalizePickCardsHtml(companies, allocations, initialMoney, 'worst')}
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
  const resultsEl = document.getElementById('personalize-results');
  const investSlideEl = modal?.querySelector('.personalize-slide-invest');

  if (!modal) return;

  initMoneyBackground(moneyBg);

  let bestData = null;
  let worstData = null;
  let scrollAnimObservers = [];
  let worstSectionObserver = null;

  function disconnectScrollAnimObservers() {
    scrollAnimObservers.forEach((o) => o.disconnect());
    scrollAnimObservers = [];
    worstSectionObserver?.disconnect();
    worstSectionObserver = null;
  }

  function setupScrollTriggeredNumberAnimations() {
    disconnectScrollAnimObservers();
    let bestDone = false;
    let worstDone = false;
    const bestSection = modal.querySelector('.personalize-slide-best');
    const worstSection = modal.querySelector('.personalize-slide-worst');
    const bestViz = document.getElementById('personalize-best-viz');
    const worstViz = document.getElementById('personalize-worst-viz');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === bestSection && !bestDone) {
            bestDone = true;
            runNumberAnimations(bestViz);
          }
          if (entry.target === worstSection && !worstDone) {
            worstDone = true;
            runNumberAnimations(worstViz);
          }
        }
      },
      { root: null, threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );

    if (bestSection) io.observe(bestSection);
    if (worstSection && !worstSection.hidden) io.observe(worstSection);
    scrollAnimObservers.push(io);

    if (worstSection && !worstSection.hidden) {
      worstSectionObserver = new IntersectionObserver(
        (entries) => {
          const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.15);
          modal.classList.toggle('personalize-worst-active', hit);
        },
        { threshold: [0, 0.15, 0.35] }
      );
      worstSectionObserver.observe(worstSection);
    }
  }

  function goToSlide(index) {
    if (index === 0) {
      disconnectScrollAnimObservers();
      resultsEl?.setAttribute('hidden', '');
      investSlideEl?.removeAttribute('hidden');
      modal.classList.remove('personalize-worst-active');
      document.getElementById('invest-cta-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (index === 1) {
      resultsEl?.removeAttribute('hidden');
      investSlideEl?.setAttribute('hidden', '');
      document.getElementById('personalize-welcome-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return {
    async loadAndRender(data, options = {}) {
      const { scrollToResults = false } = options;
      const startDate = getStartDate(data);
      const companyCount = Math.min(10, Math.max(1, parseInt(data.company_count, 10) || 4));
      let allocations = (data.allocations || []).slice(0, companyCount).map((a) => parseFloat(a) || 0);
      const initialMoney = parseFloat(data.available_money) || 0;
      const isOwnMode = data.invest_mode === 'own' && data.selected_symbols?.length;
      const isStrategyMode = data.invest_mode === 'plan' && data.strategy && data.strategy !== 'best-worst' && data.selected_symbols?.length;
      /** Worst-case slide only for “Best & Worst” (full-universe top vs bottom), not own picks or named fund strategies. */
      const showWorstSlide = !isOwnMode && !isStrategyMode;

      const bestVizEl = document.getElementById('personalize-best-viz');
      const worstVizEl = document.getElementById('personalize-worst-viz');

      investSlideEl?.setAttribute('hidden', '');
      resultsEl?.removeAttribute('hidden');

      bestVizEl.innerHTML = '<p class="personalize-loading">Loading…</p>';
      worstVizEl.innerHTML = showWorstSlide ? '<p class="personalize-loading">Loading…</p>' : '';

      let best;
      let worst = [];
      if (isOwnMode || isStrategyMode) {
        const returns = await loadStockReturnsForSymbols(data.selected_symbols, sp500Companies, startDate);
        best = returns;
        allocations = (data.allocations || []).slice(0, returns.length).map((a) => parseFloat(a) || 0);
        while (allocations.length < best.length) allocations.push(100 / best.length);
      } else {
        const returns = await loadStockReturns(usStockSymbols, sp500Companies, startDate);
        best = [...returns].sort((a, b) => b.pctChange - a.pctChange).slice(0, companyCount);
        worst = [...returns].sort((a, b) => a.pctChange - b.pctChange).slice(0, companyCount);
      }

      if (!best.length || (showWorstSlide && !worst.length)) {
        bestVizEl.innerHTML = '<p class="personalize-loading">Not enough price data for this period. Try a different start date.</p>';
        if (showWorstSlide) {
          worstVizEl.innerHTML = '<p class="personalize-loading">Not enough price data for this period. Try a different start date.</p>';
        } else {
          worstVizEl.innerHTML = '';
        }
        resultsEl?.setAttribute('hidden', '');
        investSlideEl?.removeAttribute('hidden');
        disconnectScrollAnimObservers();
        return false;
      }

      const n = best.length;
      while (allocations.length < n) {
        allocations.push(100 / n);
      }
      const allocsForCalc = allocations.slice(0, n);
      const allocSum = allocsForCalc.reduce((s, x) => s + x, 0);
      const normAllocations = allocSum > 0 ? allocsForCalc.map((a) => (a / allocSum) * 100) : allocsForCalc;
      const symbolToAlloc = new Map(best.map((c, i) => [c.symbol, normAllocations[i]]));

      const startDateLabel = startDate ? formatDateLabel(startDate) : '';

      bestData = {
        companies: best,
        allocations: normAllocations,
        initialMoney,
        finalValue: computePortfolioValue(best, normAllocations, initialMoney) ?? initialMoney,
        startDateLabel,
      };

      if (showWorstSlide && worst.length) {
        const worstAllocations = worst.map((c) => symbolToAlloc.get(c.symbol) ?? 100 / worst.length);
        worstData = {
          companies: worst,
          allocations: worstAllocations,
          initialMoney,
          finalValue: computePortfolioValue(worst, worstAllocations, initialMoney) ?? initialMoney,
          startDateLabel,
        };
      } else {
        worstData = null;
      }

      const bestTitleEl = document.querySelector('.personalize-slide-best .personalize-slide-title');
      const bestSubEl = document.querySelector('.personalize-slide-best .personalize-slide-subtitle');
      const worstSlide = document.querySelector('.personalize-slide-worst');
      const worstTitleEl = worstSlide?.querySelector('.personalize-slide-title');
      const worstSubEl = worstSlide?.querySelector('.personalize-slide-subtitle');

      if (isOwnMode) {
        if (worstSlide) worstSlide.hidden = true;
        renderOwnPicksViz(bestVizEl, bestData);
      } else if (isStrategyMode) {
        if (worstSlide) worstSlide.hidden = true;
        const strategyLabel = data.strategy_display_name || (data.strategy || '').replace(/[-_]/g, ' ').replace(/\d{4}-\d{2}-\d{2}/, '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
        if (bestTitleEl) bestTitleEl.textContent = `Strategy picks`;
        if (bestSubEl) bestSubEl.textContent = `How the ${strategyLabel}-style allocation would have performed`;
        renderOwnPicksViz(bestVizEl, bestData);
      } else {
        if (worstSlide) worstSlide.hidden = false;
        if (bestTitleEl) bestTitleEl.textContent = 'Best case';
        if (bestSubEl) bestSubEl.textContent = 'If you invested in the top performers from your start date';
        if (worstTitleEl) worstTitleEl.textContent = 'Worst case';
        if (worstSubEl) worstSubEl.textContent = 'If you invested in the biggest decliners from your start date';
        renderBestViz(bestVizEl, bestData);
        if (worstData) renderWorstViz(worstVizEl, worstData);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setupScrollTriggeredNumberAnimations();
        });
      });
      if (scrollToResults) {
        requestAnimationFrame(() => {
          document.getElementById('personalize-welcome-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      return true;
    },

    goToSlide,
  };
}
