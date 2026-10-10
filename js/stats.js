// Totals for the reports (Ver.1.2.0 spec 9, 10). Pure: no DOM, no IndexedDB. A period is 'YYYY-MM' (a month)
// or 'YYYY' (a year), so every function here also works for any year (for a later year-on-year view).
import { allSorted, monthOf, sortNewestFirst } from './logic.js';

export const NO_CATEGORY = 'none'; // the id used for （分類なし）: entries whose category is not found
export const NO_CATEGORY_NAME = '（分類なし）';

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
