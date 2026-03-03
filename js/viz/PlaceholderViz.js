import { BaseViz } from './BaseViz.js';

export class PlaceholderViz extends BaseViz {
  mount(container, data, options = {}) {
    super.mount(container, data, options);
    this.createSvg();
    if (!this.svg) return;

    this.svg
      .append('rect')
      .attr('width', this.innerWidth)
      .attr('height', this.innerHeight)
      .attr('fill', 'rgba(34, 197, 94, 0.08)')
      .attr('rx', 4);

    this.svg
      .append('text')
      .attr('x', this.innerWidth / 2)
      .attr('y', this.innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#71717a')
      .style('font-size', '14px')
      .text(data && data.length ? `${data.length} rows loaded` : 'No data');
  }
}
