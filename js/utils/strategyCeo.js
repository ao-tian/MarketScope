/**
 * Strategy id (CSV basename without .csv) → CEO / public face image in /data/CEO/
 */
const CEO_BASE = '/data/CEO';

/** @type {Record<string, { image: string; name: string; note?: string; isLogo?: boolean }>} */
const STRATEGY_CEO_MAP = {
  'appaloosa_lp_2023-12-31': { image: 'david_tepper.jpeg', name: 'David Tepper' },
  'baupost_group_llc_2023-12-31': { image: 'seth_klarman.jpeg', name: 'Seth Klarman' },
  'berkshire_hathaway_2023-12-31': {
    image: 'warren_buffett.jpeg',
    name: 'Warren Buffett',
    note: 'CEO & largest shareholder',
  },
  'capital_research_global_investors_2023-12-31': {
    image: 'capital_group.png',
    name: 'Capital Group',
    note: 'No single CEO — part of Capital Group, privately held by partners and employees.',
    isLogo: true,
  },
  'greenlight_capital_inc_2023-12-31': { image: 'David_Einhorn.jpeg', name: 'David Einhorn' },
  'lone_pine_capital_llc_2023-12-31': { image: 'Stephen_Mandel.jpeg', name: 'Stephen Mandel' },
  'pershing_square_capital_management_lp_2023-12-31': { image: 'Bill_Ackman.jpeg', name: 'Bill Ackman' },
  'third_point_llc_2023-12-31': { image: 'Daniel_Loeb.jpeg', name: 'Daniel Loeb' },
  'viking_global_investors_lp_2023-12-31': { image: 'Andreas_Halvorsen.jpeg', name: 'Andreas Halvorsen' },
};

export function getStrategyCeoVisual(strategyId) {
  if (!strategyId || strategyId === 'best-worst') return null;
  return STRATEGY_CEO_MAP[strategyId] || null;
}

export function getStrategyCeoImageUrl(strategyId) {
  const v = getStrategyCeoVisual(strategyId);
  if (!v) return null;
  return `${CEO_BASE}/${v.image}`;
}
