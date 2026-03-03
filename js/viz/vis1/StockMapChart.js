import { BaseViz } from '../BaseViz.js';
import { transformCompaniesByState, transformCompaniesByStateWithTime } from './transform.js';

const MAP_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const COLOR_SCHEMES = {
  amber: { range: ['#fef3c7', '#b45309'] },
  blue: { range: ['#dbeafe', '#1d4ed8'] },
  teal: { range: ['#ccfbf1', '#0d9488'] },
  emerald: { range: ['#d1fae5', '#059669'] },
};

export class StockMapChart extends BaseViz {
  async mount(container, data, options = {}) {
    super.mount(container, data, options);
    this.container.innerHTML = '';

    const colorScheme = options.colorScheme || 'amber';
    const schemeDef = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.amber;

    const wrapper = document.createElement('div');
    wrapper.className = 'viz-map-wrapper';
    if (colorScheme !== 'amber') wrapper.setAttribute('data-color-scheme', colorScheme);

    const caption = document.createElement('div');
    caption.className = 'viz-caption';
    const titleRow = document.createElement('div');
    titleRow.className = 'viz-caption-title-row';
    const titleBlock = document.createElement('div');
    titleBlock.className = 'viz-caption-title-block';
    const titleEl = document.createElement('h3');
    titleEl.className = 'viz-title';
    titleEl.textContent = 'Number of S&P 500 Companies per State';
    const tutorial = document.createElement('div');
    tutorial.className = 'viz-tutorial-hint';
    tutorial.setAttribute('role', 'status');
    tutorial.textContent = 'Click on any state to view company details';
    titleBlock.appendChild(titleEl);
    titleBlock.appendChild(tutorial);
    const legendEl = document.createElement('div');
    legendEl.className = 'viz-legend';
    legendEl.innerHTML = `
      <span class="viz-legend-heading">Legend</span>
      <span class="viz-legend-label">Companies per state</span>
      <div class="viz-legend-bar"></div>
      <span class="viz-legend-range">0 — 67 companies</span>
    `;
    titleRow.appendChild(titleBlock);
    titleRow.appendChild(legendEl);
    caption.appendChild(titleRow);
    wrapper.appendChild(caption);

    const timeScrubber = options.timeScrubber === true;
    if (timeScrubber) {
      const timeIndex = transformCompaniesByStateWithTime(data);
      this._byYearIndex = timeIndex.byYear;
      this._years = timeIndex.years;
      this._selectedYear = this._years[this._years.length - 1] ?? new Date().getFullYear();

      const scrubberWrap = document.createElement('div');
      scrubberWrap.className = 'viz-time-scrubber-wrap';
      const scrubberLabel = document.createElement('label');
      scrubberLabel.className = 'viz-time-scrubber-label';
      scrubberLabel.textContent = `Year: ${this._selectedYear}`;
      const scrubberInput = document.createElement('input');
      scrubberInput.type = 'range';
      scrubberInput.className = 'viz-time-scrubber';
      scrubberInput.min = String(this._years[0] ?? 1900);
      scrubberInput.max = String(this._years[this._years.length - 1] ?? new Date().getFullYear());
      scrubberInput.value = String(this._selectedYear);
      scrubberInput.setAttribute('aria-label', 'Scroll through years to see companies per state');

      scrubberInput.addEventListener('input', () => {
        this._selectedYear = parseInt(scrubberInput.value, 10);
        scrubberLabel.textContent = `Year: ${this._selectedYear}`;
        this._drawMap();
      });
      scrubberWrap.appendChild(scrubberLabel);
      scrubberWrap.appendChild(scrubberInput);
      wrapper.appendChild(scrubberWrap);
      this._scrubberLabel = scrubberLabel;

      titleEl.textContent = 'S&P 500 Companies per State by Founding Year';
      tutorial.textContent = 'Drag the time bar to see how many companies (by founding year) were in each state over time';
    }

    const svgWrap = document.createElement('div');
    svgWrap.className = 'map-svg-wrap';
    wrapper.appendChild(svgWrap);

    container.appendChild(wrapper);

    this._wrapper = wrapper;
    this._captionEl = caption;
    this._legendRangeEl = legendEl.querySelector('.viz-legend-range');
    this._svgWrap = svgWrap;
    this._data = data;
    this._topology = null;
    this._colorScheme = schemeDef;

    const doDraw = () => this._drawMap();
    await new Promise((r) => requestAnimationFrame(r));
    await doDraw();

    this._resizeObserver = new ResizeObserver(() => {
      if (this.byState) doDraw();
    });
    this._resizeObserver.observe(svgWrap);
  }

  async _drawMap() {
    const svgWrap = this._svgWrap;
    const data = this._data;
    const container = this.container;
    if (!svgWrap || !container) return;

    svgWrap.innerHTML = '';

    const availableWidth = svgWrap.offsetWidth || Math.max(400, container.clientWidth || 600);
    const availableHeight = svgWrap.offsetHeight || Math.max(400, container.clientHeight || 500);
    const mapWidth = Math.max(400, availableWidth);
    const mapHeight = Math.max(400, availableHeight);
    const margin = { top: 12, right: 12, bottom: 12, left: 12 };
    const innerWidth = mapWidth - margin.left - margin.right;
    const innerHeight = mapHeight - margin.top - margin.bottom;

    const svg = d3
      .select(svgWrap)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, mapWidth, mapHeight])
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    let byState;
    let maxCount;
    if (this._byYearIndex != null && this._selectedYear != null) {
      const snapshot = this._byYearIndex[this._selectedYear];
      if (snapshot) {
        byState = snapshot.byState;
        maxCount = snapshot.maxCount;
      } else {
        const transformed = transformCompaniesByState(data);
        byState = transformed.byState;
        maxCount = transformed.maxCount;
      }
    } else {
      const transformed = transformCompaniesByState(data);
      byState = transformed.byState;
      maxCount = transformed.maxCount;
    }

    const range = this._colorScheme?.range || ['#fef3c7', '#b45309'];
    const colorScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range(range)
      .clamp(true);

    const topology = this._topology || (this._topology = await this._loadMap());
    if (!topology) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .text('Loading map...');
      return;
    }

    const states = window.topojson.feature(topology, topology.objects.states);
    const projection = d3.geoAlbersUsa().fitSize([innerWidth, innerHeight], states);
    const path = d3.geoPath(projection);
    const stockTooltip = this._stockTooltip || (this._stockTooltip = this._createTooltip(container));

    g.selectAll('path')
      .data(states.features)
      .join('path')
      .attr('fill', (d) => {
        const stateData = byState[d.id];
        return stateData ? colorScale(stateData.count) : '#ffffff';
      })
      .attr('stroke', '#475569')
      .attr('stroke-width', 0.5)
      .attr('d', path)
      .attr('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('stroke-width', 1.5).attr('stroke', '#1a1a1a');
        stockTooltip.show(event, d, byState[d.id]);
      })
      .on('mousemove', (event) => stockTooltip.move(event))
      .on('mouseleave', function (event, d) {
        d3.select(this).attr('stroke-width', 0.5).attr('stroke', '#475569');
        stockTooltip.hide();
      })
      .on('click', (event, d) => {
        const stateData = byState[d.id];
        if (!stateData?.companies?.length) {
          this._showEmptyStateToast(d.properties?.name || 'Unknown');
        } else {
          this._showCompaniesPanel(d, stateData);
        }
      });
    this.byState = byState;

    if (this._legendRangeEl) {
      this._legendRangeEl.textContent = `0 — ${maxCount} companies`;
    }

    this.svg = svg;
  }

  async _loadMap() {
    try {
      return await d3.json(MAP_URL);
    } catch (e) {
      console.warn('Could not load map:', e);
      return null;
    }
  }

  _createTooltip(container) {
    const tooltip = d3.select(document.body).append('div').attr('class', 'stock-map-tooltip').style('position', 'fixed').style('visibility', 'hidden').style('background', 'rgba(26,26,26,0.95)').style('color', '#f8fafc').style('padding', '8px 12px').style('border-radius', '6px').style('font-size', '13px').style('pointer-events', 'none').style('z-index', '1000').style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)');

    return {
      show(event, d, stateData) {
        const name = d.properties?.name || 'Unknown';
        if (!stateData) {
          tooltip.html(`<strong>${name}</strong><br/>No S&P 500 companies`);
        } else {
          const marketCapTr = (stateData.marketCap / 1e12).toFixed(2);
          tooltip.html(`<strong>${name}</strong><br/>${stateData.count} companies<br/>$${marketCapTr}T market cap`);
        }
        tooltip.style('visibility', 'visible').style('top', `${event.clientY + 10}px`).style('left', `${event.clientX + 10}px`);
      },
      move(event) {
        tooltip.style('top', `${event.clientY + 10}px`).style('left', `${event.clientX + 10}px`);
      },
      hide() {
        tooltip.style('visibility', 'hidden');
      },
    };
  }


  _showEmptyStateToast(stateName) {
    d3.select(document.body).selectAll('.state-empty-toast').remove();
    const toast = document.createElement('div');
    toast.className = 'state-empty-toast';
    toast.textContent = `No S&P 500 companies in ${stateName}.`;
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add('state-empty-toast-visible');
    const t = setTimeout(() => {
      toast.classList.remove('state-empty-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
    toast._toastTimer = t;
  }

  _showCompaniesPanel(d, stateData) {
    d3.select(document.body).selectAll('.state-companies-panel').remove();
    const stateName = d.properties?.name || 'Unknown';

    const panel = document.createElement('div');
    panel.className = 'state-companies-panel';

    const header = document.createElement('div');
    header.className = 'state-companies-panel-header';
    header.innerHTML = `<span>${stateName} — ${stateData.count} companies</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'state-companies-panel-close';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = () => panel.remove();
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'state-companies-panel-body';

    const sorted = [...stateData.companies].sort((a, b) => b.marketCap - a.marketCap);
    sorted.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'state-company-item';
      const capStr = c.marketCap >= 1e12 ? `$${(c.marketCap / 1e12).toFixed(2)}T` : c.marketCap >= 1e9 ? `$${(c.marketCap / 1e9).toFixed(2)}B` : c.marketCap >= 1e6 ? `$${(c.marketCap / 1e6).toFixed(2)}M` : `$${c.marketCap.toLocaleString()}`;
      const priceStr = c.currentPrice != null ? `$${c.currentPrice.toFixed(2)}` : '—';
      const empStr = c.employees != null ? c.employees.toLocaleString() : '—';
      const loc = [c.city, c.state].filter(Boolean).join(', ') || '—';
      const sectorIndustry = [c.sector, c.industry].filter(Boolean).join(' · ') || '—';
      row.innerHTML = `
        <div class="state-company-main">
          <span class="state-company-symbol">${c.symbol}</span>
          <span class="state-company-name">${c.name || '-'}</span>
          <span class="state-company-cap">${capStr}</span>
        </div>
        <div class="state-company-details">
          <span class="state-company-detail">${sectorIndustry}</span>
          <span class="state-company-detail">${loc}</span>
          <span class="state-company-detail">Price: ${priceStr} | Employees: ${empStr}</span>
        </div>
      `;
      body.appendChild(row);
    });

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);
  }

  unmount() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._wrapper?.remove();
    this._wrapper = null;
    this._captionEl = null;
    this._legendRangeEl = null;
    d3.select(document.body).selectAll('.stock-map-tooltip').remove();
    d3.select(document.body).selectAll('.state-companies-panel').remove();
    d3.select(document.body).selectAll('.state-empty-toast').remove();
    super.unmount();
  }
}
