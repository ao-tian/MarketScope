import * as DataLoader from './data/DataLoader.js';
import { StockMapChart, StockExplainerViz } from './viz/vis1/index.js';
import { initFloatingSymbols } from './layout/FloatingSymbols.js';
import { initScrollAnimations } from './layout/ScrollAnimations.js';
import { initStockPlayfield, initCryptoPlayfield } from './pages/index.js';

const VIZ_REGISTRY = {
  'viz-1': { vizClass: StockMapChart, dataKeys: ['sp500Companies'] },
  'viz-2': { vizClass: StockMapChart, dataKeys: ['sp500Companies'], timeScrubber: true },
  'viz-3': { vizClass: StockExplainerViz, dataKeys: ['sp500Companies', 'sp500Index'] },
};

const vizInstances = {};

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
  document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

  playfield?.setAttribute('hidden', '');
  cryptoPlayfield?.setAttribute('hidden', '');
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
  }
}

async function init() {
  initFloatingSymbols();
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

  document.querySelectorAll('.nav-link[data-route]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showRoute(a.dataset.route);
    });
  });

  const originalShowRoute = showRoute;
  showRoute = function (route) {
    if (route === 'stocks') stockPlayfieldApi?.resetToMain?.();
    if (route === 'crypto') cryptoPlayfieldApi?.resetToMain?.();
    originalShowRoute(route);
  };

  showRoute('home');
}

init().catch((err) => console.error('App init failed:', err));
