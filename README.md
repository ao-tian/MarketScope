# The Chartwatchers

## Run locally

From the project root, with [Node.js](https://nodejs.org/) installed:

```bash
npx serve -s .
```

Open the URL shown in the terminal (often `http://localhost:3000`).

### Why not `npx serve`?

The app uses client-side routes (e.g. `/playfield`, `/stock/AAPL`). **Without `-s`**, the `serve` tool treats those URLs as real files, so you get **404** on refresh or direct visits. **`-s`** turns on single-page mode: requests that don’t match a static file are served **`index.html`**, so the app can load and the router can handle the path.

The **`.`** means “serve this folder” (the repo root).
