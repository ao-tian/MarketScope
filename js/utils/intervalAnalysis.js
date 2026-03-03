import { compute45DayMA } from './recoveryAnalysis.js';

const ROLLING_WINDOW_DAYS = 30;

/**
 * Rolling-window analysis on the 45-day moving average (MA45) price series.
 * - Uses a fixed 30-day rolling window (days 1–30, 2–31, 3–32, … advancing one day at a time)
 * - Each window has one % change: (last MA45 − first MA45) / first MA45 × 100
 * - Returns the single window with greatest positive % change and the single with greatest negative % change.
 *
 * @param {Array<{date: Date, close: number}>} ohlcv
 * @returns {{ maxIncreaseWindow, maxDropWindow, stdDev }|null}
 */
export function analyzeInterval(ohlcv) {
  if (!ohlcv?.length) return null;

  const maData = compute45DayMA(ohlcv);
  if (!maData.length) return null;

  const windowSize = Math.min(ROLLING_WINDOW_DAYS, Math.max(2, maData.length - 1));

  let maxIncreaseWindow = null;
  let maxDropWindow = null;

  for (let i = 0; i <= maData.length - windowSize; i++) {
    const startMA45 = maData[i].ma45;
    const endMA45 = maData[i + windowSize - 1].ma45;
    const pct =
      startMA45 > 0
        ? ((endMA45 - startMA45) / startMA45) * 100
        : 0;

    const window = {
      startDate: maData[i].date,
      endDate: maData[i + windowSize - 1].date,
      pct,
    };

    if (
      maxDropWindow == null ||
      (pct < 0 && pct < maxDropWindow.pct)
    ) {
      maxDropWindow = pct < 0 ? { ...window } : maxDropWindow;
    }
    if (
      maxIncreaseWindow == null ||
      (pct > 0 && pct > maxIncreaseWindow.pct)
    ) {
      maxIncreaseWindow = pct > 0 ? { ...window } : maxIncreaseWindow;
    }
  }

  const closes = ohlcv.map((d) => d.close);
  let stdDev = null;
  if (closes.length >= 2) {
    const valid = closes.filter((c) => c != null && !isNaN(c));
    if (valid.length >= 2) {
      const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
      const variance =
        valid.reduce((s, c) => s + (c - mean) ** 2, 0) / (valid.length - 1);
      stdDev = Math.sqrt(variance);
    }
  }

  return {
    maxIncreaseWindow,
    maxDropWindow,
    stdDev,
  };
}
