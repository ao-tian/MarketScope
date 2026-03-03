const SYMBOLS = ['$', '%', '¢', '¥', '€', '₿', '£', '₹', '₽', '₩', '💰', '💵'];

export function initFloatingSymbols() {
  const svg = d3.select('#particles-svg');
  if (svg.empty()) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.attr('width', width).attr('height', height);

  const count = 55;
  const particles = d3.range(count).map((i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    symbol: SYMBOLS[i % SYMBOLS.length],
    size: 20 + Math.random() * 32,
    opacity: 0.4 + Math.random() * 0.35,
    speed: 0.8 + (4 + Math.random() * 4) / 6,
  }));

  svg
    .append('defs')
    .append('linearGradient')
    .attr('id', 'particle-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '100%')
    .attr('y2', '100%')
    .selectAll('stop')
    .data([
      { offset: '0%', color: '#b8860b' },
      { offset: '50%', color: '#d4af37' },
      { offset: '100%', color: '#f0d78c' },
    ])
    .join('stop')
    .attr('offset', (d) => d.offset)
    .attr('stop-color', (d) => d.color);

  const texts = svg
    .append('g')
    .selectAll('text')
    .data(particles)
    .join('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'url(#particle-gradient)')
    .attr('opacity', (d) => d.opacity)
    .attr('font-size', (d) => `${d.size}px`)
    .attr('font-family', 'Sora, sans-serif')
    .attr('font-weight', '600')
    .text((d) => d.symbol);

  d3.timer(() => {
    particles.forEach((p) => {
      p.y -= p.speed;
      if (p.y < -30) {
        p.y = height + 30;
        p.x = Math.random() * width;
      }
    });
    texts.attr('x', (d) => d.x).attr('y', (d) => d.y);
  });
}
