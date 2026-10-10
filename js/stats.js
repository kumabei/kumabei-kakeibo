// Totals for the reports (Ver.1.2.0 spec 9, 10). Pure: no DOM, no IndexedDB. A period is 'YYYY-MM' (a month)
// or 'YYYY' (a year), so every function here also works for any year (for a later year-on-year view).
import { COLORS, allSorted, monthOf, sortNewestFirst } from './logic.js';

export const NO_CATEGORY = 'none'; // the id used for （分類なし）: entries whose category is not found
export const NO_CATEGORY_NAME = '（分類なし）';
export const SHADE_DARKEN = 0.22; // how much darker (HSL lightness) the first category of a color group is

const inPeriod = (e, period) => e.date.startsWith(period + '-');

// The category an entry counts under: its own id, or NO_CATEGORY when that category is gone.
export function categoryKey(entry, categories) {
  return categories.some(c => c.id === entry.categoryId) ? entry.categoryId : NO_CATEGORY;
}

export function categoryName(categoryId, categories) {
  return categories.find(c => c.id === categoryId)?.name ?? NO_CATEGORY_NAME;
}

// Spec 9: diff = income - expense.
export function periodTotals(entries, period) {
  let expense = 0;
  let income = 0;
  for (const e of entries) {
    if (!inPeriod(e, period)) continue;
    if (e.type === 'expense') expense += e.amount;
    else income += e.amount;
  }
  return { expense, income, diff: income - expense };
}

// Spec 4-1, 4-2: one row per category of `type`, largest first (ties: settings order, （分類なし） last).
// share is the raw fraction (not rounded): the label rule uses it as it is.
export function categoryBreakdown(entries, categories, period, type) {
  const sums = new Map();
  for (const e of entries) {
    if (e.type !== type || !inPeriod(e, period)) continue;
    const key = categoryKey(e, categories);
    sums.set(key, (sums.get(key) ?? 0) + e.amount);
  }
  const total = [...sums.values()].reduce((s, v) => s + v, 0);
  const rank = new Map(allSorted(categories).map((c, i) => [c.id, i]));
  const rows = [...sums]
    .map(([categoryId, amount]) => ({
      categoryId, name: categoryName(categoryId, categories), amount, share: amount / total,
    }))
    .sort((a, b) => b.amount - a.amount || (rank.get(a.categoryId) ?? Infinity) - (rank.get(b.categoryId) ?? Infinity));
  return { total, rows };
}

const roundHalfAway = x => Math.sign(x) * Math.round(Math.abs(x));

// Spec 9: a whole percent; under 1% (but not 0) is 「1%未満」.
export function formatShare(share) {
  if (share > 0 && share < 0.01) return '1%未満';
  return `${roundHalfAway(share * 100)}%`;
}

// Spec 9: diff / income × 100, rounded. null when there is no income.
export function savingsRate({ income, diff }) {
  return income === 0 ? null : roundHalfAway((diff / income) * 100);
}

export function formatRate(rate) {
  if (rate === null) return '—';
  return (rate < 0 ? '−' : '') + Math.abs(rate) + '%';
}

// Spec 5-1, 6: the 12 monthly totals of `type` in `year`; only one category when categoryId is given.
export function monthlySeries(entries, categories, year, type, categoryId = null) {
  const out = Array(12).fill(0);
  for (const e of entries) {
    if (e.type !== type || !inPeriod(e, String(year))) continue;
    if (categoryId !== null && categoryKey(e, categories) !== categoryId) continue;
    out[Number(e.date.slice(5, 7)) - 1] += e.amount;
  }
  return out;
}

// Spec 7: the entries of one category in one month, newest first.
export function categoryEntries(entries, categories, ym, type, categoryId) {
  return sortNewestFirst(entries.filter(e =>
    e.type === type && monthOf(e.date) === ym && categoryKey(e, categories) === categoryId));
}

const ymIndex = ym => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));

// Spec 9: how many months the year's total is divided by. From the oldest month of all entries
// (January if that is before the year) to this month (December for a past year). 0 when the year has
// no months to count (before the first entry, a future year, no entries at all): shown as 「—」.
export function averageMonths(entries, year, today) {
  if (entries.length === 0) return 0;
  const thisYear = Number(today.slice(0, 4));
  if (year > thisYear) return 0;
  const first = entries.reduce((min, e) => (monthOf(e.date) < min ? monthOf(e.date) : min), monthOf(entries[0].date));
  const start = first < `${year}-01` ? `${year}-01` : first;
  const end = year === thisYear ? monthOf(today) : `${year}-12`;
  return start > end ? 0 : ymIndex(end) - ymIndex(start) + 1;
}

export function monthlyAverage(total, months) {
  return months === 0 ? null : Math.round(total / months);
}

// ---- colors (spec 10) ----

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([r + m, g + m, b + m].map(v => v * 255));
}

// Spec 10: id → chart color. Within a color group (settings order, hidden ones counted), the first is
// SHADE_DARKEN darker in lightness and the last is the group's strong color, in equal steps.
export function categoryColors(categories, darken = SHADE_DARKEN) {
  const groups = new Map();
  for (const c of allSorted(categories)) {
    const key = COLORS[c.color] ? c.color : 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c.id);
  }
  const out = new Map();
  for (const [key, ids] of groups) {
    const [h, s, l] = hexToHsl(COLORS[key].strong);
    ids.forEach((id, i) => {
      const steps = ids.length - 1;
      const drop = steps === 0 ? 0 : darken * (steps - i) / steps;
      out.set(id, drop === 0 ? COLORS[key].strong : hslToHex([h, s, Math.max(0, l - drop)]));
    });
  }
  out.set(NO_CATEGORY, COLORS.other.strong);
  return out;
}
