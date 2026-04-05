<div align="center">

![Typing SVG](https://readme-typing-svg.demolab.com?font=IBM+Plex+Sans&weight=600&size=28&pause=1200&color=B8860B&center=true&vCenter=true&width=700&height=70&lines=The+Chartwatchers;MarketScope+%E2%80%94+Stock+Playfield+%26+Investing+Tutorial)

**CSC course project · static web app · data-driven charts & simulations**

[![HTML5](https://img.shields.io/badge/HTML5-f06529?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-2965f1?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-f7df1e?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![D3.js](https://img.shields.io/badge/D3.js-v7-f9a03c?style=flat&logo=d3.js&logoColor=white)](https://d3js.org/)

</div>

---

## Links

| Resource | URL |
|----------|-----|
| **Deployed app (Railway)** | https://marketscope-production-91bb.up.railway.app |
| **Process book (Google Doc)** | [CSC316 Process Book — The Chartwatchers](https://docs.google.com/document/d/1cEg_CTqo_cMjOTEWV8eM-T4vcistCgoRu46zFz00N7c/edit?usp=sharing) |
| **Walkthrough video (Loom)** | *Add your Loom link when ready* |

---

## What this project is

**MarketScope** is a browser-based investing education experience: a guided **tutorial** on the home page, interactive **stock and cryptocurrency** exploration with charts and metrics, and an **Investing Playfield** that runs personalized historical simulations (best vs. worst scenarios, optional fund-style strategies, and a **return-range** chart on the full “Best & Worst” path).

This repository is the **full source**: markup, styling, client-side logic, and bundled datasets. There is **no backend API** in the repo—the app runs in the **browser** once assets are served. **Cleaned data** lives under **`data/`** (CSV/JSON); if you need a separate archive for size limits, mirror that folder to cloud storage and note it in your own materials.

---

## Deployment (Railway)

Production is on **Railway** with **SPA fallback** so routes like `/playfield` and `/stock/AAPL` resolve to `index.html` (same idea as `serve -s` locally).

---

## Run locally

From the project root, with [Node.js](https://nodejs.org/) installed:

```bash
npx serve -s .
```

Open the URL shown in the terminal (often `http://localhost:3000`).

### Why `npx serve -s .` and not plain `npx serve`?

The app uses **client-side routes** (e.g. `/playfield`, `/stock/AAPL`, `/crypto/...`). **Without `-s`**, the static server treats those URLs as files and returns **404** on refresh or direct visits. **`-s`** enables single-page mode: requests that don’t match a static file are served **`index.html`**, and the router handles the path.

The **`.`** means “serve this folder” (the repo root).

### Quick route reference

| Path | Purpose |
|------|---------|
| `/` or `/home` | Tutorial landing and story sections |
| `/stock`, `/stock/SYMBOL` | U.S. stocks playfield |
| `/crypto`, `/crypto/...` | Cryptocurrency playfield |
| `/playfield`, `/playfield/result` | Investing Playfield form and results |

---

## Interface notes (non-obvious behavior)

- **URL sync:** Stock/crypto views update the address bar; reload only works when the host serves SPA fallback (`serve -s`, Railway, etc.).
- **Gold event markers:** Hover for a quick summary; click zooms the chart around that event and enables **Go back**. The event panel is anchored **near the dot**, not the corner of the viewport.
- **Moving averages:** Secondary chart plus a **Learn more** modal (15-day vs 45-day, golden/death cross vocabulary).
- **Playfield:** **Worst-case** slide and **Return range** chart apply to the full-market **Best & Worst** strategy; named fund strategies and custom picks use other layouts so framing stays clear.
- **Dates:** Playfield inputs are constrained to the **historical range** of our stock data where required so simulations stay meaningful.

---

## What is our code vs. libraries vs. data

### Written and integrated by The Chartwatchers

| Area | What we did |
|------|-------------|
| **Application shell** | `index.html` — layout, navigation, route bootstrapping, form structure, accessibility hooks. |
| **Styling** | `css/main.css` — full UI: landing, tutorial, markets, Playfield, modals, responsive layout. |
| **Routing & state** | `js/main.js` — client-side navigation, URL sync, markets tabs, personalize form validation and persistence, viz mounting. |
| **Markets** | `js/pages/StockPlayfield.js`, `CryptoPlayfield.js` — search, trending, bubbles, price charts, date filters, event markers, moving averages, metrics. |
| **Playfield** | `js/pages/PersonalizeModal.js` — returns loading, best/worst and strategy modes, portfolio math, animations, return-range visualization. |
| **Tutorial & maps** | `js/viz/vis1/*` — maps, explainer, GICS, tutorial charts. |
| **Layout & motion** | `js/layout/FloatingSymbols.js`, `ScrollAnimations.js`. |
| **Utilities** | `js/utils/*` — bubble charts, MA chart, playfield brush, metric copy, strategy figureheads, etc. |
| **Data loading** | `js/data/DataLoader.js`, `strategyLoader.js`. |
| **Datasets** | **`data/`** — symbols, OHLCV, S&P metadata, crypto, events, strategies, macro series, etc. |

### Third-party libraries (not our code)

| Piece | Role |
|-------|------|
| **[D3](https://d3js.org/) v7** | Visualization primitives (CDN in `index.html`). |
| **[topojson-client](https://github.com/topojson/topojson-client) v3** | Map / topology helpers (CDN). |
| **[Google Fonts](https://fonts.google.com/)** | Typography (linked in `index.html`). |
| **`npx serve`** ([serve](https://github.com/vercel/serve)) | **Local dev only** — static server with `-s` for SPA. |

We **do not** ship `node_modules`; production loads D3 and TopoJSON from URLs in `index.html`.

### Data provenance

Files under **`data/`** were integrated and cleaned for this app; upstream licenses apply to original sources.

---

## Feature overview

- **Home:** Hero, story sections, S&P map, time scrubber, stock explainer (GICS, sectors).
- **Stock & Crypto:** Search, bubbles, price history, financial event markers, moving averages, metrics.
- **Playfield:** Personal inputs, own allocations vs. fund-style strategies, best/worst and return-range views where applicable, educational framing.

---

## Repository layout (abbreviated)

```
The_Chartwatchers/
├── index.html
├── css/main.css
├── js/
│   ├── main.js
│   ├── data/
│   ├── layout/
│   ├── pages/
│   ├── utils/
│   └── viz/vis1/
└── data/
```

---

## License / course use

Submitted for academic evaluation as part of **The Chartwatchers** project. If you reuse any portion, retain attribution and respect the original data licenses of underlying datasets.
