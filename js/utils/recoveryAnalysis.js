const MA_WINDOW = 45;

/**
 * Computes 45-day moving average of close price.
 * First 44 points use partial window (as many days as available).
 * @param {Array<{date: Date, close: number}>} ohlcv
 * @returns {Array<{date: Date, close: number, ma45: number}>}
 */
export function compute45DayMA(ohlcv) {
  if (!ohlcv?.length) return [];
  const result = [];
  for (let i = 0; i < ohlcv.length; i++) {
    const start = Math.max(0, i - MA_WINDOW + 1);
    const slice = ohlcv.slice(start, i + 1);
    const sum = slice.reduce((s, d) => s + (d.close ?? 0), 0);
    const ma45 = slice.length ? sum / slice.length : ohlcv[i].close;
    result.push({
      date: ohlcv[i].date,
      close: ohlcv[i].close,
      ma45,
    });
  }
  return result;
}

/**
 * Finds global min, local max before it, and recovery time.
 * @param {Array<{date: Date, ma45: number}>} maData - output of compute45DayMA
 * @returns {{ globalMin, localMaxBefore, recoveryDays, recoveryDate, maData } | null}
 */
export function analyzeRecovery(maData) {
  if (!maData?.length) return null;

  let globalMinIdx = 0;
  let globalMinVal = maData[0].ma45;
  for (let i = 1; i < maData.length; i++) {
    if (maData[i].ma45 < globalMinVal) {
      globalMinVal = maData[i].ma45;
      globalMinIdx = i;
    }
  }

  if (globalMinIdx === 0) {
    return {
      globalMin: { value: globalMinVal, date: maData[0].date, index: 0 },
      localMaxBefore: null,
      recoveryDays: null,
      recoveryDate: null,
      maData,
    };
  }

  let localMaxIdx = 0;
  let localMaxVal = maData[0].ma45;
  for (let i = 1; i < globalMinIdx; i++) {
    if (maData[i].ma45 > localMaxVal) {
      localMaxVal = maData[i].ma45;
      localMaxIdx = i;
    }
  }

  let recoveryIdx = null;
  for (let i = globalMinIdx + 1; i < maData.length; i++) {
    if (maData[i].ma45 >= localMaxVal) {
      recoveryIdx = i;
      break;
    }
  }

  const recoveryDays =
    recoveryIdx != null ? recoveryIdx - globalMinIdx : null;
  const recoveryDate =
    recoveryIdx != null ? maData[recoveryIdx].date : null;

  return {
    globalMin: {
      value: globalMinVal,
      date: maData[globalMinIdx].date,
      index: globalMinIdx,
    },
    localMaxBefore: {
      value: localMaxVal,
      date: maData[localMaxIdx].date,
      index: localMaxIdx,
    },
    recoveryDays,
    recoveryDate,
    maData,
  };
}
