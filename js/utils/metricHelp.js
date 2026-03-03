/**
 * Help text for playfield metrics: use case and how each is calculated.
 * Escapes HTML for safe injection.
 */
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const METRIC_HELP = {
  open: {
    use: 'The opening price of the first trading day in the selected date range. Useful as a baseline to compare price movement over the period.',
    calc: 'Taken directly from the open field of the first OHLCV row in the selected range.',
  },
  high: {
    use: 'The highest price reached during the selected date range. Shows the peak and resistance level.',
    calc: 'Maximum of all high values in the selected OHLCV data.',
  },
  low: {
    use: 'The lowest price reached during the selected date range. Shows the trough and support level.',
    calc: 'Minimum of all low values in the selected OHLCV data.',
  },
  mktcap: {
    use: 'Market capitalization — the total market value (price × outstanding shares). Indicates company or asset size.',
    calc: 'Price per share multiplied by total shares outstanding. For stocks: from metadata. For crypto: price × circulating supply.',
  },
  week52high: {
    use: 'The highest price over the past 52 weeks (252 trading days). Common reference for resistance and all‑time‑high context.',
    calc: 'Maximum of all high values from the last 252 trading days ending on the range end date.',
  },
  week52low: {
    use: 'The lowest price over the past 52 weeks (252 trading days). Common reference for support levels.',
    calc: 'Minimum of all low values from the last 252 trading days ending on the range end date.',
  },
};

export function getMetricHelpHtml(key) {
  const h = METRIC_HELP[key];
  if (!h) return '';
  const use = escapeHtml(h.use);
  const calc = escapeHtml(h.calc);
  return `<strong>Use:</strong> ${use}<br><br><strong>How it's calculated:</strong> ${calc}`;
}
