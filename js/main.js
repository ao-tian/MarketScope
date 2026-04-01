import * as DataLoader from './data/DataLoader.js';
import { loadStrategies, resolveStrategyHoldings } from './data/strategyLoader.js';
import { getStrategyCeoImageUrl, getStrategyCeoVisual } from './utils/strategyCeo.js';
import { StockMapChart, StockExplainerViz } from './viz/vis1/index.js';
import { initFloatingSymbols, initFloatingSymbolsInvest } from './layout/FloatingSymbols.js';
import { initScrollAnimations } from './layout/ScrollAnimations.js';
import { initStockPlayfield, initCryptoPlayfield, initPersonalizeModal } from './pages/index.js';

const VIZ_REGISTRY = {
  'viz-1': {
    vizClass: StockMapChart,
    dataKeys: ['sp500Companies'],
    showAllByDefault: true,
    showStateShape: false,
    enableCompanyClick: true,
    showSpikes: true,
    captionDescription:
      "Next, explore where those big U.S. companies are headquartered: each state shows how many of them are based there.",
  },
  'viz-2': {
    vizClass: StockMapChart,
    dataKeys: ['sp500Companies'],
    timeScrubber: true,
    showAllByDefault: true,
    showStateShape: false,
    enableCompanyClick: true,
    captionDescription:
      "Drag the time bar to see how the corporate landscape grew: each year shows only companies founded by that point. More companies in a state means more investment opportunities tied to that place.",
  },
  'viz-3': {
    vizClass: StockExplainerViz,
    dataKeys: ['sp500Companies', 'sp500Index'],
    introText:
      "A stock is a share of ownership in a company—when you buy one, you own a small piece of that business. Below we start with the basics: what a stock is, how those big public companies group into sectors, and how a basket of top U.S. stocks moved over time. After that you can explore the industry map (GICS), state maps, and an interactive chart tutorial.",
  },
};

const vizInstances = {};

const PERSONALIZE_STORAGE_KEY = 'marketscope_personalize';

function getPersonalizeData() {
  try {
    const raw = localStorage.getItem(PERSONALIZE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersonalizeData(data) {
  try {
    localStorage.setItem(PERSONALIZE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save personalize data:', e);
  }
}

function clearPersonalizeData() {
  try {
    localStorage.removeItem(PERSONALIZE_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear personalize data:', e);
  }
}

function renderPersonalizeProfile(summaryEl, data) {
  if (!summaryEl || !data) return;
  const name = (data.name || '').trim() || 'there';
  const startLabel = data.start_mode === 'birth' ? 'From birth' : `From ${data.start_date || '—'}`;
  const count = Math.min(10, Math.max(1, parseInt(data.company_count, 10) || 4));
  summaryEl.innerHTML = `
    <h2 class="personalize-greeting personalize-greeting-nowrap">Hi ${escapeHtml(name)}, here's what you got</h2>
    <dl>
      <dt>Date of birth</dt>
      <dd>${escapeHtml(data.dob || '—')}</dd>
      <dt>Start investing</dt>
      <dd>${escapeHtml(startLabel)}</dd>
      <dt>Companies</dt>
      <dd>${count}</dd>
      <dt>Available to invest</dt>
      <dd>$${Number(data.available_money || 0).toLocaleString()}</dd>
    </dl>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Pointer-driven 3D tilt on playfield conclusion card (respects reduced motion). */
function initConclusionCardTilt() {
  const card = document.querySelector('.personalize-conclusion-card');
  if (!card || card.dataset.tiltBound === '1') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  card.dataset.tiltBound = '1';
  const maxTilt = 9;
  const scale = 1.024;
  const baseZ = 18;
  const tiltClass = 'personalize-conclusion-card--tilt-active';

  const baseShadow =
    '0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 4px 32px rgba(0, 0, 0, 0.45), 0 0 80px rgba(212, 175, 55, 0.12)';

  const applyTilt = (clientX, clientY) => {
    const rect = card.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const px = Math.max(0, Math.min(1, x / rect.width));
    const py = Math.max(0, Math.min(1, y / rect.height));
    const tiltY = (px - 0.5) * 2 * maxTilt;
    const tiltX = (0.5 - py) * 2 * maxTilt;
    card.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(${baseZ}px) scale3d(${scale}, ${scale}, ${scale})`;
    card.style.setProperty('--tilt-sheen-x', `${px * 100}%`);
    card.style.setProperty('--tilt-sheen-y', `${py * 100}%`);
    const shadowLift = 10 + Math.abs(tiltX) * 0.6 + Math.abs(tiltY) * 0.5;
    const goldGlow = 0.12 + (Math.abs(tiltX) + Math.abs(tiltY)) * 0.004;
    card.style.boxShadow = `${baseShadow}, 0 ${shadowLift}px 48px rgba(0, 0, 0, 0.38), 0 0 96px rgba(212, 175, 55, ${goldGlow})`;
    card.classList.add(tiltClass);
  };

  const resetTilt = () => {
    card.style.transform = '';
    card.style.boxShadow = '';
    card.style.removeProperty('--tilt-sheen-x');
    card.style.removeProperty('--tilt-sheen-y');
    card.classList.remove(tiltClass);
  };

  card.addEventListener('mousemove', (e) => applyTilt(e.clientX, e.clientY));
  card.addEventListener('mouseenter', (e) => applyTilt(e.clientX, e.clientY));
  card.addEventListener('mouseleave', resetTilt);

  card.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (t) applyTilt(t.clientX, t.clientY);
    },
    { passive: true }
  );
  card.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (t) applyTilt(t.clientX, t.clientY);
    },
    { passive: true }
  );
  card.addEventListener('touchend', resetTilt);
  card.addEventListener('touchcancel', resetTilt);
}

async function loadData() {
  const keys = [...new Set(Object.values(VIZ_REGISTRY).flatMap((r) => r.dataKeys))];
  const loaders = {
    sp500Index: DataLoader.datasets.sp500Index,
    sp500Companies: DataLoader.datasets.sp500Companies,
    usMarketEvents: DataLoader.datasets.usMarketEvents,
    financials: DataLoader.datasets.financials,
  };
  const result = {};
  await Promise.all(
    keys.map(async (key) => {
      const loader = loaders[key];
      if (loader) result[key] = await loader();
    })
  );
  result.usStockSymbols = await DataLoader.loadUSStockSymbols();
  result.strategies = await loadStrategies().catch(() => []);
  return result;
}

function mountViz(containerId, data) {
  const config = VIZ_REGISTRY[containerId];
  const container = document.getElementById(containerId);
  if (!config || !container) return;

  if (vizInstances[containerId]) vizInstances[containerId].unmount();
  container.innerHTML = '';

  const vizData = config.dataKeys.length
    ? config.dataKeys.length === 1
      ? data[config.dataKeys[0]]
      : config.dataKeys.reduce((acc, k) => ({ ...acc, [k]: data[k] }), {})
    : null;

  const viz = new config.vizClass(containerId);
  const opts = {
    width: container.clientWidth || window.innerWidth,
    height: 560,
    ...(config.colorScheme && { colorScheme: config.colorScheme }),
    ...(config.timeScrubber && { timeScrubber: config.timeScrubber }),
    ...(config.showAllByDefault && { showAllByDefault: config.showAllByDefault }),
    ...(config.showStateShape !== undefined && { showStateShape: config.showStateShape }),
    ...(config.captionDescription && { captionDescription: config.captionDescription }),
    ...(config.introText && { introText: config.introText }),
    ...(config.enableCompanyClick && { enableCompanyClick: config.enableCompanyClick }),
    ...(config.showSpikes && { showSpikes: config.showSpikes }),
  };
  const result = viz.mount(container, vizData, opts);
  vizInstances[containerId] = viz;
  if (result && typeof result.then === 'function') result.catch((e) => console.error('Viz mount failed:', e));
}

function cryptoNameSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveCryptoPathSegment(segment, cryptoList) {
  if (segment == null || segment === '' || !cryptoList?.length) return null;
  const raw = String(segment).trim();
  const upper = raw.toUpperCase();
  const bySym = cryptoList.find((c) => c.symbol?.toUpperCase() === upper);
  if (bySym) return String(bySym.symbol).toUpperCase();
  const slug = raw.toLowerCase();
  const byName = cryptoList.find((c) => cryptoNameSlug(c.name) === slug);
  if (byName) return String(byName.symbol).toUpperCase();
  return upper;
}

function cryptoPathSegmentForSymbol(symbol, cryptoList) {
  if (!symbol || !cryptoList?.length) return symbol ? String(symbol).toUpperCase() : '';
  const up = String(symbol).toUpperCase();
  const c = cryptoList.find((x) => x.symbol?.toUpperCase() === up);
  if (c?.name) return cryptoNameSlug(c.name);
  return up;
}

/** URL → raw route (crypto slug is resolved later via finalizeMarketsRoute + cryptoList). */
function parsePath(pathname) {
  let p = (pathname || '/').replace(/\/$/, '') || '/';
  if (p === '/index.html') p = '/home';
  if (p === '/' || p === '/home') return { page: 'home' };

  const parts = p.split('/').filter(Boolean);
  const head = parts[0];

  if (head === 'playfield' || head === 'personalize') {
    const playfieldResult = parts[1] === 'result';
    return { page: 'playfield', playfieldResult };
  }
  if (head === 'stock' || head === 'stocks') {
    const sym = parts[1] ? decodeURIComponent(parts[1]).toUpperCase() : null;
    return { page: 'markets', tab: 'stocks', symbol: sym };
  }
  if (head === 'crypto') {
    const seg = parts[1] != null && parts[1] !== '' ? decodeURIComponent(parts[1]) : null;
    return { page: 'markets', tab: 'crypto', cryptoSegment: seg };
  }
  return { page: 'home' };
}

function rawMarketsStateFromParsed(parsed) {
  if (parsed.page !== 'markets') {
    if (parsed.page === 'playfield') {
      return { page: 'playfield', playfieldResult: Boolean(parsed.playfieldResult) };
    }
    return { page: parsed.page };
  }
  if (parsed.tab === 'crypto') {
    return {
      page: 'markets',
      tab: 'crypto',
      ...(parsed.cryptoSegment ? { cryptoSegment: parsed.cryptoSegment } : {}),
    };
  }
  return { page: 'markets', tab: 'stocks', symbol: parsed.symbol || null };
}

function finalizeMarketsRoute(state, cryptoList) {
  if (state.page !== 'markets') return state;
  const tab = state.tab || 'stocks';
  if (tab === 'crypto' && state.cryptoSegment != null && state.cryptoSegment !== '') {
    const sym = resolveCryptoPathSegment(state.cryptoSegment, cryptoList || []);
    return { page: 'markets', tab: 'crypto', symbol: sym };
  }
  if (tab === 'crypto') return { page: 'markets', tab: 'crypto', symbol: state.symbol || null };
  return { page: 'markets', tab: 'stocks', symbol: state.symbol || null };
}

function pathFromState(state, cryptoList = null) {
  if (!state || state.page === 'home') return '/home';
  if (state.page === 'playfield') {
    return state.playfieldResult ? '/playfield/result' : '/playfield';
  }
  if (state.page === 'markets') {
    const tab = state.tab === 'crypto' ? 'crypto' : 'stocks';
    const base = tab === 'crypto' ? '/crypto' : '/stock';
    if (tab === 'stocks') {
      if (!state.symbol) return base;
      return `${base}/${encodeURIComponent(state.symbol)}`;
    }
    if (!state.symbol && state.cryptoSegment)
      return `${base}/${encodeURIComponent(state.cryptoSegment)}`;
    if (!state.symbol) return base;
    const seg = cryptoList ? cryptoPathSegmentForSymbol(state.symbol, cryptoList) : state.symbol;
    return `${base}/${encodeURIComponent(seg)}`;
  }
  return '/home';
}

function applyView(state) {
  const { page, tab = 'stocks' } = state || { page: 'home' };
  const marketsPage = document.getElementById('markets-page');
  const playfield = document.getElementById('playfield');
  const cryptoPlayfield = document.getElementById('crypto-playfield');
  const homeContent = document.getElementById('hero');
  const storySection = document.querySelector('.story-section');
  const personalizePage = document.getElementById('personalize-page');
  const promptToast = document.getElementById('personalize-prompt-toast');
  const tabStocks = document.getElementById('markets-tab-stocks');
  const tabCrypto = document.getElementById('markets-tab-crypto');

  document.querySelectorAll('.nav-link').forEach((a) => {
    const r = a.dataset.route;
    if (!r) return;
    if (r === 'home') a.classList.toggle('active', page === 'home');
    else if (r === 'markets') a.classList.toggle('active', page === 'markets');
    else if (r === 'playfield') a.classList.toggle('active', page === 'playfield');
  });

  marketsPage?.setAttribute('hidden', '');
  playfield?.setAttribute('hidden', '');
  cryptoPlayfield?.setAttribute('hidden', '');
  personalizePage?.setAttribute('hidden', '');
  promptToast?.setAttribute('aria-hidden', 'true');
  homeContent?.classList.remove('hidden');
  storySection?.classList.remove('hidden');

  const activeMarket = tab === 'crypto' ? 'crypto' : 'stocks';
  tabStocks?.setAttribute('aria-selected', activeMarket === 'stocks' ? 'true' : 'false');
  tabCrypto?.setAttribute('aria-selected', activeMarket === 'crypto' ? 'true' : 'false');
  tabStocks?.classList.toggle('markets-tab-active', activeMarket === 'stocks');
  tabCrypto?.classList.toggle('markets-tab-active', activeMarket === 'crypto');

  if (page === 'markets') {
    marketsPage?.removeAttribute('hidden');
    if (activeMarket === 'crypto') {
      cryptoPlayfield?.removeAttribute('hidden');
    } else {
      playfield?.removeAttribute('hidden');
    }
    homeContent?.classList.add('hidden');
    storySection?.classList.add('hidden');
    window.scrollTo(0, 0);
  } else if (page === 'playfield') {
    homeContent?.classList.add('hidden');
    storySection?.classList.add('hidden');
    personalizePage?.removeAttribute('hidden');
    const isResult = Boolean(state.playfieldResult);
    personalizePage?.setAttribute('data-playfield-view', isResult ? 'result' : 'form');
    const investShell = document.querySelector('#personalize-modal .personalize-slide-invest');
    const resultsShell = document.getElementById('personalize-results');
    if (isResult) {
      investShell?.setAttribute('hidden', '');
      resultsShell?.removeAttribute('hidden');
    } else {
      resultsShell?.setAttribute('hidden', '');
      investShell?.removeAttribute('hidden');
    }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => initFloatingSymbolsInvest()));
  } else {
    personalizePage?.removeAttribute('data-playfield-view');
  }
  document.documentElement.removeAttribute('data-ms-boot');
}

async function init() {
  const parsed = parsePath(window.location.pathname);
  let initialState = rawMarketsStateFromParsed(parsed);
  applyView(initialState);
  history.replaceState(initialState, '', pathFromState(initialState, null));

  initFloatingSymbols();
  initFloatingSymbolsInvest();
  initScrollAnimations();

  const data = await loadData();
  Object.keys(VIZ_REGISTRY).forEach((id) => mountViz(id, data));

  let stockPlayfieldApi = null;
  let cryptoPlayfieldApi = null;

  const playfield = document.getElementById('playfield');
  if (playfield) {
    stockPlayfieldApi = initStockPlayfield(playfield, {
      symbols: data.usStockSymbols,
      sp500Companies: data.sp500Companies,
    });
  }

  const cryptoList = await DataLoader.loadCryptoList();
  const cryptoPlayfield = document.getElementById('crypto-playfield');
  if (cryptoPlayfield) {
    cryptoPlayfieldApi = initCryptoPlayfield(cryptoPlayfield, { cryptoList });
  }

  initialState = finalizeMarketsRoute(initialState, cryptoList);
  history.replaceState(initialState, '', pathFromState(initialState, cryptoList));

  if (initialState.page === 'markets') {
    if (initialState.tab === 'crypto') {
      if (initialState.symbol) cryptoPlayfieldApi?.selectCrypto?.(initialState.symbol, { syncUrl: false });
      else cryptoPlayfieldApi?.resetToMain?.();
    } else if (initialState.symbol) {
      stockPlayfieldApi?.selectStock?.(initialState.symbol, { syncUrl: false });
    } else {
      stockPlayfieldApi?.resetToMain?.();
    }
  }

  let personalizeModalApi = null;
  if (data.sp500Companies) {
    personalizeModalApi = initPersonalizeModal(data.sp500Companies, data.usStockSymbols || []);
  }

  async function syncPlayfieldFromState(state) {
    const pData = getPersonalizeData();
    if (state.playfieldResult) {
      if (!pData) {
        navigate({ page: 'playfield', playfieldResult: false }, { replace: true });
        return;
      }
      renderPersonalizeProfile(document.getElementById('personalize-profile-summary'), pData);
      const ok = await personalizeModalApi?.loadAndRender?.(pData, { scrollToResults: true });
      if (ok === false) {
        const fe = document.getElementById('invest-form-error');
        if (fe) {
          fe.textContent =
            'Could not load price data for this period. Try a different start date or try again.';
          fe.removeAttribute('hidden');
        }
        navigate({ page: 'playfield', playfieldResult: false }, { replace: true });
      }
      return;
    }
    personalizeModalApi?.goToSlide?.(0);
    if (pData) {
      window.populateFormFromData?.(document.querySelector('.invest-cta-form'), pData);
    }
  }

  function afterPersonalizeNav(state) {
    if (state.page !== 'playfield') return;
    void syncPlayfieldFromState(state);
  }

  function syncMarketsFromState(st) {
    if (st.page !== 'markets') return;
    if (st.tab === 'crypto') {
      if (st.symbol) cryptoPlayfieldApi?.selectCrypto?.(st.symbol, { syncUrl: false });
      else cryptoPlayfieldApi?.resetToMain?.();
    } else if (st.symbol) {
      stockPlayfieldApi?.selectStock?.(st.symbol, { syncUrl: false });
    } else {
      stockPlayfieldApi?.resetToMain?.();
    }
  }

  function navigate(state, { replace = false } = {}) {
    if (state.page !== 'markets') {
      const normalized =
        state.page === 'playfield'
          ? { page: 'playfield', playfieldResult: Boolean(state.playfieldResult) }
          : state;
      const path = pathFromState(normalized, cryptoList);
      if (replace) history.replaceState(normalized, '', path);
      else history.pushState(normalized, '', path);
      applyView(normalized);
      afterPersonalizeNav(normalized);
      return;
    }
    const merged = {
      page: 'markets',
      tab: state.tab || 'stocks',
      symbol: state.symbol ?? null,
      ...(state.cryptoSegment ? { cryptoSegment: state.cryptoSegment } : {}),
    };
    const normalized = finalizeMarketsRoute(merged, cryptoList);
    const path = pathFromState(normalized, cryptoList);
    if (replace) history.replaceState(normalized, '', path);
    else history.pushState(normalized, '', path);
    applyView(normalized);
    syncMarketsFromState(normalized);
    afterPersonalizeNav(normalized);
  }

  window.addEventListener('marketscope:syncMarketsUrl', (e) => {
    const { tab, symbol } = e.detail || {};
    if (tab !== 'stocks' && tab !== 'crypto') return;
    const next = finalizeMarketsRoute(
      { page: 'markets', tab: tab === 'crypto' ? 'crypto' : 'stocks', symbol: symbol || null },
      cryptoList
    );
    const path = pathFromState(next, cryptoList);
    history.pushState(next, '', path);
  });

  function showRoute(route) {
    if (route === 'home') navigate({ page: 'home' });
    else if (route === 'stocks') navigate({ page: 'markets', tab: 'stocks' });
    else if (route === 'crypto') navigate({ page: 'markets', tab: 'crypto' });
    else if (route === 'playfield') navigate({ page: 'playfield' });
  }

  document.querySelectorAll('a[data-route]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const r = a.dataset.route;
      if (r === 'home') navigate({ page: 'home' });
      else if (r === 'markets') navigate({ page: 'markets', tab: 'stocks' });
      else if (r === 'playfield') navigate({ page: 'playfield' });
    });
  });

  document.querySelectorAll('.markets-tab').forEach((tabEl) => {
    tabEl.addEventListener('click', (e) => {
      e.preventDefault();
      const t = tabEl.dataset.marketsTab;
      if (t === 'crypto') navigate({ page: 'markets', tab: 'crypto' });
      else navigate({ page: 'markets', tab: 'stocks' });
    });
  });

  window.addEventListener('popstate', (e) => {
    const fromPath = parsePath(window.location.pathname);
    let st =
      e.state && e.state.page
        ? { ...e.state }
        : finalizeMarketsRoute(rawMarketsStateFromParsed(fromPath), cryptoList);
    if (st.page === 'playfield' && fromPath.page === 'playfield') {
      st.playfieldResult = Boolean(fromPath.playfieldResult);
    }
    if (st.page === 'markets' && !st.tab) st = { ...st, tab: 'stocks' };
    if (st.page === 'markets') st = finalizeMarketsRoute(st, cryptoList);
    applyView(st);
    syncMarketsFromState(st);
    afterPersonalizeNav(st);
  });

  const investForm = document.querySelector('.invest-cta-form');
  if (investForm) {
    const dobInput = document.getElementById('invest-dob');
    const startDateInput = document.getElementById('invest-start-date');
    const LATEST_DATA_DATE = '2017-11-10';
    const DOB_MIN_STR = '1900-01-01';
    /** DOB caps at dataset end so “from birth” has price history through our last close. */
    const DOB_MAX_STR = LATEST_DATA_DATE;
    if (dobInput) {
      dobInput.setAttribute('min', DOB_MIN_STR);
      dobInput.setAttribute('max', DOB_MAX_STR);
    }
    if (startDateInput) startDateInput.setAttribute('max', LATEST_DATA_DATE);

    function dobRangeMessage() {
      return `Date of birth must be between January 1, 1900 and November 10, 2017 (valid range: ${DOB_MIN_STR} to ${DOB_MAX_STR}, matching our stock history).`;
    }

    function isDobInRange(value) {
      if (value == null || String(value).trim() === '') return false;
      const s = String(value).trim();
      return s >= DOB_MIN_STR && s <= DOB_MAX_STR;
    }

    const formError = document.getElementById('invest-form-error');

    const clampDateYear = (input, minY = 1900, maxY = 2099) => {
      if (!input?.value) return;
      const parts = input.value.trim().split('-');
      if (parts.length !== 3) return;
      let y = parseInt(parts[0], 10);
      const m = parts[1];
      const d = parts[2];
      if (isNaN(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return;
      // Expand truncated years before clamping: 203 -> 2003, 23 -> 2023, 3 -> 2003
      if (y >= 0 && y <= 99) {
        y = y <= 30 ? 2000 + y : 1900 + y;
      } else if (y >= 100 && y <= 999) {
        y = y <= 299 ? 2000 + (y % 100) : 1900 + (y % 100);
      }
      if (y >= minY && y <= maxY) return;
      const clamped = Math.max(minY, Math.min(maxY, y));
      const newVal = `${clamped}-${m}-${d}`;
      if (input.value !== newVal) input.value = newVal;
    };
    dobInput?.addEventListener('change', () => clampDateYear(dobInput, 1900, 2017));
    dobInput?.addEventListener('input', () => {
      if (formError && formError.textContent === dobRangeMessage()) {
        if (isDobInRange(dobInput.value)) {
          formError.setAttribute('hidden', '');
          formError.textContent = '';
        }
      }
    });
    startDateInput?.addEventListener('change', () => clampDateYear(startDateInput, 1900, 2017));

    const startModeRadios = investForm.querySelectorAll('input[name="start_mode"]');
    startModeRadios?.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (startDateInput) startDateInput.required = radio.value === 'date';
      });
    });

    const strategyOptionsEl = document.getElementById('invest-strategy-options');
    const strategyDetailEl = document.getElementById('invest-strategy-detail');
    const strategyDetailListEl = document.getElementById('invest-strategy-detail-list');
    const strategyCeoCardEl = document.getElementById('invest-strategy-ceo-card');
    const strategyCeoFrameEl = document.getElementById('invest-strategy-ceo-frame');
    const strategyCeoImgEl = document.getElementById('invest-strategy-ceo-img');
    const strategyCeoNameEl = document.getElementById('invest-strategy-ceo-name');
    const strategyCeoNoteEl = document.getElementById('invest-strategy-ceo-note');
    const strategyHidden = document.getElementById('invest-strategy');
    const strategies = data.strategies || [];
    let selectedStrategyHoldings = null;

    function hideStrategyCeoCard() {
      strategyCeoCardEl?.setAttribute('hidden', '');
      if (strategyCeoImgEl) {
        strategyCeoImgEl.removeAttribute('src');
        strategyCeoImgEl.alt = '';
      }
      if (strategyCeoNameEl) strategyCeoNameEl.textContent = '';
      if (strategyCeoNoteEl) {
        strategyCeoNoteEl.textContent = '';
        strategyCeoNoteEl.setAttribute('hidden', '');
      }
      strategyCeoFrameEl?.classList.remove('invest-strategy-ceo-frame--logo');
    }

    function renderStrategyCeo(strategyId) {
      const vis = getStrategyCeoVisual(strategyId);
      if (!vis || !strategyCeoCardEl || !strategyCeoImgEl || !strategyCeoNameEl || !strategyCeoNoteEl || !strategyCeoFrameEl) {
        hideStrategyCeoCard();
        return;
      }
      const url = getStrategyCeoImageUrl(strategyId);
      strategyCeoImgEl.src = url || '';
      strategyCeoImgEl.alt = vis.name;
      strategyCeoNameEl.textContent = vis.name;
      strategyCeoFrameEl.classList.toggle('invest-strategy-ceo-frame--logo', !!vis.isLogo);
      if (vis.note) {
        strategyCeoNoteEl.textContent = vis.note;
        strategyCeoNoteEl.removeAttribute('hidden');
      } else {
        strategyCeoNoteEl.textContent = '';
        strategyCeoNoteEl.setAttribute('hidden', '');
      }
      strategyCeoCardEl.removeAttribute('hidden');
    }

    function renderStrategyOptions() {
      if (!strategyOptionsEl) return;
      strategyOptionsEl.innerHTML = '';
      const bestWorstDesc = 'Compare the best and worst outcomes: we pick the top performers vs. biggest decliners from your start date.';
      const opts = [
        ...strategies.map((s) => ({ value: s.id, label: s.displayName, desc: s.description })),
        { value: 'best-worst', label: 'Best & Worst', desc: bestWorstDesc },
      ];
      opts.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'invest-strategy-opt';
        btn.dataset.value = opt.value;
        btn.innerHTML = `${opt.label} <span class="invest-strategy-help" title="${(opt.desc || '').replace(/"/g, '&quot;')}">?</span>`;
        btn.addEventListener('click', () => selectStrategy(opt.value, opt.label));
        strategyOptionsEl.appendChild(btn);
      });
    }

    function selectStrategy(value, label) {
      if (strategyHidden) strategyHidden.value = value || 'best-worst';
      strategyOptionsEl?.querySelectorAll('.invest-strategy-opt').forEach((b) => {
        b.classList.toggle('selected', b.dataset.value === value);
      });
      selectedStrategyHoldings = null;
      if (value === 'best-worst') {
        strategyDetailEl?.setAttribute('hidden', '');
        hideStrategyCeoCard();
        return;
      }
      const strategy = strategies.find((s) => s.id === value);
      if (!strategy) {
        hideStrategyCeoCard();
        return;
      }
      const count = Math.min(10, Math.max(1, parseInt(companyCountInput?.value, 10) || 4));
      const holdings = resolveStrategyHoldings(strategy, data.sp500Companies, data.usStockSymbols, count);
      selectedStrategyHoldings = holdings;
      if (strategyDetailEl && strategyDetailListEl) {
        strategyDetailListEl.innerHTML = holdings
          .map((h) => `<li><strong>${h.symbol}</strong> ${h.name || ''} — ${h.allocPct.toFixed(1)}%</li>`)
          .join('');
        strategyDetailEl.removeAttribute('hidden');
        renderStrategyCeo(value);
      }
    }

    renderStrategyOptions();
    strategyOptionsEl?.querySelector('.invest-strategy-opt[data-value="best-worst"]')?.classList.add('selected');

    const companyCountInput = document.getElementById('invest-company-count');
    const modePanel = document.getElementById('invest-mode-panel');
    const modeGreeting = document.getElementById('invest-mode-greeting');
    const customPanel = document.getElementById('invest-custom-panel');
    const strategyPanel = document.getElementById('invest-strategy-panel');
    const companySlotsContainer = document.getElementById('invest-company-slots-container');
    const allocationsHint = document.getElementById('invest-allocations-hint');
    let investMode = null;
    let slotData = [];

    const sp500Set = new Set((data.sp500Companies || []).map((c) => (c.Symbol || '').toUpperCase()));
    const allCompanies = [
      ...(data.sp500Companies || []),
      ...(data.usStockSymbols || [])
        .filter((s) => {
          const sym = String(s).toUpperCase();
          return sym && !sym.includes('.') && !sp500Set.has(sym);
        })
        .map((s) => ({ Symbol: s, Shortname: s, Longname: s })),
    ];

    function updateModeGreeting() {
      if (!modeGreeting) return;
      const name = (document.getElementById('invest-name')?.value || '').trim();
      modeGreeting.innerHTML = name
        ? `Hi, <strong>${name}</strong>! Choose how to build your trial portfolio: pick companies yourself, or use a preset based on well-known funds.`
        : 'Choose how to build your trial portfolio: pick companies yourself, or use a preset based on well-known funds.';
    }

    document.getElementById('invest-name')?.addEventListener('input', updateModeGreeting);
    updateModeGreeting();

    document.querySelectorAll('.invest-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        investMode = btn.dataset.mode || null;
        document.querySelectorAll('.invest-mode-btn').forEach((b) => b.removeAttribute('data-active'));
        btn.setAttribute('data-active', 'true');
        if (investMode === 'own') {
          customPanel?.removeAttribute('hidden');
          strategyPanel?.setAttribute('hidden', '');
          buildCustomCompanySlots(companyCountInput?.value ?? 4);
        } else if (investMode === 'plan') {
          customPanel?.setAttribute('hidden', '');
          strategyPanel?.removeAttribute('hidden');
        }
      });
    });

    function buildCustomCompanySlots(count) {
      if (!companySlotsContainer) return;
      const n = Math.min(10, Math.max(1, parseInt(count, 10) || 4));
      slotData = Array(n).fill(null).map(() => ({ symbol: null, name: null }));
      companySlotsContainer.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const slot = document.createElement('div');
        slot.className = 'invest-company-slot';
        slot.innerHTML = `
          <span class="invest-slot-label">Company ${i + 1}</span>
          <div class="invest-slot-search-wrap">
            <input type="text" class="invest-form-input invest-slot-search" data-slot="${i}" placeholder="Search or browse all companies..." autocomplete="off">
            <button type="button" class="invest-slot-browse-btn" data-slot="${i}" aria-label="Browse all companies">▾</button>
            <div class="invest-company-search-results invest-slot-results" data-slot="${i}" aria-live="polite" hidden></div>
          </div>
          <span class="invest-slot-pct-wrap">
            <input type="number" class="invest-form-input invest-slot-pct" name="allocation_${i}" min="0" max="100" step="0.1" placeholder="33.3" aria-label="Allocation percentage" value="${(100 / n).toFixed(1)}">
            <span class="invest-slot-pct-suffix">%</span>
          </span>
        `;
        companySlotsContainer.appendChild(slot);
      }

      companySlotsContainer.querySelectorAll('.invest-slot-search').forEach((input) => {
        const slotIdx = parseInt(input.dataset.slot, 10);
        const slotResults = input.parentElement?.querySelector('.invest-slot-results');
        const browseBtn = input.parentElement?.querySelector('.invest-slot-browse-btn');
        const renderMatch = (c) => {
          const name = (c.Shortname || c.Longname || c.Symbol || '');
          return `<button type="button" class="invest-company-result" data-symbol="${(c.Symbol || '').toUpperCase()}" data-name="${name.replace(/"/g, '&quot;')}">${c.Symbol} — ${name}</button>`;
        };
        const attachResultHandlers = () => {
          slotResults.querySelectorAll('.invest-company-result').forEach((b) => {
            b.addEventListener('mousedown', (e) => e.preventDefault());
            b.addEventListener('click', (e) => {
              e.preventDefault();
              const sym = b.dataset.symbol;
              const nm = b.dataset.name || sym;
              slotData[slotIdx] = { symbol: sym, name: nm };
              input.value = `${sym} — ${nm || sym}`;
              slotResults.hidden = true;
              slotResults.innerHTML = '';
            });
          });
        };
        input.addEventListener('blur', () => setTimeout(() => { if (slotResults) slotResults.hidden = true; }, 200));
        input.addEventListener('focus', () => {
          if (input.value.trim().length < 2 && slotResults) {
            const browseList = allCompanies.slice(0, 400);
            slotResults.innerHTML = browseList.map(renderMatch).join('');
            slotResults.hidden = browseList.length === 0;
            attachResultHandlers();
          }
        });
        input.addEventListener('input', (e) => {
          const q = e.target.value.trim();
          if (!slotResults) return;
          if (q.length < 2) {
            const browseList = allCompanies.slice(0, 400);
            slotResults.innerHTML = browseList.map(renderMatch).join('');
            slotResults.hidden = browseList.length === 0;
            attachResultHandlers();
            if (q.length === 0) slotData[slotIdx] = { symbol: null, name: null };
            return;
          }
          const ql = q.toLowerCase();
          const matches = allCompanies
            .filter((c) => {
              const sym = (c.Symbol || '').toLowerCase();
              const nm = [c.Shortname, c.Longname].filter(Boolean).join(' ').toLowerCase();
              return sym.includes(ql) || nm.includes(ql);
            })
            .slice(0, 12);
          slotResults.innerHTML = matches.map(renderMatch).join('');
          slotResults.hidden = matches.length === 0;
          attachResultHandlers();
        });
        browseBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          input.focus();
          const browseList = allCompanies.slice(0, 400);
          slotResults.innerHTML = browseList.map(renderMatch).join('');
          slotResults.hidden = false;
          attachResultHandlers();
        });
      });

      companySlotsContainer.querySelectorAll('.invest-slot-pct').forEach((inp) => {
        inp.addEventListener('input', updateCustomAllocationsHint);
      });
      updateCustomAllocationsHint();
    }

    function updateCustomAllocationsHint() {
      if (!allocationsHint) return;
      const inputs = companySlotsContainer?.querySelectorAll('.invest-slot-pct');
      if (!inputs?.length) return;
      const sum = [...inputs].reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
      allocationsHint.textContent = `Total: ${sum.toFixed(1)}%`;
      allocationsHint.classList.remove('invest-allocations-valid', 'invest-allocations-invalid');
      if (Math.abs(sum - 100) < 0.1) allocationsHint.classList.add('invest-allocations-valid');
      else if (sum > 0) allocationsHint.classList.add('invest-allocations-invalid');
    }

    companyCountInput?.addEventListener('change', () => {
      if (investMode === 'own') buildCustomCompanySlots(companyCountInput.value);
      else if (strategyHidden?.value && strategyHidden.value !== 'best-worst') {
        const s = strategies.find((x) => x.id === strategyHidden.value);
        if (s) selectStrategy(s.id, s.displayName);
      }
    });
    companyCountInput?.addEventListener('input', () => {
      if (investMode === 'own') buildCustomCompanySlots(companyCountInput.value);
      else if (strategyHidden?.value && strategyHidden.value !== 'best-worst') {
        const s = strategies.find((x) => x.id === strategyHidden.value);
        if (s) selectStrategy(s.id, s.displayName);
      }
    });

    investForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError?.setAttribute('hidden', '');
      const dobVal = investForm.querySelector('#invest-dob')?.value;
      if (!isDobInRange(dobVal)) {
        if (formError) {
          formError.textContent = dobRangeMessage();
          formError.removeAttribute('hidden');
        }
        document.getElementById('invest-dob')?.focus();
        return;
      }
      if (!investMode) {
        formError.textContent =
          'Please choose how you want to invest: "Pick my own companies" or "Use a fund-style strategy".';
        formError.removeAttribute('hidden');
        return;
      }
      const formData = new FormData(investForm);
      const count = Math.min(10, Math.max(1, parseInt(formData.get('company_count'), 10) || 4));

      let saved;
      if (investMode === 'own') {
        const symbols = slotData.filter((s) => s?.symbol).map((s) => s.symbol);
        const allocations = [];
        for (let i = 0; i < count; i++) {
          allocations.push(parseFloat(formData.get(`allocation_${i}`)) || 0);
        }
        const sum = allocations.reduce((s, a) => s + a, 0);
        if (symbols.length !== count) {
          formError.textContent = `Please select ${count} companies (one per slot).`;
          formError.removeAttribute('hidden');
          return;
        }
        if (Math.abs(sum - 100) >= 0.1) {
          formError.textContent = `Allocations must total 100%. Currently: ${sum.toFixed(1)}%.`;
          formError.removeAttribute('hidden');
          return;
        }
        saved = {
          name: formData.get('name') || '',
          dob: formData.get('dob'),
          start_mode: formData.get('start_mode'),
          start_date: formData.get('start_date') || null,
          available_money: formData.get('available_money'),
          company_count: String(count),
          allocations: allocations.map(String),
          strategy: 'best-worst',
          invest_mode: 'own',
          selected_symbols: symbols,
        };
        savePersonalizeData(saved);
      } else {
        const strategy = formData.get('strategy') || 'best-worst';
        let selected_symbols = [];
        let allocations = [];
        const strategyDisplayName =
          strategy !== 'best-worst' ? strategies.find((s) => s.id === strategy)?.displayName : null;
        if (strategy !== 'best-worst' && selectedStrategyHoldings?.length) {
          selected_symbols = selectedStrategyHoldings.map((h) => h.symbol);
          allocations = selectedStrategyHoldings.map((h) => String(h.allocPct));
        }
        saved = {
          name: formData.get('name') || '',
          dob: formData.get('dob'),
          start_mode: formData.get('start_mode'),
          start_date: formData.get('start_date') || null,
          available_money: formData.get('available_money'),
          company_count: String(count),
          allocations,
          strategy,
          strategy_display_name: strategyDisplayName,
          invest_mode: 'plan',
          selected_symbols,
        };
        savePersonalizeData(saved);
      }
      navigate({ page: 'playfield', playfieldResult: true });
    });

    window.populateFormFromData = function (form, data) {
      if (!form || !data) return;
      const nameInput = form.querySelector('#invest-name');
      const dob = form.querySelector('#invest-dob');
      const money = form.querySelector('#invest-money');
      const startDate = form.querySelector('#invest-start-date');
      const companyCount = form.querySelector('#invest-company-count');
      const strategyHidden = form.querySelector('#invest-strategy');
      const strategyOptionsEl = form.querySelector('#invest-strategy-options');
      const birthRadio = form.querySelector('input[name="start_mode"][value="birth"]');
      const dateRadio = form.querySelector('input[name="start_mode"][value="date"]');
      if (nameInput && data.name != null) nameInput.value = data.name;
      if (dob && data.dob) dob.value = data.dob;
      if (money && data.available_money) money.value = data.available_money;
      if (companyCount && data.company_count) companyCount.value = data.company_count;
      if (strategyHidden && data.strategy) {
        strategyHidden.value = data.strategy;
        const s = strategies.find((x) => x.id === data.strategy);
        const label = s ? s.displayName : 'Best & Worst';
        selectStrategy(data.strategy, label);
      }
      if (data.invest_mode === 'own') {
        investMode = 'own';
        document.querySelector('.invest-mode-btn[data-mode="own"]')?.setAttribute('data-active', 'true');
        document.querySelector('.invest-mode-btn[data-mode="plan"]')?.removeAttribute('data-active');
        customPanel?.removeAttribute('hidden');
        strategyPanel?.setAttribute('hidden', '');
        buildCustomCompanySlots(companyCount?.value ?? 4);
        if (data.selected_symbols?.length && data.allocations?.length) {
          setTimeout(() => {
            const searchInputs = companySlotsContainer?.querySelectorAll('.invest-slot-search');
            const pctInputs = companySlotsContainer?.querySelectorAll('.invest-slot-pct');
            data.selected_symbols.forEach((sym, i) => {
              if (searchInputs?.[i]) searchInputs[i].value = sym;
              if (pctInputs?.[i] && data.allocations[i]) pctInputs[i].value = data.allocations[i];
              slotData[i] = { symbol: sym, name: sym };
            });
            updateCustomAllocationsHint();
          }, 0);
        }
      } else if (data.invest_mode === 'plan') {
        investMode = 'plan';
        document.querySelector('.invest-mode-btn[data-mode="plan"]')?.setAttribute('data-active', 'true');
        document.querySelector('.invest-mode-btn[data-mode="own"]')?.removeAttribute('data-active');
        customPanel?.setAttribute('hidden', '');
        strategyPanel?.removeAttribute('hidden');
      }
      if (data.start_mode === 'date') {
        if (dateRadio) dateRadio.checked = true;
        if (startDate) {
          startDate.value = data.start_date || '';
          startDate.required = true;
        }
      } else {
        if (birthRadio) birthRadio.checked = true;
        if (startDate) startDate.required = false;
      }
    };

    window.resetInvestPlayfieldForm = function () {
      if (!investForm) return;
      investForm.reset();
      formError?.setAttribute('hidden', '');
      investMode = null;
      slotData = [];
      selectedStrategyHoldings = null;
      document.querySelectorAll('.invest-mode-btn').forEach((b) => b.removeAttribute('data-active'));
      customPanel?.setAttribute('hidden', '');
      strategyPanel?.setAttribute('hidden', '');
      strategyDetailEl?.setAttribute('hidden', '');
      hideStrategyCeoCard();
      if (strategyHidden) strategyHidden.value = 'best-worst';
      strategyOptionsEl?.querySelectorAll('.invest-strategy-opt').forEach((b) => {
        b.classList.toggle('selected', b.dataset.value === 'best-worst');
      });
      companySlotsContainer && (companySlotsContainer.innerHTML = '');
      const birthR = investForm.querySelector('input[name="start_mode"][value="birth"]');
      const dateR = investForm.querySelector('input[name="start_mode"][value="date"]');
      if (birthR) birthR.checked = true;
      if (dateR) dateR.checked = false;
      if (startDateInput) {
        startDateInput.value = '';
        startDateInput.required = false;
      }
      if (companyCountInput) companyCountInput.value = '4';
      updateModeGreeting();
    };
  }

  const personalizeRefillBtn = document.getElementById('personalize-refill-btn');
  personalizeRefillBtn?.addEventListener('click', () => {
    navigate({ page: 'playfield', playfieldResult: false });
  });

  document.getElementById('personalize-clear-btn')?.addEventListener('click', () => {
    clearPersonalizeData();
    window.resetInvestPlayfieldForm?.();
    navigate({ page: 'playfield', playfieldResult: false });
  });

  const promptToast = document.getElementById('personalize-prompt-toast');
  const promptScrollBtn = promptToast?.querySelector('.personalize-prompt-scroll');
  promptScrollBtn?.addEventListener('click', () => {
    promptToast?.setAttribute('aria-hidden', 'true');
    navigate({ page: 'playfield' });
  });

  window.addEventListener('marketscope:openStock', (e) => {
    const { symbol } = e.detail || {};
    if (symbol) navigate({ page: 'markets', tab: 'stocks', symbol });
  });

  window.addEventListener('marketscope:goBackToGics', (e) => {
    const { scrollTarget } = e.detail || {};
    showRoute('home');
    if (scrollTarget) {
      setTimeout(() => {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  });

  initConclusionCardTilt();
  afterPersonalizeNav(initialState);
}

init().catch((err) => console.error('App init failed:', err));
