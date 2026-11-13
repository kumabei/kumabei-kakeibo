// くまべえの1年ふりかえり (Ver.1.4.0, spec: docs/superpowers/specs/2026-11-13-kumabei-kakeibo-year-review-design.md
// in claude-workspace). Pure: no DOM, no IndexedDB. What to count and which cards to show; the words are in
// js/review-text.js. Dates are 'YYYY-MM-DD' and months 'YYYY-MM', so comparing the strings compares the days.
import { addDays, monthOf, addMonths, allSorted } from './logic.js';
import { categoryKey, categoryName, periodTotals, savingsRate } from './stats.js';

export const SAVER_RATE = 20; // spec 4-7: a savings rate (%) from which the year is 「コツコツためた年」 (provisional)
export const THRIFTY_SHARE = 0.3; // spec 4-7: the share of no-spend days from which it is 「やりくり上手の年」 (provisional)

const yearOf = dateStr => Number(dateStr.slice(0, 4));

// Spec 3: the entries counted for `year`: from January 1 to today (this year) or December 31 (a past year).
// Entries dated later (planned income put in ahead) are left out. null when there is nothing to count.
export function reviewRange(entries, year, today) {
  if (year > yearOf(today)) return null;
  const end = year === yearOf(today) ? today : `${year}-12-31`;
  const list = entries.filter(e => e.date >= `${year}-01-01` && e.date <= end);
  if (list.length === 0) return null;
  const start = list.reduce((min, e) => (e.date < min ? e.date : min), list[0].date);
  return { start, end, entries: list };
}

// Spec 3: the finished months, from the month of the first entry (even if it started mid-month) to last month
// (December for a past year). The month being looked at is still going on, so it is never included.
export function finishedMonths(start, year, today) {
  const last = year === yearOf(today) ? addMonths(monthOf(today), -1) : `${year}-12`;
  const out = [];
  for (let ym = monthOf(start); ym <= last; ym = addMonths(ym, 1)) out.push(ym);
  return out;
}

// Spec 4-3: every category a fixed cost is registered under, stopped and deleted ones too.
export function fixedCategoryIds(fixed) {
  return new Set(fixed.map(f => f.categoryId));
}

// A fixed-cost payment: marked by the automatic record, or in a fixed cost's category (the October rent typed by hand).
const isFixedCost = (e, fixedCats) => e.fixedId != null || fixedCats.has(e.categoryId);

function settingsRank(categories) {
  const rank = new Map(allSorted(categories).map((c, i) => [c.id, i]));
  return id => rank.get(id) ?? Infinity;
}

// Spec 4-2: the categories recorded most often. Ties: larger amount, then the settings order.
export function topCategories(expenses, categories, n = 3) {
  const sums = new Map();
  for (const e of expenses) {
    const key = categoryKey(e, categories);
    const s = sums.get(key) ?? { count: 0, amount: 0 };
    sums.set(key, { count: s.count + 1, amount: s.amount + e.amount });
  }
  const rank = settingsRank(categories);
  return [...sums]
    .map(([categoryId, s]) => ({ categoryId, name: categoryName(categoryId, categories), ...s }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount || rank(a.categoryId) - rank(b.categoryId))
    .slice(0, n);
}

// Spec 4-3: the most expensive expense that is not a fixed cost. Ties: the earlier date, then the one made first.
export function biggestPurchase(expenses, fixedCats) {
  const list = expenses.filter(e => !isFixedCost(e, fixedCats));
  if (list.length === 0) return null;
  return [...list].sort((a, b) => b.amount - a.amount || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    || a.createdAt - b.createdAt)[0];
}

// Spec 4-4: the days from start to lastDay (both included) without any expense; fixed-cost records count as
// spending. null when there are no days to count (lastDay before start).
export function zeroSpendDays(expenses, start, lastDay) {
  if (lastDay < start) return null;
  const spent = new Set(expenses.map(e => e.date));
  let days = 0;
  let zero = 0;
  for (let d = start; d <= lastDay; d = addDays(d, 1)) {
    days++;
    if (!spent.has(d)) zero++;
  }
  return { zero, days };
}

function sumsBy(expenses, categories, ym) {
  const sums = new Map();
  for (const e of expenses) {
    if (monthOf(e.date) !== ym) continue;
    const key = categoryKey(e, categories);
    sums.set(key, (sums.get(key) ?? 0) + e.amount);
  }
  return sums;
}

// Spec 4-5: the last two finished months a and b, and the category whose spending changed most from a to b
// (diff = b - a; null when nothing changed). From 3 finished months, also the month spent most and least
// (ties: the earlier month). null with fewer than 2 finished months.
export function compareMonths(expenses, categories, months) {
  if (months.length < 2) return null;
  const [a, b] = months.slice(-2);
  const sa = sumsBy(expenses, categories, a);
  const sb = sumsBy(expenses, categories, b);
  const rank = settingsRank(categories);
  const changes = [...new Set([...sa.keys(), ...sb.keys()])]
    .map(id => ({ categoryId: id, name: categoryName(id, categories), diff: (sb.get(id) ?? 0) - (sa.get(id) ?? 0) }))
    .filter(c => c.diff !== 0)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || rank(x.categoryId) - rank(y.categoryId));
  let most = null;
  let least = null;
  if (months.length >= 3) {
    const totals = months.map(ym => ({ ym, amount: [...sumsBy(expenses, categories, ym).values()].reduce((s, v) => s + v, 0) }));
    most = totals.reduce((m, t) => (t.amount > m.amount ? t : m));
    least = totals.reduce((m, t) => (t.amount < m.amount ? t : m));
  }
  return { a, b, change: changes[0] ?? null, most, least };
}

// Spec 4-7: the first that fits. rate: savingsRate (or null), zero: zeroSpendDays (or null).
export function yearFeature(rate, zero, expenses, categories, fixedCats) {
  if (rate !== null && rate >= SAVER_RATE) return { feature: 'saver' };
  if (zero && zero.days > 0 && zero.zero / zero.days >= THRIFTY_SHARE) return { feature: 'thrifty' };
  const sums = new Map();
  for (const e of expenses) {
    if (isFixedCost(e, fixedCats)) continue;
    const key = categoryKey(e, categories);
    sums.set(key, (sums.get(key) ?? 0) + e.amount);
  }
  const rank = settingsRank(categories);
  const top = [...sums].sort((x, y) => y[1] - x[1] || rank(x[0]) - rank(y[0]))[0];
  return top ? { feature: 'category', categoryId: top[0], name: categoryName(top[0], categories) } : null;
}

// Spec 4: the cards of `year`'s review in order, each { kind, ...numbers } (no words), or null when the year
// has nothing to count. The cards whose data is missing are left out.
export function buildReview(entries, categories, fixed, year, today) {
  const range = reviewRange(entries, year, today);
  if (!range) return null;
  const { start, end, entries: list } = range;
  const expenses = list.filter(e => e.type === 'expense');
  const fixedCats = fixedCategoryIds(fixed);
  const lastDay = year === yearOf(today) ? addDays(today, -1) : end; // spec 4-4: today may still be spent
  const cards = [{ kind: 'cover', year, start, end }];
  cards.push({ kind: 'count', entries: list.length, days: new Set(list.map(e => e.date)).size });
  if (expenses.length) cards.push({ kind: 'top3', rows: topCategories(expenses, categories) });
  const big = biggestPurchase(expenses, fixedCats);
  if (big) {
    const categoryId = categoryKey(big, categories);
    cards.push({ kind: 'biggest', date: big.date, categoryId, name: categoryName(categoryId, categories), memo: big.memo ?? '', amount: big.amount });
  }
  const zero = zeroSpendDays(expenses, start, lastDay);
  if (zero) cards.push({ kind: 'zeroDays', ...zero });
  const cmp = compareMonths(expenses, categories, finishedMonths(start, year, today));
  if (cmp) cards.push({ kind: 'compare', ...cmp });
  const totals = periodTotals(list, String(year));
  const rate = savingsRate(totals);
  if (rate !== null) cards.push({ kind: 'savings', rate, diff: totals.diff });
  const feature = expenses.length ? yearFeature(rate, zero, expenses, categories, fixedCats) : null;
  if (feature) cards.push({ kind: 'feature', ...feature });
  cards.push({ kind: 'closing' });
  return { year, start, end, cards };
}

// Spec 5-2: the card at the top of the year report. A past year with entries, or this year in December.
export function reviewCardShown(entries, year, today) {
  if (year === yearOf(today) && today.slice(5, 7) !== '12') return false;
  return reviewRange(entries, year, today) !== null;
}

// Spec 5-2: the banner on the home screen. December, this year has entries, and it has not been seen yet.
export function reviewBannerShown(entries, settings, today) {
  const year = yearOf(today);
  if (today.slice(5, 7) !== '12') return false;
  if ((settings.reviewSeenYears ?? []).includes(year)) return false;
  return reviewRange(entries, year, today) !== null;
}

// Spec 5-4: settings.reviewSeenYears with `year` added, or null when it is already there (nothing to save).
export function seenYearsAfter(settings, year) {
  const seen = settings.reviewSeenYears ?? [];
  return seen.includes(year) ? null : [...seen, year];
}
