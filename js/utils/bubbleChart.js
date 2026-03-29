/**
 * Packed bubble charts for playfield explorers.
 * Stocks: size = market cap; color = GICS sector. Crypto preview: size = list rank; color = distinct hues (not categorical).
 * Click a bubble to invoke onSelect(symbol).
 */
const SECTOR_COLORS = {
  Technology: '#1e40af',
  'Consumer Cyclical': '#dc2626',
  'Communication Services': '#7c3aed',
  'Consumer Defensive': '#16a34a',
  'Financial Services': '#0d9488',
  Healthcare: '#0891b2',
  Energy: '#ca8a04',
  Industrials: '#4b5563',
  'Real Estate': '#be185d',
  'Basic Materials': '#65a30d',
  Utilities: '#0284c7',
  default: '#64748b',
};

const STOCK_BUBBLE_MAX = 80;
const CRYPTO_BUBBLE_MAX = 24;

function bubblePackDimensions(containerEl) {
  const cw = Math.max(320, containerEl?.clientWidth || 960);
  const sideBySide = cw >= 960;
  const width = sideBySide
    ? Math.min(720, Math.max(400, Math.floor((cw - 80) * 0.46)))
    : Math.min(720, Math.max(300, cw - 48));
  const height = Math.min(760, Math.max(500, Math.round(width * 0.5)));
  return { width, height };
}

export function renderStockBubbles(container, { companies, symbolSet, onSelect }) {
  if (!container || !companies?.length) return;
  container.innerHTML = '';

  const available = companies
    .filter((c) => symbolSet.has(String(c.Symbol || '').toUpperCase()))
    .map((c) => ({
      symbol: c.Symbol,
      name: c.Shortname || c.Longname || c.Symbol,
      sector: c.Sector || 'Other',
      value: Math.max(1, +c.Marketcap || 1e9),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, STOCK_BUBBLE_MAX);

  if (!available.length) return;

  const visual = document.createElement('div');
  visual.className = 'playfield-bubble-chart-visual';
  container.appendChild(visual);

  visual.insertAdjacentHTML(
    'beforeend',
    `<p class="playfield-bubble-chart-title"><span class="playfield-bubble-chart-n">${STOCK_BUBBLE_MAX}</span> <span class="playfield-bubble-chart-of">of</span> the largest S&amp;P 500 names by market cap (with data in this app) · Click a bubble to explore</p>` +
      `<p class="playfield-bubble-chart-title-sub"><strong>${available.length}</strong> on this chart${
        available.length < STOCK_BUBBLE_MAX ? ' — fewer companies have data here' : ''
      }</p>`
  );

  const { width, height } = bubblePackDimensions(container);

  const root = d3.hierarchy({ children: available }).sum((d) => d.value);
  d3.pack().size([width, height]).padding(2)(root);

  const svg = d3
    .select(visual)
    .append('svg')
    .attr('class', 'playfield-bubble-svg')
    .attr('width', width)
    .attr('height', height);

  const node = svg
    .selectAll('g')
    .data(root.leaves())
    .join('g')
    .attr('transform', (d) => `translate(${d.x},${d.y})`)
    .attr('class', 'playfield-bubble-node')
    .style('cursor', 'pointer');

  const inner = node
    .append('g')
    .attr('class', 'playfield-bubble-float')
    .style('animation-delay', (d, i) => `${(i % 7) * 0.4}s`);

  inner
    .append('circle')
    .attr('r', (d) => d.r)
    .attr('fill', (d) => SECTOR_COLORS[d.data.sector] || SECTOR_COLORS.default)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .on('mouseover', function () {
      d3.select(this).attr('stroke-width', 3);
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke-width', 1.5);
    })
    .on('click', (e, d) => {
      e.stopPropagation();
      onSelect?.(d.data.symbol);
    });

  inner
    .append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', (d) => Math.min(22, d.r * 0.6))
    .attr('font-weight', 600)
    .text((d) => (d.r > 16 ? d.data.symbol : ''));

  node.append('title').text((d) => `${d.data.name} (${d.data.symbol})\n${d.data.sector}`);

  const legendData = [...new Set(available.map((a) => a.sector))].filter(Boolean).sort();
  const totalInUniverse = companies.filter((c) => symbolSet.has(String(c.Symbol || '').toUpperCase())).length;
  const legendEl = d3.select(container).append('div').attr('class', 'playfield-bubble-legend');
  legendEl
    .append('div')
    .attr('class', 'playfield-bubble-legend-body')
    .html(
      `<p class="playfield-bubble-legend-intro"><strong>What you’re seeing:</strong> Up to <strong>${STOCK_BUBBLE_MAX}</strong> S&amp;P 500 names, sorted by <strong>market cap</strong> and restricted to tickers we have in this app. ` +
        `Of the ${totalInUniverse} index names with data here, the chart shows the largest ${available.length}; the rest are omitted so bubbles stay legible. ` +
        `Use search to open any symbol with data.</p>` +
        `<ul class="playfield-bubble-legend-list">` +
        `<li><strong>Color</strong> = <strong>GICS sector</strong> (see key at right).</li>` +
        `<li><strong>Bubble size</strong> = <strong>market cap</strong> (area scales with cap; bigger bubble = larger company).</li>` +
        `</ul>` +
        `<p class="playfield-bubble-legend-cta">Click a bubble to open that stock.</p>`
    );
  legendEl.append('p').attr('class', 'playfield-bubble-legend-title').text('Sector colors');
  legendEl
    .append('div')
    .attr('class', 'playfield-bubble-legend-sectors')
    .selectAll('span')
    .data(legendData)
    .join('span')
    .attr('class', 'playfield-bubble-legend-item')
    .each(function (s) {
      d3.select(this).append('span').attr('class', 'playfield-bubble-legend-swatch').style('background', SECTOR_COLORS[s] || SECTOR_COLORS.default);
      d3.select(this).append('span').attr('class', 'playfield-bubble-legend-label').text(s);
    });
}

export function renderCryptoBubbles(container, { cryptoList, onSelect }) {
  if (!container || !cryptoList?.length) return;
  container.innerHTML = '';

  const visual = document.createElement('div');
  visual.className = 'playfield-bubble-chart-visual';
  container.appendChild(visual);

  const colors = ['#1e40af', '#dc2626', '#7c3aed', '#16a34a', '#ca8a04', '#0891b2'];
  const maxShow = CRYPTO_BUBBLE_MAX;
  const items = cryptoList.slice(0, maxShow).map((c, i) => ({
    symbol: c.symbol,
    name: c.name,
    value: Math.max(1, (maxShow - i) * 8),
    color: colors[i % colors.length],
  }));

  visual.insertAdjacentHTML(
    'beforeend',
    `<p class="playfield-bubble-chart-title"><span class="playfield-bubble-chart-n">${CRYPTO_BUBBLE_MAX}</span> <span class="playfield-bubble-chart-of">of</span> our bundled cryptocurrencies (preview) · Click a bubble to explore</p>` +
      `<p class="playfield-bubble-chart-title-sub"><strong>${items.length}</strong> on this chart</p>`
  );

  const { width, height } = bubblePackDimensions(container);

  const root = d3.hierarchy({ children: items }).sum((d) => d.value);
  d3.pack().size([width, height]).padding(2)(root);

  const svg = d3
    .select(visual)
    .append('svg')
    .attr('class', 'playfield-bubble-svg')
    .attr('width', width)
    .attr('height', height);

  const node = svg
    .selectAll('g')
    .data(root.leaves())
    .join('g')
    .attr('transform', (d) => `translate(${d.x},${d.y})`)
    .attr('class', 'playfield-bubble-node')
    .style('cursor', 'pointer');

  const inner = node
    .append('g')
    .attr('class', 'playfield-bubble-float')
    .style('animation-delay', (d, i) => `${(i % 7) * 0.4}s`);

  inner
    .append('circle')
    .attr('r', (d) => d.r)
    .attr('fill', (d) => d.data.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .on('mouseover', function () {
      d3.select(this).attr('stroke-width', 3);
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke-width', 1.5);
    })
    .on('click', (e, d) => {
      e.stopPropagation();
      onSelect?.(d.data.symbol);
    });

  inner
    .append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', (d) => Math.min(20, d.r * 0.65))
    .attr('font-weight', 600)
    .text((d) => (d.r > 14 ? d.data.symbol : ''));

  node.append('title').text((d) => `${d.data.name} (${d.data.symbol})`);

  const legendEl = d3.select(container).append('div').attr('class', 'playfield-bubble-legend');
  legendEl
    .append('div')
    .attr('class', 'playfield-bubble-legend-body')
    .html(
      `<p class="playfield-bubble-legend-intro"><strong>What you’re seeing:</strong> <strong>${CRYPTO_BUBBLE_MAX}</strong> assets at most from the <strong>curated list</strong> shipped with the app (first entries in our bundled catalog). This chart shows <strong>${items.length}</strong>. ` +
        `The full searchable list can be longer; the bubble view only previews a subset so layout stays clear.</p>` +
        `<ul class="playfield-bubble-legend-list">` +
        `<li><strong>Color</strong> = <strong>rotating palette</strong> so bubbles are easy to tell apart. Colors are <strong>not</strong> a category or performance signal.</li>` +
        `<li><strong>Bubble size</strong> = <strong>rank in this preview list</strong> (earlier in the bundle → larger bubble). Our static symbol list does not include live market-cap for this chart.</li>` +
        `</ul>` +
        `<p class="playfield-bubble-legend-cta">Click a bubble to open that asset.</p>`
    );
}
