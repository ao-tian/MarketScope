import * as DataLoader from './data/DataLoader.js';
import { loadStrategies, resolveStrategyHoldings } from './data/strategyLoader.js';
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
    personalizeModalApi = initPersonalizeModal(data.sp500Companies, data.usStockSymbols || []);
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
    const LATEST_DATA_DATE = '2017-11-10';
    if (dobInput) dobInput.setAttribute('max', today);
    if (startDateInput) startDateInput.setAttribute('max', LATEST_DATA_DATE);

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
    dobInput?.addEventListener('change', () => clampDateYear(dobInput, 1900, new Date().getFullYear()));
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
    const strategyHidden = document.getElementById('invest-strategy');
    const strategies = data.strategies || [];
    let selectedStrategyHoldings = null;

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
        return;
      }
      const strategy = strategies.find((s) => s.id === value);
      if (!strategy) return;
      const count = Math.min(10, Math.max(1, parseInt(companyCountInput?.value, 10) || 4));
      const holdings = resolveStrategyHoldings(strategy, data.sp500Companies, data.usStockSymbols, count);
      selectedStrategyHoldings = holdings;
      if (strategyDetailEl && strategyDetailListEl) {
        strategyDetailListEl.innerHTML = holdings
          .map((h) => `<li><strong>${h.symbol}</strong> ${h.name || ''} — ${h.allocPct.toFixed(1)}%</li>`)
          .join('');
        strategyDetailEl.removeAttribute('hidden');
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
    const formError = document.getElementById('invest-form-error');
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
        ? `Hi, <strong>${name}</strong>! Ready to pick your plays? Invest in your own companies, or let us suggest a strategy.`
        : 'Ready to pick your plays? Invest in your own companies, or let us suggest a strategy.';
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

    investForm.addEventListener('submit', (e) => {
      e.preventDefault();
      formError?.setAttribute('hidden', '');
      if (!investMode) {
        formError.textContent = 'Please choose how you want to invest: "Bring it on!" or "Give me some plans".';
        formError.removeAttribute('hidden');
        return;
      }
      const formData = new FormData(investForm);
      const count = Math.min(10, Math.max(1, parseInt(formData.get('company_count'), 10) || 4));

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
        savePersonalizeData({
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
        });
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
        savePersonalizeData({
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
        });
      }
      showRoute('personalize');
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
