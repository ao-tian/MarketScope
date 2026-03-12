import { BaseViz } from '../BaseViz.js';
import { transformCompaniesByState, transformCompaniesByStateWithTime } from './transform.js';

const MAP_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const COLOR_SCHEMES = {
  amber: { range: ['#fef3c7', '#b45309'] },
  blue: { range: ['#dbeafe', '#1d4ed8'] },
  teal: { range: ['#ccfbf1', '#0d9488'] },
  emerald: { range: ['#d1fae5', '#059669'] },
};

const toFips = (id) => (id != null ? String(id).padStart(2, '0') : null);

export class StockMapChart extends BaseViz {
  async mount(container, data, options = {}) {
    super.mount(container, data, options);
    this.container.innerHTML = '';

    const colorScheme = options.colorScheme || 'amber';
    const schemeDef = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.amber;
    this._showAllByDefault = options.showAllByDefault === true;
    this._showSpikes = options.showSpikes === true;
    this._showStateShape = options.showStateShape === true;
    this._timeScrubber = options.timeScrubber === true;
    this._enableCompanyClick = options.enableCompanyClick === true;
    this._hoveredFips = null;
    this._yearAutoAdvanceRAF = null;

    const mapWithPanel = document.createElement('div');
    mapWithPanel.className = 'viz-map-with-panel';

    const mapColumn = document.createElement('div');
    mapColumn.className = 'viz-map-column';

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
    titleBlock.appendChild(titleEl);
    if (options.captionDescription) {
      const descEl = document.createElement('p');
      descEl.className = 'viz-caption-desc';
      descEl.textContent = options.captionDescription;
      titleBlock.appendChild(descEl);
    }
    const hintFrame = document.createElement('div');
    hintFrame.className = 'viz-hint-frame';
    const tutorial = document.createElement('span');
    tutorial.className = 'viz-tutorial-hint';
    tutorial.setAttribute('role', 'status');
    tutorial.textContent = 'Click a state on the map or in the panel to filter';
    hintFrame.appendChild(tutorial);
    if (options.showSpikes) {
      const magnifyCta = document.createElement('button');
      magnifyCta.type = 'button';
      magnifyCta.className = 'viz-map-magnify-cta';
      magnifyCta.setAttribute('aria-label', 'See enlarged version of the map to play with spikes');
      magnifyCta.innerHTML = `
        <span class="viz-map-magnify-desc">See enlarged version of the map to play with spikes</span>
        <span class="viz-map-magnify-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        </span>
      `;
      magnifyCta.addEventListener('click', () => this._openFullscreenMap());
      hintFrame.appendChild(magnifyCta);
      this._magnifyBtn = magnifyCta;
    }
    titleBlock.appendChild(hintFrame);
    const legendEl = document.createElement('div');
    legendEl.className = 'viz-legend';
    legendEl.innerHTML = `
      <span class="viz-legend-heading">Legend</span>
      <span class="viz-legend-label">Companies per state</span>
      <div class="viz-legend-bar"></div>
      <span class="viz-legend-range">0 — 67 companies</span>
      ${options.showSpikes ? '<span class="viz-legend-spikes-label">Spike height = market cap</span>' : ''}
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
      const scrubberBarWrap = document.createElement('div');
      scrubberBarWrap.className = 'viz-time-scrubber-bar-wrap';
      const scrubberTrack = document.createElement('div');
      scrubberTrack.className = 'viz-time-scrubber-track';
      const scrubberProgress = document.createElement('div');
      scrubberProgress.className = 'viz-time-scrubber-progress';
      scrubberTrack.appendChild(scrubberProgress);
      const scrubberMilestones = document.createElement('div');
      scrubberMilestones.className = 'viz-time-scrubber-milestones';
      const minY = this._years[0] ?? 1900;
      const maxY = this._years[this._years.length - 1] ?? new Date().getFullYear();
      const milestones = [
        { year: 1950, label: 'Post-WWII boom' },
        { year: 1970, label: 'Tech era' },
        { year: 1990, label: 'Dot-com wave' },
        { year: 2000, label: 'Internet age' },
        { year: 2010, label: 'Modern giants' },
      ].filter((m) => m.year >= minY && m.year <= maxY);
      milestones.forEach((m) => {
        const pct = maxY > minY ? ((m.year - minY) / (maxY - minY)) * 100 : 0;
        const marker = document.createElement('div');
        marker.className = 'viz-time-scrubber-milestone-marker';
        marker.style.left = `${pct}%`;
        marker.setAttribute('title', `${m.year}: ${m.label}`);
        marker.addEventListener('mouseenter', (e) => {
          this._showMilestoneTooltip(e.target, m.year, m.label);
        });
        marker.addEventListener('mouseleave', () => {
          this._hideMilestoneTooltip();
        });
        marker.addEventListener('click', () => {
          this._selectedYear = m.year;
          scrubberInput.value = String(m.year);
          scrubberLabel.textContent = `Year: ${m.year}`;
          const progress = maxY > minY ? (m.year - minY) / (maxY - minY) : 1;
          scrubberProgress.style.transform = `scale3d(${progress}, 1, 1)`;
          this._stopYearAutoAdvance();
          this._setReplayButtonStopped();
          this._drawMap();
        });
        scrubberMilestones.appendChild(marker);
      });
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
        const minY = this._years[0];
        const maxY = this._years[this._years.length - 1];
        scrubberProgress.style.transform = maxY > minY ? `scale3d(${(this._selectedYear - minY) / (maxY - minY)}, 1, 1)` : 'scale3d(1, 1, 1)';
        this._drawMap();
      });
      scrubberInput.addEventListener('mousedown', () => {
        this._stopYearAutoAdvance();
        this._setReplayButtonStopped();
      });
      scrubberInput.addEventListener('touchstart', () => {
        this._stopYearAutoAdvance();
        this._setReplayButtonStopped();
      });
      const replayBtn = document.createElement('button');
      replayBtn.className = 'viz-time-scrubber-replay viz-time-scrubber-replay-playing';
      replayBtn.innerHTML = '⏸ Pause';
      replayBtn.setAttribute('aria-label', 'Pause year animation');
      replayBtn.addEventListener('click', () => {
        if (replayBtn.classList.contains('viz-time-scrubber-replay-stopped')) {
          this._startYearAutoAdvance();
          this._setReplayButtonPlaying();
        } else {
          this._stopYearAutoAdvance();
          this._setReplayButtonStopped();
        }
      });
      scrubberBarWrap.appendChild(scrubberTrack);
      scrubberBarWrap.appendChild(scrubberMilestones);
      scrubberBarWrap.appendChild(scrubberInput);
      scrubberWrap.appendChild(scrubberLabel);
      scrubberWrap.appendChild(scrubberBarWrap);
      scrubberWrap.appendChild(replayBtn);
      wrapper.appendChild(scrubberWrap);
      this._scrubberLabel = scrubberLabel;
      this._scrubberProgress = scrubberProgress;
      this._replayBtn = replayBtn;

      titleEl.textContent = 'S&P 500 Companies per State by Founding Year';
      tutorial.textContent = 'Drag the time bar to see how many companies (by founding year) were in each state over time';
    }

    const svgWrap = document.createElement('div');
    svgWrap.className = 'map-svg-wrap';
    wrapper.appendChild(svgWrap);

    mapColumn.appendChild(wrapper);
    mapWithPanel.appendChild(mapColumn);

    const sidePanel = document.createElement('div');
    sidePanel.className = 'state-side-panel';
    sidePanel.setAttribute('aria-label', 'State companies explorer');
    const panelHeader = `
      <div class="state-side-panel-header">
        <span class="state-side-panel-badge">${this._showAllByDefault ? 'All companies' : 'Top state'}</span>
        <h4 class="state-side-panel-title">Loading...</h4>
        <p class="state-side-panel-subtitle">${this._showAllByDefault ? 'Click a state to filter' : 'Click any state to explore'}</p>
        <div class="state-side-panel-stats"></div>
      </div>
    `;
    sidePanel.innerHTML = panelHeader + '<div class="state-side-panel-content"><div class="panel-state-shape-wrap" aria-hidden="true"></div><div class="state-side-panel-body"></div></div>';

    mapWithPanel.appendChild(sidePanel);

    container.appendChild(mapWithPanel);

    this._wrapper = wrapper;
    this._mapWithPanel = mapWithPanel;
    this._sidePanel = sidePanel;
    this._sidePanelTitle = sidePanel.querySelector('.state-side-panel-title');
    this._sidePanelSubtitle = sidePanel.querySelector('.state-side-panel-subtitle');
    this._sidePanelStats = sidePanel.querySelector('.state-side-panel-stats');
    this._sidePanelBody = sidePanel.querySelector('.state-side-panel-body');
    this._sidePanelBadge = sidePanel.querySelector('.state-side-panel-badge');
    this._stateShapeWrap = sidePanel.querySelector('.panel-state-shape-wrap');
    this._captionEl = caption;
    this._legendRangeEl = legendEl.querySelector('.viz-legend-range');
    this._legendSpikesEl = legendEl.querySelector('.viz-legend-spikes-label');
    this._svgWrap = svgWrap;
    this._data = data;
    this._topology = null;
    this._colorScheme = schemeDef;
    this._selectedStateFips = null;
    this._selectedStateName = null;

    const doDraw = () => this._drawMap();
    await new Promise((r) => requestAnimationFrame(r));
    await doDraw();

    if (this._timeScrubber) this._startYearAutoAdvance();

    this._resizeObserver = new ResizeObserver(() => {
      if (this.byState) doDraw();
    });
    this._resizeObserver.observe(svgWrap);
  }

  _setHoverState(fips) {
    if (this._hoveredFips === fips) return;
    this._hoveredFips = fips;
    this._updateGlow();
  }

  _clearHoverState() {
    if (this._hoveredFips == null) return;
    this._hoveredFips = null;
    this._updateGlow();
  }

  _highlightSpikeForSymbol(symbol) {
    if (!this._spikeG || !symbol) return;
    const lightRed = '#f87171';
    this._spikeG
      .selectAll('.map-spike-path')
      .classed('spike-highlighted', (d) => d.symbol === symbol)
      .attr('fill', (d) => (d.symbol === symbol ? lightRed : '#1a1a1a'))
      .attr('stroke', (d) => (d.symbol === symbol ? lightRed : '#1a1a1a'))
      .attr('stroke-width', (d) => (d.symbol === symbol ? 1.5 : 0.5))
      .attr('transform', (d) => (d.symbol === symbol ? `translate(${d.x},${d.y}) scale(2.1)` : `translate(${d.x},${d.y})`));
  }

  _unhighlightSpike() {
    if (!this._spikeG) return;
    this._spikeG
      .selectAll('.map-spike-path.spike-highlighted')
      .classed('spike-highlighted', false)
      .attr('fill', '#1a1a1a')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 0.5)
      .attr('transform', (d) => `translate(${d.x},${d.y})`);
  }

  async _openFullscreenMap() {
    if (this._fullscreenModal) return;
    const modal = document.createElement('div');
    modal.className = 'viz-map-fullscreen-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Full-screen map view');
    modal.innerHTML = `
      <button type="button" class="viz-map-fullscreen-close" aria-label="Close">×</button>
      <div class="viz-map-fullscreen-zoom-hint">Scroll to zoom · Drag to pan</div>
      <div class="viz-map-fullscreen-zoom-controls">
        <button type="button" class="viz-map-fullscreen-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" class="viz-map-fullscreen-zoom-btn" data-zoom="out" aria-label="Zoom out">−</button>
        <button type="button" class="viz-map-fullscreen-zoom-btn" data-zoom="reset" aria-label="Reset zoom">⟲</button>
      </div>
      <div class="viz-map-fullscreen-content"></div>
    `;
    document.body.appendChild(modal);
    this._fullscreenModal = modal;

    const close = () => {
      if (this._fullscreenModal) {
        this._fullscreenModal.remove();
        this._fullscreenModal = null;
      }
      d3.select(document.body).selectAll('.viz-map-fullscreen-spike-tooltip').remove();
      document.body.style.overflow = '';
    };

    modal.querySelector('.viz-map-fullscreen-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    document.body.style.overflow = 'hidden';

    const content = modal.querySelector('.viz-map-fullscreen-content');
    await this._renderFullscreenMap(content);
  }

  async _renderFullscreenMap(container) {
    if (!container || !this.byState || !this._topology) return;
    container.innerHTML = '';

    const mapWidth = window.innerWidth;
    const mapHeight = window.innerHeight;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = mapWidth - margin.left - margin.right;
    const innerHeight = mapHeight - margin.top - margin.bottom;

    const states = window.topojson.feature(this._topology, this._topology.objects.states);
    const byState = this.byState;
    const maxCount = Math.max(1, ...Object.values(byState).map((d) => d.count || 0));
    const range = this._colorScheme?.range || ['#fef3c7', '#b45309'];
    const colorScale = d3.scaleLinear().domain([0, maxCount]).range(range).clamp(true);
    const projection = d3.geoAlbersUsa().fitSize([innerWidth, innerHeight], states);
    const path = d3.geoPath(projection);

    const spikeTooltip = d3
      .select(document.body)
      .append('div')
      .attr('class', 'viz-map-fullscreen-spike-tooltip')
      .style('position', 'fixed')
      .style('visibility', 'hidden')
      .style('background', 'rgba(26,26,26,0.95)')
      .style('color', '#f8fafc')
      .style('padding', '10px 14px')
      .style('border-radius', '8px')
      .style('font-size', '15px')
      .style('pointer-events', 'none')
      .style('z-index', '10002')
      .style('box-shadow', '0 4px 16px rgba(0,0,0,0.4)');

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, mapWidth, mapHeight])
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('class', 'viz-fullscreen-map-group').attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3
      .zoom()
      .scaleExtent([1, 6])
      .on('zoom', (event) => {
        g.attr('transform', `translate(${margin.left},${margin.top}) ${event.transform}`);
      });
    svg.call(zoom);

    const paths = g
      .selectAll('g.state-path-wrap')
      .data(states.features)
      .join('g')
      .attr('class', 'state-path-wrap');

    paths
      .selectAll('path')
      .data((d) => [d])
      .join('path')
      .attr('class', 'state-path')
      .attr('fill', (d) => {
        const stateData = byState[toFips(d.id)];
        return stateData ? colorScale(stateData.count) : '#ffffff';
      })
      .attr('stroke', '#475569')
      .attr('stroke-width', 0.5)
      .attr('d', path);

    const isInsideState = (px, py, feat) => {
      const inv = projection.invert && projection.invert([px, py]);
      if (!inv) return false;
      return d3.geoContains(feat, inv);
    };

    const maxMarketCap = Math.max(1, ...Object.values(byState).flatMap((s) => (s.companies || []).map((c) => c.marketCap || 0)));
    const maxSpikeHeight = Math.min(innerHeight, innerWidth) * 0.2;
    const lengthScale = d3.scaleSqrt().domain([0, maxMarketCap]).range([0, maxSpikeHeight]).clamp(true);
    const spikePath = (h, baseWidth = 10) => {
      const w = baseWidth / 2;
      return `M ${-w},0 L 0,${-h} L ${w},0 Z`;
    };

    const spikeData = [];
    for (const fips of Object.keys(byState)) {
      const stateData = byState[fips];
      const feature = states.features.find((f) => toFips(f.id) === fips);
      if (!feature || !stateData?.companies?.length) continue;
      const centroid = path.centroid(feature);
      const companies = stateData.companies.filter((c) => c.marketCap > 0).sort((a, b) => b.marketCap - a.marketCap);
      const n = companies.length;
      const positions = [];
      const bounds = path.bounds(feature);
      const [[bx0, by0], [bx1, by1]] = bounds;
      const gridStep = 18;
      for (let py = by0; py <= by1; py += gridStep) {
        for (let px = bx0; px <= bx1; px += gridStep) {
          if (isInsideState(px, py, feature)) positions.push([px, py]);
        }
      }
      positions.sort((a, b) => {
        const da = (a[0] - centroid[0]) ** 2 + (a[1] - centroid[1]) ** 2;
        const db = (b[0] - centroid[0]) ** 2 + (b[1] - centroid[1]) ** 2;
        return da - db;
      });
      let fallbackAttempts = 0;
      while (positions.length < n && fallbackAttempts < 800) {
        fallbackAttempts++;
        const px = bx0 + Math.random() * (bx1 - bx0);
        const py = by0 + Math.random() * (by1 - by0);
        if (isInsideState(px, py, feature)) positions.push([px, py]);
      }
      positions.sort((a, b) => {
        const da = (a[0] - centroid[0]) ** 2 + (a[1] - centroid[1]) ** 2;
        const db = (b[0] - centroid[0]) ** 2 + (b[1] - centroid[1]) ** 2;
        return da - db;
      });
      while (positions.length < n) positions.push([centroid[0], centroid[1]]);
      companies.forEach((c, i) => {
        const [px, py] = positions[i] || centroid;
        spikeData.push({
          ...c,
          fips,
          stateName: feature.properties?.name || 'Unknown',
          x: px,
          y: py,
          spikeHeight: lengthScale(c.marketCap),
        });
      });
    }

    const formatCap = (v) => {
      if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
      if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
      if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
      return v.toLocaleString();
    };

    const spikeG = g.append('g').attr('class', 'map-spikes');
    const spikePaths = spikeG
      .selectAll('path')
      .data(spikeData)
      .join('path')
      .attr('class', 'map-spike-path viz-fullscreen-spike')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('d', (d) => spikePath(d.spikeHeight))
      .attr('fill', '#1a1a1a')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer');

    spikePaths.on('mouseenter', function (event, d) {
      const capStr = d.marketCap >= 1e12 ? `$${(d.marketCap / 1e12).toFixed(2)}T` : d.marketCap >= 1e9 ? `$${(d.marketCap / 1e9).toFixed(2)}B` : `$${formatCap(d.marketCap)}`;
      spikeTooltip
        .html(`<strong>${d.name || d.symbol || 'Unknown'}</strong><br/>${capStr} market cap`)
        .style('visibility', 'visible')
        .style('top', `${event.clientY + 14}px`)
        .style('left', `${event.clientX + 14}px`);
      d3.select(this).attr('fill', '#f87171').attr('stroke', '#f87171').attr('stroke-width', 1.5).attr('transform', `translate(${d.x},${d.y}) scale(2.1)`);
    });
    spikePaths.on('mouseleave', function (event, d) {
      spikeTooltip.style('visibility', 'hidden');
      d3.select(this).attr('fill', '#1a1a1a').attr('stroke', '#1a1a1a').attr('stroke-width', 0.5).attr('transform', `translate(${d.x},${d.y})`);
    });
    spikePaths.on('mousemove', (event) => {
      spikeTooltip.style('top', `${event.clientY + 14}px`).style('left', `${event.clientX + 14}px`);
    });
    spikePaths.on('click', (event, d) => {
      event.stopPropagation();
      if (d.symbol) {
        window.dispatchEvent(new CustomEvent('marketscope:openStock', { detail: { symbol: d.symbol } }));
        if (this._fullscreenModal) {
          this._fullscreenModal.remove();
          this._fullscreenModal = null;
        }
        document.body.style.overflow = '';
        d3.select(document.body).selectAll('.viz-map-fullscreen-spike-tooltip').remove();
      }
    });

    const legendSpikeScale = 1.8;
    const legendGap = 70;
    const spikeLegendX = innerWidth - 280;
    const spikeLegendY = innerHeight - 70;
    const legendTicks = lengthScale.ticks(4).slice(1);
    const spikeLegend = g
      .append('g')
      .attr('class', 'map-spike-legend')
      .attr('transform', `translate(${spikeLegendX},${spikeLegendY})`)
      .attr('fill', '#6b4e0a')
      .attr('text-anchor', 'middle')
      .style('font', '16px sans-serif');
    legendTicks.forEach((val, i) => {
      const gEl = spikeLegend.append('g').attr('transform', `translate(${legendGap * i},0)`);
      gEl.append('path').attr('fill', '#1a1a1a').attr('fill-opacity', 0.7).attr('stroke', '#1a1a1a').attr('stroke-width', 0.5).attr('d', spikePath(lengthScale(val) * legendSpikeScale));
      gEl.append('text').attr('dy', '1.4em').attr('fill', '#6b4e0a').style('font-size', '16px').style('font-weight', '600').text(`$${formatCap(val)}`);
    });

    this._fullscreenSpikeTooltip = spikeTooltip;

    const modal = container.closest('.viz-map-fullscreen-modal');
    if (modal) {
      const zoomInBtn = modal.querySelector('[data-zoom="in"]');
      const zoomOutBtn = modal.querySelector('[data-zoom="out"]');
      const zoomResetBtn = modal.querySelector('[data-zoom="reset"]');
      if (zoomInBtn) zoomInBtn.addEventListener('click', () => svg.transition().duration(200).call(zoom.scaleBy, 1.4));
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => svg.transition().duration(200).call(zoom.scaleBy, 0.7));
      if (zoomResetBtn)
        zoomResetBtn.addEventListener('click', () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
    }
  }

  _updateGlow() {
    const fips = this._hoveredFips;
    if (this._mainMapPaths) {
      this._mainMapPaths.classed('state-hover-glow', (d) => toFips(d.id) === fips);
    }
  }

  _updateMapColorsOnly() {
    if (!this._mainMapPaths || !this._colorScale || !this._byYearIndex) return false;
    const snapshot = this._byYearIndex[this._selectedYear];
    const byState = snapshot?.byState;
    const maxCount = snapshot?.maxCount;
    if (!byState) return false;

    const range = this._colorScheme?.range || ['#fef3c7', '#b45309'];
    const colorScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range(range)
      .clamp(true);

    this._mainMapPaths
      .selectAll('path')
      .transition()
      .duration(250)
      .ease(d3.easeCubicOut)
      .attr('fill', (d) => {
        const stateData = byState[toFips(d.id)];
        return stateData ? colorScale(stateData.count) : '#ffffff';
      });

    this.byState = byState;
    this._colorScale = colorScale;

    if (this._legendRangeEl) this._legendRangeEl.textContent = `0 — ${maxCount} companies`;

    if (!this._panelInitialized) return true;
    if (this._showAllByDefault && this._states) {
      this._updateSidePanelAll(byState, this._states);
    } else if (this._selectedStateFips && this._states) {
      const stateData = byState[this._selectedStateFips];
      const topFeature = this._states.features.find((f) => toFips(f.id) === this._selectedStateFips);
      const stateName = topFeature?.properties?.name || this._selectedStateName;
      if (stateData?.companies?.length) {
        this._updateSidePanel(stateName, stateData);
      } else if (this._showAllByDefault) {
        this._updateSidePanelAll(byState, this._states);
      } else {
        const topEntry = Object.entries(byState).reduce(
          (best, [fips, data]) => (!best || data.count > best[1].count ? [fips, data] : best),
          null
        );
        if (topEntry) {
          const [topFips, topData] = topEntry;
          const feat = this._states.features.find((f) => toFips(f.id) === topFips);
          this._selectedStateFips = topFips;
          this._selectedStateName = feat?.properties?.name || topData.state || 'Unknown';
          this._updateSidePanel(this._selectedStateName, topData);
        }
      }
    }

    if (this._showStateShape && this._stateShapeWrap && this._selectedStateFips && this._states) {
      this._drawStateShape(this._states);
    } else if (this._stateShapeWrap) {
      this._stateShapeWrap.innerHTML = '';
    }

    return true;
  }

  async _drawMap() {
    const svgWrap = this._svgWrap;
    const data = this._data;
    const container = this.container;
    if (!svgWrap || !container) return;

    if (this._timeScrubber && this._mainMapPaths) {
      const updated = this._updateMapColorsOnly();
      if (updated) return;
    }

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

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('class', 'state-path-glow');

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

    const paths = g
      .selectAll('g.state-path-wrap')
      .data(states.features)
      .join('g')
      .attr('class', 'state-path-wrap')
      .attr('cursor', 'pointer')
      .attr('data-fips', (d) => toFips(d.id));

    paths
      .selectAll('path')
      .data((d) => [d])
      .join('path')
      .attr('class', 'state-path')
      .attr('fill', (d) => {
        const stateData = byState[toFips(d.id)];
        return stateData ? colorScale(stateData.count) : '#ffffff';
      })
      .attr('stroke', '#475569')
      .attr('stroke-width', 0.5)
      .attr('d', path);

    this._mainMapPaths = paths;
    const chart = this;

    paths
      .on('mouseenter', function (event, d) {
        const fips = toFips(d.id);
        d3.select(this).classed('state-hover-glow', true);
        stockTooltip.show(event, d, byState[fips]);
        chart._setHoverState(fips);
      })
      .on('mouseleave', function (event, d) {
        d3.select(this).classed('state-hover-glow', false);
        stockTooltip.hide();
        chart._clearHoverState();
      });

    paths
      .on('mousemove', (event) => stockTooltip.move(event))
      .on('click', (event, d) => {
        const fips = toFips(d.id);
        const stateData = byState[fips];
        if (!stateData?.companies?.length) {
          chart._showEmptyStateToast(d.properties?.name || 'Unknown');
        } else {
          chart._selectedStateFips = fips;
          chart._selectedStateName = d.properties?.name || 'Unknown';
          chart._updateSidePanel(chart._selectedStateName, stateData);
          if (chart._sidePanelBadge) chart._sidePanelBadge.textContent = 'Selected';
        }
      });

    if (this._showSpikes) {
      const spikeData = [];
      const maxMarketCap = Math.max(
        1,
        ...Object.values(byState).flatMap((s) => (s.companies || []).map((c) => c.marketCap || 0))
      );
      const maxSpikeHeight = Math.min(innerHeight, innerWidth) * 0.14;
      const lengthScale = d3.scaleSqrt().domain([0, maxMarketCap]).range([0, maxSpikeHeight]).clamp(true);

      const spikePath = (h, baseWidth = 7) => {
        const w = baseWidth / 2;
        return `M ${-w},0 L 0,${-h} L ${w},0 Z`;
      };

      const isInsideState = (px, py, feat) => {
        const inv = projection.invert && projection.invert([px, py]);
        if (!inv) return false;
        return d3.geoContains(feat, inv);
      };

      for (const fips of Object.keys(byState)) {
        const stateData = byState[fips];
        const feature = states.features.find((f) => toFips(f.id) === fips);
        if (!feature || !stateData?.companies?.length) continue;
        const centroid = path.centroid(feature);
        const companies = stateData.companies.filter((c) => c.marketCap > 0).sort((a, b) => b.marketCap - a.marketCap);
        const n = companies.length;
        const positions = [];
        const bounds = path.bounds(feature);
        const [[bx0, by0], [bx1, by1]] = bounds;
        const gridStep = 14;
        for (let py = by0; py <= by1; py += gridStep) {
          for (let px = bx0; px <= bx1; px += gridStep) {
            if (isInsideState(px, py, feature)) {
              positions.push([px, py]);
            }
          }
        }
        positions.sort((a, b) => {
          const da = (a[0] - centroid[0]) ** 2 + (a[1] - centroid[1]) ** 2;
          const db = (b[0] - centroid[0]) ** 2 + (b[1] - centroid[1]) ** 2;
          return da - db;
        });
        let fallbackAttempts = 0;
        while (positions.length < n && fallbackAttempts < 800) {
          fallbackAttempts++;
          const px = bx0 + Math.random() * (bx1 - bx0);
          const py = by0 + Math.random() * (by1 - by0);
          if (isInsideState(px, py, feature)) positions.push([px, py]);
        }
        positions.sort((a, b) => {
          const da = (a[0] - centroid[0]) ** 2 + (a[1] - centroid[1]) ** 2;
          const db = (b[0] - centroid[0]) ** 2 + (b[1] - centroid[1]) ** 2;
          return da - db;
        });
        while (positions.length < n) {
          positions.push([centroid[0], centroid[1]]);
        }
        companies.forEach((c, i) => {
          const [px, py] = positions[i] || centroid;
          spikeData.push({
            ...c,
            fips,
            stateName: feature.properties?.name || 'Unknown',
            x: px,
            y: py,
            spikeHeight: lengthScale(c.marketCap),
          });
        });
      }

      const spikeG = g.append('g').attr('class', 'map-spikes');
      this._spikeG = spikeG;

      const spikePaths = spikeG
        .selectAll('path')
        .data(spikeData)
        .join('path')
        .attr('class', 'map-spike-path')
        .attr('data-symbol', (d) => d.symbol || '')
        .attr('transform', (d) => `translate(${d.x},${d.y})`)
        .attr('d', (d) => spikePath(d.spikeHeight))
        .attr('fill', '#1a1a1a')
        .attr('fill-opacity', 0.7)
        .attr('stroke', '#1a1a1a')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer');

      spikePaths
        .append('title')
        .text((d) => `${d.name || d.symbol || 'Unknown'}\n${d.stateName}\n$${(d.marketCap / 1e9).toFixed(1)}B market cap`);

      spikePaths
        .on('mouseenter', (event, d) => {
          chart._highlightSpikeForSymbol(d.symbol);
        })
        .on('mouseleave', () => {
          chart._unhighlightSpike();
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          if (chart._enableCompanyClick && d.symbol) {
            window.dispatchEvent(new CustomEvent('marketscope:openStock', { detail: { symbol: d.symbol } }));
          } else {
            chart._selectedStateFips = d.fips;
            chart._selectedStateName = d.stateName;
            chart._updateSidePanel(d.stateName, byState[d.fips]);
            if (chart._sidePanelBadge) chart._sidePanelBadge.textContent = 'Selected';
          }
        });

      const formatCap = (v) => {
        if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
        if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
        if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
        return v.toLocaleString();
      };
      const legendSpikeScale = 1.8;
      const legendGap = 58;
      const spikeLegendX = innerWidth - 200;
      const spikeLegendY = innerHeight - 55;
      const legendTicks = lengthScale.ticks(4).slice(1);
      const spikeLegend = g
        .append('g')
        .attr('class', 'map-spike-legend')
        .attr('transform', `translate(${spikeLegendX},${spikeLegendY})`)
        .attr('fill', '#6b4e0a')
        .attr('text-anchor', 'middle')
        .style('font', '14px sans-serif');

      legendTicks.forEach((val, i) => {
        const gEl = spikeLegend.append('g').attr('transform', `translate(${legendGap * i},0)`);
        gEl
          .append('path')
          .attr('fill', '#1a1a1a')
          .attr('fill-opacity', 0.7)
          .attr('stroke', '#1a1a1a')
          .attr('stroke-width', 0.5)
          .attr('d', spikePath(lengthScale(val) * legendSpikeScale));
        gEl
          .append('text')
          .attr('dy', '1.4em')
          .attr('fill', '#6b4e0a')
          .style('font-size', '14px')
          .style('font-weight', '600')
          .text(`$${formatCap(val)}`);
      });
    } else {
      this._spikeG = null;
    }

    this.byState = byState;
    this._states = states;
    this._projection = projection;
    this._path = path;
    this._colorScale = colorScale;

    if (!this._panelInitialized) {
      if (this._showAllByDefault) {
        this._updateSidePanelAll(byState, states);
      } else {
        const topEntry = Object.entries(byState).reduce(
          (best, [fips, data]) => (!best || data.count > best[1].count ? [fips, data] : best),
          null
        );
        if (topEntry) {
          const [topFips, topData] = topEntry;
          const topFeature = states.features.find((f) => toFips(f.id) === topFips);
          const topName = topFeature?.properties?.name || topData.state || 'Unknown';
          this._selectedStateFips = topFips;
          this._selectedStateName = topName;
          this._updateSidePanel(topName, topData);
        }
      }
      this._panelInitialized = true;
    } else if (this._byYearIndex && this._selectedStateFips) {
      const snapshot = this._byYearIndex[this._selectedYear];
      const stateData = snapshot?.byState?.[this._selectedStateFips];
      const topFeature = states.features.find((f) => toFips(f.id) === this._selectedStateFips);
      const stateName = topFeature?.properties?.name || this._selectedStateName;
      if (stateData?.companies?.length) {
        this._updateSidePanel(stateName, stateData);
      } else if (this._showAllByDefault) {
        this._updateSidePanelAll(snapshot?.byState || {}, states);
      } else {
        const topEntry = Object.entries(snapshot?.byState || {}).reduce(
          (best, [fips, data]) => (!best || data.count > best[1].count ? [fips, data] : best),
          null
        );
        if (topEntry) {
          const [topFips, topData] = topEntry;
          const feat = states.features.find((f) => toFips(f.id) === topFips);
          this._selectedStateFips = topFips;
          this._selectedStateName = feat?.properties?.name || topData.state || 'Unknown';
          this._updateSidePanel(this._selectedStateName, topData);
        }
      }
    } else if (this._showAllByDefault && this._byYearIndex) {
      const snapshot = this._byYearIndex[this._selectedYear];
      this._updateSidePanelAll(snapshot?.byState || {}, states);
    }

    if (this._showStateShape && this._stateShapeWrap && this._selectedStateFips && states) {
      this._drawStateShape(states);
    } else if (this._stateShapeWrap) {
      this._stateShapeWrap.innerHTML = '';
    }

    if (this._legendRangeEl) {
      this._legendRangeEl.textContent = `0 — ${maxCount} companies`;
    }

    this.svg = svg;
  }

  _startYearAutoAdvance() {
    this._stopYearAutoAdvance();
    if (!this._years?.length) return;

    const scrubberInput = this._wrapper?.querySelector('.viz-time-scrubber');
    const progressEl = this._scrubberProgress;
    if (!scrubberInput || !progressEl) return;

    const minYear = this._years[0];
    const maxYear = this._years[this._years.length - 1];
    const duration = 24000;
    const startTime = performance.now();
    const range = maxYear - minYear;

    this._setReplayButtonPlaying();
    this._sidePanel?.classList.add('state-side-panel-bar-moving');
    const tick = () => {
      const elapsed = (performance.now() - startTime) % duration;
      const progress = Math.min(1, elapsed / duration);
      const year = range > 0 ? Math.round(minYear + progress * range) : minYear;
      const clampedYear = Math.min(maxYear, Math.max(minYear, year));

      if (clampedYear !== this._selectedYear) {
        this._selectedYear = clampedYear;
        scrubberInput.value = String(clampedYear);
        if (this._scrubberLabel) this._scrubberLabel.textContent = `Year: ${clampedYear}`;
        requestAnimationFrame(() => this._drawMap());
      }

      progressEl.style.transform = `scale3d(${progress}, 1, 1)`;

      this._yearAutoAdvanceRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  _stopYearAutoAdvance() {
    if (this._yearAutoAdvanceRAF != null) {
      cancelAnimationFrame(this._yearAutoAdvanceRAF);
      this._yearAutoAdvanceRAF = null;
    }
    this._sidePanel?.classList.remove('state-side-panel-bar-moving');
  }

  _setReplayButtonStopped() {
    if (this._replayBtn) {
      this._replayBtn.classList.remove('viz-time-scrubber-replay-playing');
      this._replayBtn.classList.add('viz-time-scrubber-replay-stopped');
      this._replayBtn.innerHTML = '▶ Play';
      this._replayBtn.setAttribute('aria-label', 'Resume year animation');
    }
  }

  _setReplayButtonPlaying() {
    if (this._replayBtn) {
      this._replayBtn.classList.remove('viz-time-scrubber-replay-stopped');
      this._replayBtn.classList.add('viz-time-scrubber-replay-playing');
      this._replayBtn.innerHTML = '⏸ Pause';
      this._replayBtn.setAttribute('aria-label', 'Pause year animation');
    }
  }

  _showMilestoneTooltip(markerEl, year, label) {
    if (!this._milestoneTooltip) {
      this._milestoneTooltip = document.createElement('div');
      this._milestoneTooltip.className = 'viz-time-scrubber-milestone-tooltip';
      document.body.appendChild(this._milestoneTooltip);
    }
    this._milestoneTooltip.innerHTML = `<strong>${year}</strong><br/><span>${label}</span>`;
    this._milestoneTooltip.style.display = 'block';
    const rect = markerEl.getBoundingClientRect();
    this._milestoneTooltip.style.left = `${rect.left + rect.width / 2}px`;
    this._milestoneTooltip.style.top = `${rect.top - 8}px`;
    this._milestoneTooltip.style.transform = 'translate(-50%, -100%)';
  }

  _hideMilestoneTooltip() {
    if (this._milestoneTooltip) this._milestoneTooltip.style.display = 'none';
  }

  _drawStateShape(states) {
    if (!this._stateShapeWrap || !this._selectedStateFips || !states?.features) return;
    const feature = states.features.find((f) => toFips(f.id) === this._selectedStateFips);
    if (!feature) return;

    const size = 100;
    const projection = d3.geoAlbersUsa().fitSize([size, size], { type: 'FeatureCollection', features: [feature] });
    const path = d3.geoPath(projection);

    this._stateShapeWrap.innerHTML = '';
    const svg = d3
      .select(this._stateShapeWrap)
      .append('svg')
      .attr('viewBox', [0, 0, size, size])
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('class', 'panel-state-shape-svg');
    svg
      .append('path')
      .attr('d', path(feature))
      .attr('fill', 'rgba(212, 175, 55, 0.25)')
      .attr('stroke', 'var(--accent-gold)')
      .attr('stroke-width', 2)
      .attr('class', 'panel-state-shape-path');
  }

  _updateSidePanelAll(byState, states) {
    if (!this._sidePanelTitle || !this._sidePanelBody || !this._sidePanelStats) return;
    if (this._stateShapeWrap) this._stateShapeWrap.innerHTML = '';

    const allCompanies = Object.values(byState).flatMap((d) =>
      d.companies.map((c) => ({ ...c, fips: d.fips }))
    );
    const sorted = [...allCompanies].sort((a, b) => b.marketCap - a.marketCap);
    const totalCompanies = sorted.length;
    const totalCap = sorted.reduce((s, c) => s + c.marketCap, 0);
    const totalCapStr = (totalCap / 1e12).toFixed(2);

    this._selectedStateFips = null;
    this._selectedStateName = null;
    this._sidePanelTitle.innerHTML = `All S&P 500 Companies — <span class="state-side-panel-title-count">${totalCompanies}</span> total`;
    this._sidePanelSubtitle.textContent = 'Ranked by market cap · Click a state to filter by location';
    this._sidePanelStats.innerHTML = `
      <span class="state-side-panel-stat"><strong>$${totalCapStr}T</strong> total market cap</span>
    `;
    if (this._sidePanelBadge) this._sidePanelBadge.textContent = 'All companies';

    this._sidePanelBody.innerHTML = '';
    sorted.forEach((c) => {
      const fips = c.fips;
      const row = document.createElement('div');
      row.className = 'state-side-company-item state-company-item';
      row.setAttribute('data-state-fips', fips);
      const capStr =
        c.marketCap >= 1e12
          ? `$${(c.marketCap / 1e12).toFixed(2)}T`
          : c.marketCap >= 1e9
            ? `$${(c.marketCap / 1e9).toFixed(2)}B`
            : c.marketCap >= 1e6
              ? `$${(c.marketCap / 1e6).toFixed(2)}M`
              : `$${c.marketCap.toLocaleString()}`;
      const priceStr = c.currentPrice != null ? `$${c.currentPrice.toFixed(2)}` : '—';
      const empStr = c.employees != null ? c.employees.toLocaleString() : '—';
      const loc = [c.city, c.state].filter(Boolean).join(', ') || '—';
      const sectorIndustry = [c.sector, c.industry].filter(Boolean).join(' · ') || '—';
      row.innerHTML = `
        <div class="state-side-company-main">
          <span class="state-side-company-symbol">${c.symbol}</span>
          <span class="state-side-company-name">${c.name || '-'}</span>
          <span class="state-side-company-cap">${capStr}</span>
        </div>
        <div class="state-side-company-info-block">
          <div class="state-side-company-info-row">
            <span class="state-side-company-info-label">Industry</span>
            <span class="state-side-company-info-value">${sectorIndustry}</span>
          </div>
          <div class="state-side-company-info-row">
            <span class="state-side-company-info-label">Location</span>
            <span class="state-side-company-info-value">${loc}</span>
          </div>
          <div class="state-side-company-info-row state-side-company-meta-row">
            <span class="state-side-company-info-pair">
              <span class="state-side-company-info-label">Price</span>
              <span class="state-side-company-info-value">${priceStr}</span>
            </span>
            <span class="state-side-company-info-pair">
              <span class="state-side-company-info-label">Employees</span>
              <span class="state-side-company-info-value">${empStr}</span>
            </span>
          </div>
        </div>
      `;
      row.addEventListener('mouseenter', () => this._highlightSpikeForSymbol(c.symbol));
      row.addEventListener('mouseleave', () => this._unhighlightSpike());
      if (this._enableCompanyClick && c.symbol) {
        row.classList.add('state-side-company-item-clickable');
        row.addEventListener('click', () => {
          if (this._yearAutoAdvanceRAF != null) return;
          window.dispatchEvent(new CustomEvent('marketscope:openStock', { detail: { symbol: c.symbol } }));
        });
      }
      this._sidePanelBody.appendChild(row);
    });
  }

  _updateSidePanel(stateName, stateData) {
    if (!this._sidePanelTitle || !this._sidePanelBody || !this._sidePanelStats) return;
    this._sidePanelTitle.textContent = `${stateName} — ${stateData.count} companies`;
    this._sidePanelSubtitle.textContent = 'Company roster by market cap';
    const marketCapTr = (stateData.marketCap / 1e12).toFixed(2);
    this._sidePanelStats.innerHTML = `
      <span class="state-side-panel-stat"><strong>$${marketCapTr}T</strong> total market cap</span>
      <span class="state-side-panel-stat"><strong>${stateData.count}</strong> S&P 500 companies</span>
    `;
    this._sidePanelBody.innerHTML = '';

    const showAllBtn = document.createElement('button');
    showAllBtn.className = 'state-panel-show-all';
    showAllBtn.textContent = '← Back to all companies';
    showAllBtn.setAttribute('aria-label', 'Back to all companies');
    showAllBtn.addEventListener('click', () => {
      this._updateSidePanelAll(this.byState, this._states);
    });
    this._sidePanelBody.appendChild(showAllBtn);

    const sorted = [...stateData.companies].sort((a, b) => b.marketCap - a.marketCap);
    const fips = stateData.fips;
    sorted.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'state-side-company-item state-company-item';
      row.setAttribute('data-state-fips', fips);
      const capStr =
        c.marketCap >= 1e12
          ? `$${(c.marketCap / 1e12).toFixed(2)}T`
          : c.marketCap >= 1e9
            ? `$${(c.marketCap / 1e9).toFixed(2)}B`
            : c.marketCap >= 1e6
              ? `$${(c.marketCap / 1e6).toFixed(2)}M`
              : `$${c.marketCap.toLocaleString()}`;
      const priceStr = c.currentPrice != null ? `$${c.currentPrice.toFixed(2)}` : '—';
      const empStr = c.employees != null ? c.employees.toLocaleString() : '—';
      const loc = [c.city, c.state].filter(Boolean).join(', ') || '—';
      const sectorIndustry = [c.sector, c.industry].filter(Boolean).join(' · ') || '—';
      row.innerHTML = `
        <div class="state-side-company-main">
          <span class="state-side-company-symbol">${c.symbol}</span>
          <span class="state-side-company-name">${c.name || '-'}</span>
          <span class="state-side-company-cap">${capStr}</span>
        </div>
        <div class="state-side-company-info-block">
          <div class="state-side-company-info-row">
            <span class="state-side-company-info-label">Industry</span>
            <span class="state-side-company-info-value">${sectorIndustry}</span>
          </div>
          <div class="state-side-company-info-row">
            <span class="state-side-company-info-label">Location</span>
            <span class="state-side-company-info-value">${loc}</span>
          </div>
          <div class="state-side-company-info-row state-side-company-meta-row">
            <span class="state-side-company-info-pair">
              <span class="state-side-company-info-label">Price</span>
              <span class="state-side-company-info-value">${priceStr}</span>
            </span>
            <span class="state-side-company-info-pair">
              <span class="state-side-company-info-label">Employees</span>
              <span class="state-side-company-info-value">${empStr}</span>
            </span>
          </div>
        </div>
      `;
      row.addEventListener('mouseenter', () => this._highlightSpikeForSymbol(c.symbol));
      row.addEventListener('mouseleave', () => this._unhighlightSpike());
      if (this._enableCompanyClick && c.symbol) {
        row.classList.add('state-side-company-item-clickable');
        row.addEventListener('click', () => {
          if (this._yearAutoAdvanceRAF != null) return;
          window.dispatchEvent(new CustomEvent('marketscope:openStock', { detail: { symbol: c.symbol } }));
        });
      }
      this._sidePanelBody.appendChild(row);
    });

    if (this._showStateShape && this._states) {
      this._drawStateShape(this._states);
    }
  }

  _createTooltip(container) {
    const tooltip = d3
      .select(document.body)
      .append('div')
      .attr('class', 'stock-map-tooltip')
      .style('position', 'fixed')
      .style('visibility', 'hidden')
      .style('background', 'rgba(26,26,26,0.95)')
      .style('color', '#f8fafc')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '13px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)');

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
    setTimeout(() => {
      toast.classList.remove('state-empty-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  async _loadMap() {
    try {
      return await d3.json(MAP_URL);
    } catch (e) {
      console.warn('Could not load map:', e);
      return null;
    }
  }

    unmount() {
    this._stopYearAutoAdvance();
    this._hideMilestoneTooltip();
    if (this._milestoneTooltip) {
      this._milestoneTooltip.remove();
      this._milestoneTooltip = null;
    }
    if (this._fullscreenModal) {
      this._fullscreenModal.remove();
      this._fullscreenModal = null;
    }
    d3.select(document.body).selectAll('.viz-map-fullscreen-spike-tooltip').remove();
    this._scrubberProgress = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._mapWithPanel?.remove();
    this._mapWithPanel = null;
    this._wrapper = null;
    this._captionEl = null;
    this._legendRangeEl = null;
    d3.select(document.body).selectAll('.stock-map-tooltip').remove();
    d3.select(document.body).selectAll('.state-empty-toast').remove();
    super.unmount();
  }
}
