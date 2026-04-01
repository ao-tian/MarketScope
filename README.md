<div align="center">

![Typing SVG](https://readme-typing-svg.demolab.com?font=IBM+Plex+Sans&weight=600&size=28&pause=1200&color=B8860B&center=true&vCenter=true&width=700&height=70&lines=The+Chartwatchers;MarketScope+%E2%80%94+Stock+Playfield+%26+Investing+Tutorial)

**CSC course project · static web app · data-driven charts & simulations**

[![HTML5](https://img.shields.io/badge/HTML5-f06529?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-2965f1?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-f7df1e?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![D3.js](https://img.shields.io/badge/D3.js-v7-f9a03c?style=flat&logo=d3.js&logoColor=white)](https://d3js.org/)

</div>

---

## Links for markers

| Resource | URL |
|----------|-----|
| **Deployed project (live site)** | `https://REPLACE_WITH_YOUR_PRODUCTION_URL` |
| **Screencast / video walkthrough** | `https://REPLACE_WITH_YOUR_SCREENCAST_URL` |

Host the app on any static host you prefer (GitHub Pages, Netlify, Vercel, course server, etc.) and paste the public **https** link in the first row. Upload your demo video to YouTube, Google Drive (shared link), or the platform your course specifies, and put that URL in the second row.

---

## What this submission is

**MarketScope** is a browser-based investing education experience: a guided **tutorial** on the home page, interactive **stock and cryptocurrency** exploration with charts and metrics, and an **Investing Playfield** that runs personalized historical simulations (including best-versus-worst scenarios and optional fund-style strategies).

This repository is the **full source** for that application: markup, styling, client-side logic, bundled datasets, and documentation. There is **no backend**; the app runs entirely in the client after assets are served.

---

## What is our work vs. what is not

### Written and integrated by The Chartwatchers (our code & assets)

| Area | What we did |
|------|-------------|
| **Application shell** | `index.html` — layout, navigation, route bootstrapping, form structure, accessibility hooks. |
| **Styling** | `css/main.css` — full UI: landing hero, tutorial sections, markets playfield, crypto/stock panels, personalize flow, modals, responsive behavior. |
| **Routing & state** | `js/main.js` — client-side navigation, URL sync for `/stock`, `/crypto`, `/playfield`, markets tabs, personalize form validation and persistence, visualization mounting. |
| **Markets (stocks & crypto)** | `js/pages/StockPlayfield.js`, `js/pages/CryptoPlayfield.js` — search, trending, bubble charts, price charts with brushing, date filters, event markers, moving averages, metrics. |
| **Playfield results** | `js/pages/PersonalizeModal.js` — loading returns, best/worst and strategy modes, portfolio math, animated result views. |
| **Tutorial & maps** | `js/viz/vis1/*` — e.g. `StockMapChart.js`, `StockExplainerViz.js`, GICS integration, S&P story visuals. |
| **Layout & motion** | `js/layout/FloatingSymbols.js`, `js/layout/ScrollAnimations.js` — hero and section effects tied to scroll. |
| **Utilities** | `js/utils/*` — bubble charts, MA chart, playfield price brush, tutorial stock chart, metric copy, interval/recovery helpers, strategy figureheads. |
| **Data loading** | `js/data/DataLoader.js`, `js/data/strategyLoader.js` — fetching and parsing CSV/JSON used by charts and Playfield. |
| **Datasets** | Files under `data/` — US stock symbols and per-ticker OHLCV CSVs, S&P 500 company metadata and index series, GICS hierarchies, inflation, gold, FOMC, government bonds, cryptocurrency series, financial events, and hedge-fund-style strategy holdings CSVs we wired into presets. |

All design decisions above—information architecture, copy, chart behavior, simulation rules, and data preparation—are **team effort** reflected in those files.

### Third-party libraries (loaded from CDN or used only as tools)

| Piece | Role | We did not write it |
|-------|------|---------------------|
| **[D3](https://d3js.org/) v7** | General visualization primitives; our charts call D3 for scales, selections, paths, etc. | D3 library |
| **[topojson-client](https://github.com/topojson/topojson-client) v3** | Geo / topology helpers for map-based visuals | Mapbox-style ecosystem; we consume it |
| **[Google Fonts](https://fonts.google.com/)** (Sora, DM Sans, Playfair Display, Fredoka, Comic Neue) | Typography | Font files served by Google |
| **`npx serve`** ([serve](https://github.com/vercel/serve)) | **Development-only** static file server with SPA fallback | Vercel’s CLI tool |

We **do not** ship `node_modules` or a `package.json`; production loads D3 and TopoJSON from URLs in `index.html`. Fonts load from Google’s stylesheet.

### Data provenance (we integrated and cleaned; sources vary)

Historical CSVs and JSON under `data/` come from public or assignment-appropriate sources (market data, macro series, fund filings–style holdings). We **processed, aligned, and connected** them to the UI; the **pipeline and parsing code** is ours (`DataLoader.js`, loaders in viz modules, strategy CSV parsing).

---

## Feature overview (effort summary)

- **Landing experience:** Branded hero, particle background, scroll-linked story, clear paths to tutorial vs. markets vs. Playfield.
- **Investing tutorial (home):** Interactive explainer for what a stock is, sector (GICS) context, U.S. map of S&P 500 headquarters, time scrubber for company founding years, and linked chart tutorials.
- **Stock & Crypto:** Symbol search, market-cap bubble views, deep-dive panel with adjustable date range, price history with **financial event** annotations, **15/45-day moving averages** with educational modal, drawdown/recovery-style metrics where implemented.
- **Investing Playfield:** User inputs (name, DOB or start date within data coverage, amount, number of lines). Modes: **pick your own allocations** or **fund-style strategies** with holdings and optional “figurehead” cards. Outputs: **best-case vs. worst-case** historical paths (or strategy-consistent views), animated numbers, sparkline-style per-holding visuals, takeaway copy framed as education—not advice.
- **Routing:** Shareable paths such as `/stock/AAPL` and `/crypto/...` with **single-page** behavior so refreshes do not 404 when served correctly.
- **Polish:** Loading states, error messaging for bad date ranges, accessibility touches (e.g. `aria-*`, live regions), responsive layout across major breakpoints.

---

## Run locally

From the project root, with [Node.js](https://nodejs.org/) installed:

```bash
npx serve -s .
```

Open the URL printed in the terminal (often `http://localhost:3000`).

### Why `npx serve -s .` and not plain `npx serve`?

The app uses **client-side routes** (for example `/playfield`, `/stock/AAPL`, `/crypto/...`). Without **`-s`**, the static server treats those paths as real files and returns **404** on refresh or direct visits. **`-s`** enables **single-page application** mode: requests that do not match a static file are served **`index.html`**, and our router handles the path.

The **`.`** argument means “serve the current directory” (the repository root).

### Quick route reference

| Path | Purpose |
|------|---------|
| `/` or `/home` | Tutorial landing and story sections |
| `/stock`, `/stock/SYMBOL` | U.S. stocks playfield |
| `/crypto`, `/crypto/...` | Cryptocurrency playfield |
| `/playfield`, `/playfield/result` | Investing Playfield form and results |

---

## Repository layout (abbreviated)

```
The_Chartwatchers/
├── index.html              # App entry, CDN scripts, shell markup
├── css/main.css            # All application styles
├── js/
│   ├── main.js             # Router, personalize form, viz registry
│   ├── data/               # Loaders for CSV/JSON
│   ├── layout/             # Hero / scroll helpers
│   ├── pages/              # Stock, crypto, personalize flows
│   ├── utils/              # Charts helpers, metrics copy, etc.
│   └── viz/vis1/           # Tutorial map & explainer implementations
└── data/                   # Symbols, OHLCV, macro, events, strategies, …
```

---

## License / course use

Submitted for academic evaluation as part of **The Chartwatchers** final project. If you reuse any portion, retain attribution and respect the original data licenses of underlying datasets.
