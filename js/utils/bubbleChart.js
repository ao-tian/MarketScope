/**
 * Renders a packed bubble chart. Bubble size = market cap (or value).
 * Colors by sector (stocks) or alternating (crypto).
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
    .slice(0, 80);

  if (!available.length) return;

  container.insertAdjacentHTML(
    'afterbegin',
    '<p class="playfield-bubble-chart-title">S&P 500 by market cap · Click a bubble to explore</p>'
  );

  const width = Math.max(500, container.clientWidth || 600);
  const height = Math.min(680, Math.max(520, width * 0.45));

  const root = d3.hierarchy({ children: available }).sum((d) => d.value);
  d3.pack().size([width, height]).padding(2)(root);

  const svg = d3
    .select(container)
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
  const legendEl = d3.select(container).append('div').attr('class', 'playfield-bubble-legend');
  legendEl.append('p').attr('class', 'playfield-bubble-legend-title').text('Sectors');
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
  legendEl.append('p').attr('class', 'playfield-bubble-legend-note').text('Bubble size = market cap (larger = bigger company) · Click any bubble to explore');
}

export function renderCryptoBubbles(container, { cryptoList, onSelect }) {
  if (!container || !cryptoList?.length) return;
  container.innerHTML = '';

  container.insertAdjacentHTML(
    'afterbegin',
    '<p class="playfield-bubble-chart-title">Cryptocurrencies · Click a bubble to explore</p>'
  );

  const colors = ['#1e40af', '#dc2626', '#7c3aed', '#16a34a', '#ca8a04', '#0891b2'];
  const items = cryptoList.slice(0, 24).map((c, i) => ({
    symbol: c.symbol,
    name: c.name,
    value: Math.max(1, 100 - i * 4),
    color: colors[i % colors.length],
  }));

  const width = Math.max(500, container.clientWidth || 600);
  const height = Math.min(580, Math.max(460, width * 0.42));

  const root = d3.hierarchy({ children: items }).sum((d) => d.value);
  d3.pack().size([width, height]).padding(2)(root);

  const svg = d3
    .select(container)
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
  legendEl.append('p').attr('class', 'playfield-bubble-legend-note').text('Bubble size = relative prominence · Click any bubble to explore');
}
