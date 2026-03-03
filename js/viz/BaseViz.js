export class BaseViz {
  constructor(id) {
    this.id = id;
    this.container = null;
    this.data = null;
    this.svg = null;
  }

  mount(container, data, options = {}) {
    this.container = container;
    this.data = data;
    this.options = { width: 800, height: 400, ...options };
  }

  update(data) {
    this.data = data;
  }

  unmount() {
    this.container = null;
    this.data = null;
    this.svg = null;
  }

  createSvg() {
    if (!this.container) return null;
    const { width, height } = this.options;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    this.svg = d3
      .select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    this.margin = margin;
    this.innerWidth = width - margin.left - margin.right;
    this.innerHeight = height - margin.top - margin.bottom;
    return this.svg;
  }
}
