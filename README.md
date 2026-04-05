<div align="center">

![Typing SVG](https://readme-typing-svg.demolab.com?font=IBM+Plex+Sans&weight=600&size=28&pause=1200&color=B8860B&center=true&vCenter=true&width=700&height=70&lines=The+Chartwatchers;MarketScope+%E2%80%94+Stock+Playfield+%26+Investing+Tutorial)

**CSC course project · static web app · data-driven charts & simulations**

[![HTML5](https://img.shields.io/badge/HTML5-f06529?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-2965f1?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-f7df1e?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![D3.js](https://img.shields.io/badge/D3.js-v7-f9a03c?style=flat&logo=d3.js&logoColor=white)](https://d3js.org/)

</div>

---

## URLs (live site, video, process book)

Course staff can open these directly:

| | |
|--|--|
| **Deployed website** | https://marketscope-production-91bb.up.railway.app |
| **Screencast / walkthrough (Loom)** | https://loom.com/share/5cd37980be884e53b0adb6494b61d5af |
| **Process book (Google Doc)** | https://docs.google.com/document/d/1cEg_CTqo_cMjOTEWV8eM-T4vcistCgoRu46zFz00N7c/edit?usp=sharing |

---

## Overview of what you are handing in

This submission is a **static web application** plus **cleaned datasets**. The following table separates **our work** from **third-party libraries** and **data files**.

| Category | What it is | Where it lives |
|----------|------------|----------------|
| **Our application code** | HTML structure, all CSS, and JavaScript (routing, charts, Playfield logic, loaders, utilities, tutorial visualizations). | Root `index.html`, `css/main.css`, everything under `js/` |
| **Third-party libraries** | Not vendored in the repo. **D3 v7** and **topojson-client v3** are loaded from public CDNs via `<script>` tags in `index.html`. **Google Fonts** are loaded from Google’s stylesheet. We did not write those libraries. | Declared in `index.html` (see script `src=` / `href=` URLs) |
| **Local dev tool** | **`serve`** (Vercel) is only used when you run `npx serve -s .`; it is not bundled in the project. | Installed on demand by npm when you run that command |
| **Data** | Cleaned CSV/JSON and related files used at runtime (stock OHLCV, symbols, crypto series, S&P listings, GICS, events, strategies, macro, etc.). We prepared and wired these files; original sources have their own licenses. | Folder **`data/`** |
| **Documentation** | This README. | `README.md` |

There is **no server-side application code** in this repository: there is no custom API or database. The deployed site is **static files** plus client-side JavaScript.

---

## What this project is

**MarketScope** is a browser-based investing education experience built by **The Chartwatchers**: a guided **tutorial** on the home page, interactive **stock and cryptocurrency** exploration with charts and metrics, and an **Investing Playfield** that runs personalized historical simulations (best vs. worst scenarios, optional fund-style strategies, and a **return-range** chart on the full “Best & Worst” path).

---

## Deployment

Production runs on **Railway** with **SPA (single-page) fallback** so client-side routes such as `/playfield`, `/stock/AAPL`, and `/crypto/...` resolve to `index.html` instead of 404—same behavior as running `npx serve -s .` locally.

---

## Run locally

From the project root, with [Node.js](https://nodejs.org/) installed:

```bash
npx serve -s .
```

Open the URL shown in the terminal (often `http://localhost:3000`).

### Why `npx serve -s .` and not plain `npx serve`?

The app uses **client-side routes** (e.g. `/playfield`, `/stock/AAPL`, `/crypto/...`). **Without `-s`**, many static servers return **404** on refresh or direct visits to those paths. **`-s`** enables single-page mode: requests that do not match a static file are served **`index.html`**, and our router handles the path.

The **`.`** means “serve this folder” (the repository root).

### Route reference

| Path | Purpose |
|------|---------|
| `/` or `/home` | Tutorial landing and story sections |
| `/stock`, `/stock/SYMBOL` | U.S. stocks playfield |
| `/crypto`, `/crypto/...` | Cryptocurrency playfield |
| `/playfield`, `/playfield/result` | Investing Playfield form and results |

---

## Non-obvious interface features

These behaviors are not obvious from a single screenshot; they matter for grading **interaction** and **polish**.

1. **Client-side routing and reload**  
   The address bar updates when you open stocks, crypto, or Playfield (e.g. `/stock/AAPL`). **Refreshing** or **pasting** that URL only works if the host serves **`index.html`** for unknown paths (Railway is configured for that; locally use `serve -s`). Plain static hosting without SPA fallback will show **404** on those URLs.

2. **Financial event markers (gold dots) on stock/crypto charts**  
   Markers tie price action to **historical event windows**. **Hover** shows a summary; **click** zooms the chart to a band around that event and reveals **Go back** to restore the previous date range. After a click, the chart **re-renders**; the event detail panel is positioned using the **dot’s screen position** so it stays **near the marker**, not fixed to the corner of the page.

3. **Moving averages**  
   A secondary chart shows **15-day and 45-day** MAs. A **Learn more** modal explains how to read the lines and defines **golden cross** / **death cross** in plain language (educational, not trading advice).

4. **Playfield modes and what you see**  
   Users can **allocate to their own picks** or choose **fund-style strategies** with preset holdings. The **worst-case** slide and the **Return range** band chart (best vs. worst portfolio paths over time) are shown for the full-market **“Best & Worst”** strategy path. **Named fund strategies** and **fully custom allocations** use other result layouts so we do not imply the same “universe worst” story when the user did not pick from the full market.

5. **Playfield dates**  
   Date of birth and related fields are constrained to the **historical coverage** of our stock data so simulations do not silently return empty or meaningless results.

6. **Search scope**  
   The stock search indexes **symbols present in our bundled list** (`data/US_Stocks/symbols.json`); it is not a live feed of every U.S. listing. Results are capped (e.g. up to 50 suggestions) for responsiveness.

---

## Our code vs. libraries vs. data (detail)

### Written by The Chartwatchers

| Area | Contents |
|------|----------|
| **Shell** | `index.html` — layout, navigation, route bootstrapping, forms, CDN script tags. |
| **Styles** | `css/main.css` — full UI. |
| **App & routing** | `js/main.js` — navigation, URL sync, markets tabs, personalize form validation and persistence, viz registry. |
| **Markets** | `js/pages/StockPlayfield.js`, `CryptoPlayfield.js` — search, trending, bubbles, price charts, events, MAs, metrics. |
| **Playfield** | `js/pages/PersonalizeModal.js` — loading returns, modes, portfolio math, animations, return-range chart. |
| **Tutorial / maps** | `js/viz/vis1/*`, `js/data/*` loaders, `js/layout/*`. |
| **Utilities** | `js/utils/*` — charts helpers, metric copy, strategy figureheads, etc. |
| **Bundled data** | Everything under **`data/`** referenced by the loaders. |

### Third-party libraries (we did not author; loaded from the network)

Scripts linked from `index.html` include (exact URLs are in that file):

- **D3** — https://d3js.org/ (v7 bundle used for scales, axes, paths, brushes, Playfield range chart).
- **TopoJSON client** — https://unpkg.com/topojson-client@3 (map topology helpers).
- **Google Fonts** — https://fonts.googleapis.com (font CSS for Sora, DM Sans, Playfair Display, Fredoka, Comic Neue).

We **do not** commit `node_modules`. Production relies on those CDN requests succeeding in the browser.

### Data

All cleaned inputs shipped with the app are under **`data/`**. Original market and macro sources are subject to their own terms; we integrated and shaped files for this project.

---

## Feature summary

- **Home:** Hero, scroll story, S&P map, founding-year scrubber, stock/GICS explainer and linked chart material.
- **Stock & Crypto:** Symbol search (within bundled universe), bubble view, adjustable date range, event markers, moving averages, metrics.
- **Playfield:** Personal inputs, custom vs. strategy modes, best/worst and optional return-range visualization, educational copy.

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
