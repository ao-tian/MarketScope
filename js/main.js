import * as DataLoader from './data/DataLoader.js';
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
      "What is stock? Let's start by investigating how the S&P 500 — America's top 500 publicly traded companies — are distributed across the United States.",
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
      "A stock is simply a share of ownership in a company. When you buy a share, you own a small piece of that business and can benefit when the company grows. Below, we break down the basics: how stocks work, how the S&P 500 is split across sectors, and how prices move over time. Together with the maps above, this shows where and what these companies are—and why understanding them matters.",
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
  const count = Math.min(10, Math.max(1, parseInt(data.company_count, 10) || 3));
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

function showRoute(route) {
  const playfield = document.getElementById('playfield');
  const cryptoPlayfield = document.getElementById('crypto-playfield');
  const homeContent = document.getElementById('hero');
  const storySection = document.querySelector('.story-section');
  const personalizePage = document.getElementById('personalize-page');
  const promptToast = document.getElementById('personalize-prompt-toast');

  document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

  playfield?.setAttribute('hidden', '');
  cryptoPlayfield?.setAttribute('hidden', '');
  personalizePage?.setAttribute('hidden', '');
  promptToast?.setAttribute('aria-hidden', 'true');
  homeContent?.classList.remove('hidden');
  storySection?.classList.remove('hidden');

  if (route === 'stocks') {
    playfield?.removeAttribute('hidden');
    homeContent?.classList.add('hidden');
    storySection?.classList.add('hidden');
    window.scrollTo(0, 0);
  } else if (route === 'crypto') {
    cryptoPlayfield?.removeAttribute('hidden');
    homeContent?.classList.add('hidden');
    storySection?.classList.add('hidden');
    window.scrollTo(0, 0);
  } else if (route === 'personalize') {
    const data = getPersonalizeData();
    if (data) {
      homeContent?.classList.add('hidden');
      storySection?.classList.add('hidden');
      personalizePage?.removeAttribute('hidden');
      window.scrollTo(0, 0);
    } else {
      homeContent?.classList.remove('hidden');
      storySection?.classList.remove('hidden');
      promptToast?.setAttribute('aria-hidden', 'false');
      const formSection = document.querySelector('.invest-cta-section');
      setTimeout(() => formSection?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }
}

function initFloatingExplanationWords() {
  const el = document.querySelector('.personalize-module-explanation');
  if (!el) return;
  const text = el.textContent;
  const words = text.split(/\s+/);
  el.innerHTML = words
    .map((word, i) => {
      const span = document.createElement('span');
      span.className = 'personalize-explanation-word';
      span.style.animationDelay = `${(i % 12) * 0.08}s`;
      span.textContent = word;
      return span.outerHTML;
    })
    .join(' ');
}

async function init() {
  initFloatingSymbols();
  initFloatingSymbolsInvest();
  initScrollAnimations();
  initFloatingExplanationWords();

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

  let personalizeModalApi = null;
  if (data.sp500Companies) {
    personalizeModalApi = initPersonalizeModal(data.sp500Companies);
  }

  document.querySelectorAll('.nav-link[data-route]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showRoute(a.dataset.route);
    });
  });

  const investForm = document.querySelector('.invest-cta-form');
  if (investForm) {
    const dobInput = document.getElementById('invest-dob');
    const startDateInput = document.getElementById('invest-start-date');
    const today = new Date().toISOString().slice(0, 10);
    if (dobInput) dobInput.setAttribute('max', today);

    const clampDateYear = (input, minY = 1900, maxY = 2099) => {
      if (!input?.value) return;
      const d = new Date(input.value);
      if (isNaN(d.getTime())) return;
      const y = d.getFullYear();
      if (y < minY || y > maxY) {
        const clamped = Math.max(minY, Math.min(maxY, y));
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        input.value = `${clamped}-${m}-${day}`;
      }
    };
    dobInput?.addEventListener('change', () => clampDateYear(dobInput, 1900, new Date().getFullYear()));
    startDateInput?.addEventListener('change', () => clampDateYear(startDateInput));

    const startDateRow = document.getElementById('invest-start-date-row');
    const startModeRadios = investForm.querySelectorAll('input[name="start_mode"]');
    startModeRadios?.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (startDateRow) startDateRow.hidden = radio.value !== 'date';
        if (startDateInput) startDateInput.required = radio.value === 'date';
      });
    });

    const companyCountInput = document.getElementById('invest-company-count');
    const allocationsPanel = document.getElementById('invest-allocations-panel');
    const allocationsContainer = document.getElementById('invest-allocations-container');
    const allocationsHint = document.getElementById('invest-allocations-hint');
    const formError = document.getElementById('invest-form-error');

    function buildAllocationInputs(count) {
      const n = Math.min(10, Math.max(1, parseInt(count, 10) || 3));
      allocationsContainer.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const row = document.createElement('div');
        row.className = 'invest-allocation-row';
        row.innerHTML = `
          <label for="invest-pct-${i}">Company ${i + 1}</label>
          <input type="number" id="invest-pct-${i}" class="invest-form-input invest-allocation-input" name="allocation_${i}" min="0" max="100" step="0.1" placeholder="%" value="${(100 / n).toFixed(1)}">
        `;
        allocationsContainer.appendChild(row);
      }
      allocationsPanel?.removeAttribute('hidden');
      updateAllocationsHint();
      allocationsContainer.querySelectorAll('.invest-allocation-input').forEach((inp) => {
        inp.addEventListener('input', updateAllocationsHint);
      });
    }

    function updateAllocationsHint() {
      const inputs = allocationsContainer?.querySelectorAll('.invest-allocation-input');
      if (!inputs?.length) return;
      const sum = [...inputs].reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
      allocationsHint.textContent = `Total: ${sum.toFixed(1)}%`;
      allocationsHint.classList.remove('invest-allocations-valid', 'invest-allocations-invalid');
      if (Math.abs(sum - 100) < 0.1) allocationsHint.classList.add('invest-allocations-valid');
      else if (sum > 0) allocationsHint.classList.add('invest-allocations-invalid');
    }

    companyCountInput?.addEventListener('change', () => buildAllocationInputs(companyCountInput.value));
    companyCountInput?.addEventListener('input', () => buildAllocationInputs(companyCountInput.value));
    buildAllocationInputs(companyCountInput?.value ?? 3);

    investForm.addEventListener('submit', (e) => {
      e.preventDefault();
      formError?.setAttribute('hidden', '');
      const formData = new FormData(investForm);
      const count = Math.min(10, Math.max(1, parseInt(formData.get('company_count'), 10) || 3));
      const allocations = [];
      for (let i = 0; i < count; i++) {
        allocations.push(parseFloat(formData.get(`allocation_${i}`)) || 0);
      }
      const sum = allocations.reduce((s, a) => s + a, 0);
      if (Math.abs(sum - 100) >= 0.1) {
        if (formError) {
          formError.textContent = `Allocations must total 100%. Currently: ${sum.toFixed(1)}%.`;
          formError.removeAttribute('hidden');
        }
        return;
      }
      const data = {
        name: formData.get('name') || '',
        dob: formData.get('dob'),
        start_mode: formData.get('start_mode'),
        start_date: formData.get('start_date') || null,
        available_money: formData.get('available_money'),
        company_count: String(count),
        allocations: allocations.map(String),
      };
      savePersonalizeData(data);
      showRoute('personalize');
    });

    window.populateFormFromData = function (form, data) {
      if (!form || !data) return;
      const nameInput = form.querySelector('#invest-name');
      const dob = form.querySelector('#invest-dob');
      const money = form.querySelector('#invest-money');
      const startDate = form.querySelector('#invest-start-date');
      const companyCount = form.querySelector('#invest-company-count');
      const birthRadio = form.querySelector('input[name="start_mode"][value="birth"]');
      const dateRadio = form.querySelector('input[name="start_mode"][value="date"]');
      if (nameInput && data.name != null) nameInput.value = data.name;
      if (dob && data.dob) dob.value = data.dob;
      if (money && data.available_money) money.value = data.available_money;
      if (companyCount && data.company_count) companyCount.value = data.company_count;
      if (data.start_mode === 'date') {
        if (dateRadio) dateRadio.checked = true;
        if (startDate) startDate.value = data.start_date || '';
        document.getElementById('invest-start-date-row')?.removeAttribute('hidden');
      } else {
        if (birthRadio) birthRadio.checked = true;
        document.getElementById('invest-start-date-row')?.setAttribute('hidden', '');
      }
      buildAllocationInputs(companyCount?.value ?? 3);
      if (data.allocations?.length) {
        const inputs = document.getElementById('invest-allocations-container')?.querySelectorAll('.invest-allocation-input');
        data.allocations.forEach((v, i) => {
          if (inputs[i]) inputs[i].value = v;
        });
        updateAllocationsHint();
      }
    };
  }

  const personalizeRefillBtn = document.getElementById('personalize-refill-btn');
  personalizeRefillBtn?.addEventListener('click', () => {
    showRoute('home');
    window.populateFormFromData?.(document.querySelector('.invest-cta-form'), getPersonalizeData());
    const formSection = document.querySelector('.invest-cta-section');
    formSection?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('personalize-clear-btn')?.addEventListener('click', () => {
    clearPersonalizeData();
    showRoute('home');
  });

  const promptToast = document.getElementById('personalize-prompt-toast');
  const promptScrollBtn = promptToast?.querySelector('.personalize-prompt-scroll');
  promptScrollBtn?.addEventListener('click', () => {
    promptToast?.setAttribute('aria-hidden', 'true');
    const formSection = document.querySelector('.invest-cta-section');
    formSection?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('personalize-close-btn')?.addEventListener('click', () => showRoute('home'));

  const originalShowRoute = showRoute;
  showRoute = function (route) {
    if (route === 'stocks') stockPlayfieldApi?.resetToMain?.();
    if (route === 'crypto') cryptoPlayfieldApi?.resetToMain?.();
    originalShowRoute(route);
    if (route === 'personalize') {
      const pData = getPersonalizeData();
      if (pData) {
        renderPersonalizeProfile(document.getElementById('personalize-profile-summary'), pData);
        personalizeModalApi?.loadAndRender?.(pData);
      }
    }
  };

  window.addEventListener('marketscope:openStock', (e) => {
    const { symbol } = e.detail || {};
    if (symbol && stockPlayfieldApi?.selectStock) {
      showRoute('stocks');
      stockPlayfieldApi.selectStock(symbol);
    }
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

  showRoute('home');
}

init().catch((err) => console.error('App init failed:', err));
