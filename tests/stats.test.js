import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_CATEGORY, categoryKey, categoryName, periodTotals, categoryBreakdown, formatShare, savingsRate, formatRate,
  monthlySeries, categoryEntries, averageMonths, monthlyAverage,
} from '../js/stats.js';

const C = (id, type, name, order, color, hidden = false) => ({ id, type, name, order, color, hidden });
const categories = [
  C('e01', 'expense', '食費', 0, 'food'),
  C('e02', 'expense', '外食', 1, 'outing'),
  C('e03', 'expense', 'おやつ', 2, 'food'),
  C('e04', 'expense', '日用品', 3, 'living'),
  C('e05', 'expense', '服', 4, 'family', true),
  C('i01', 'income', '給料', 0, 'income'),
];
let n = 0;
const E = (type, amount, date, categoryId) => ({ id: `x${++n}`, type, amount, date, categoryId, methodId: 'm1', memo: '', createdAt: n });

test('categoryKey and categoryName: a missing category counts as （分類なし）', () => {
  assert.equal(categoryKey(E('expense', 1, '2026-10-01', 'e01'), categories), 'e01');
  assert.equal(categoryKey(E('expense', 1, '2026-10-01', 'gone'), categories), NO_CATEGORY);
  assert.equal(categoryName('e02', categories), '外食');
  assert.equal(categoryName(NO_CATEGORY, categories), '（分類なし）');
});

test('periodTotals: a month or a year; diff = income - expense', () => {
  const entries = [
    E('expense', 1000, '2025-12-31', 'e01'), E('expense', 300, '2026-01-01', 'e01'),
    E('income', 200, '2026-01-31', 'i01'), E('expense', 50, '2026-02-01', 'e02'),
  ];
  assert.deepEqual(periodTotals(entries, '2026-01'), { expense: 300, income: 200, diff: -100 });
  assert.deepEqual(periodTotals(entries, '2026'), { expense: 350, income: 200, diff: -150 });
  assert.deepEqual(periodTotals(entries, '2025'), { expense: 1000, income: 0, diff: -1000 });
  assert.deepEqual(periodTotals(entries, '2027'), { expense: 0, income: 0, diff: 0 });
});

test('categoryBreakdown: largest first, ties in settings order, hidden and missing categories included', () => {
  const entries = [
    E('expense', 500, '2026-10-01', 'e03'), E('expense', 500, '2026-10-02', 'e01'),
    E('expense', 2000, '2026-10-03', 'e02'), E('expense', 500, '2026-10-04', 'gone'),
    E('expense', 500, '2026-10-05', 'e05'), E('income', 9999, '2026-10-05', 'i01'),
    E('expense', 7777, '2026-11-01', 'e01'),
  ];
  const { total, rows } = categoryBreakdown(entries, categories, '2026-10', 'expense');
  assert.equal(total, 4000);
  assert.deepEqual(rows.map(r => [r.categoryId, r.name, r.amount, r.share]), [
    ['e02', '外食', 2000, 0.5],
    ['e01', '食費', 500, 0.125],
    ['e03', 'おやつ', 500, 0.125],
    ['e05', '服', 500, 0.125],
    [NO_CATEGORY, '（分類なし）', 500, 0.125],
  ]);
});

test('categoryBreakdown: a year, income, and nothing at all', () => {
  const entries = [E('income', 300, '2026-01-25', 'i01'), E('income', 300, '2026-12-25', 'i01'), E('income', 1, '2025-12-25', 'i01')];
  assert.deepEqual(categoryBreakdown(entries, categories, '2026', 'income'),
    { total: 600, rows: [{ categoryId: 'i01', name: '給料', amount: 600, share: 1 }] });
  assert.deepEqual(categoryBreakdown(entries, categories, '2026', 'expense'), { total: 0, rows: [] });
});

test('formatShare: whole percent, 「1%未満」 under 1%', () => {
  assert.equal(formatShare(0.125), '13%');
  assert.equal(formatShare(0.5), '50%');
  assert.equal(formatShare(1), '100%');
  assert.equal(formatShare(0.0099), '1%未満');
  assert.equal(formatShare(0.01), '1%');
  assert.equal(formatShare(0), '0%');
});

test('savingsRate and formatRate: — without income, minus in red text style', () => {
  assert.equal(savingsRate({ income: 200000, diff: 50000 }), 25);
  assert.equal(savingsRate({ income: 200000, diff: -50000 }), -25);
  assert.equal(savingsRate({ income: 0, diff: -3000 }), null);
  assert.equal(savingsRate({ income: 0, diff: 0 }), null);
  assert.equal(savingsRate({ income: 1000, diff: 1000 }), 100);
  assert.equal(savingsRate({ income: 200, diff: -1 }), -1); // -0.5 rounds away from 0
  assert.equal(formatRate(25), '25%');
  assert.equal(formatRate(-25), '−25%');
  assert.equal(formatRate(0), '0%');
  assert.equal(formatRate(null), '—');
});

test('monthlySeries: 12 months of one type, optionally one category', () => {
  const entries = [
    E('expense', 100, '2026-01-01', 'e01'), E('expense', 200, '2026-01-31', 'e02'),
    E('expense', 300, '2026-12-31', 'e01'), E('expense', 999, '2025-12-31', 'e01'),
    E('income', 50, '2026-01-10', 'i01'), E('expense', 40, '2026-03-03', 'gone'),
  ];
  assert.deepEqual(monthlySeries(entries, categories, 2026, 'expense'), [300, 0, 40, 0, 0, 0, 0, 0, 0, 0, 0, 300]);
  assert.deepEqual(monthlySeries(entries, categories, 2026, 'expense', 'e01'), [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 300]);
  assert.deepEqual(monthlySeries(entries, categories, 2026, 'expense', NO_CATEGORY), [0, 0, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(monthlySeries(entries, categories, 2026, 'income'), [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(monthlySeries([], categories, 2026, 'expense'), Array(12).fill(0));
});

test('categoryEntries: one category, one month, one type, newest first', () => {
  const a = E('expense', 1, '2026-10-02', 'e01');
  const b = E('expense', 2, '2026-10-05', 'e01');
  const c = E('expense', 3, '2026-10-05', 'e01');
  const gone = E('expense', 4, '2026-10-03', 'gone');
  const entries = [a, b, c, gone, E('expense', 5, '2026-11-01', 'e01'), E('expense', 6, '2026-10-01', 'e02')];
  assert.deepEqual(categoryEntries(entries, categories, '2026-10', 'expense', 'e01'), [c, b, a]);
  assert.deepEqual(categoryEntries(entries, categories, '2026-10', 'expense', NO_CATEGORY), [gone]);
  assert.deepEqual(categoryEntries(entries, categories, '2026-09', 'expense', 'e01'), []);
});

test('averageMonths: from the first month of all entries (or January) to this month (or December)', () => {
  const entries = [E('expense', 1, '2026-10-01', 'e01'), E('income', 1, '2026-09-28', 'i01')];
  const today = '2026-10-07';
  assert.equal(averageMonths(entries, 2026, today), 2); // spec example: started in September
  assert.equal(averageMonths(entries, 2025, today), 0); // before the first entry
  assert.equal(averageMonths(entries, 2027, today), 0); // a future year
  assert.equal(averageMonths([], 2026, today), 0); // no entries at all
  assert.equal(averageMonths(entries, 2026, '2027-12-15'), 4); // a past year: September to December
  assert.equal(averageMonths(entries, 2027, '2027-12-15'), 12);
  assert.equal(averageMonths(entries, 2027, '2027-03-01'), 3);
  assert.equal(averageMonths([E('expense', 1, '2026-10-07', 'e01')], 2026, today), 1);
});

test('monthlyAverage: rounded to 1 yen, null when there is nothing to divide by', () => {
  assert.equal(monthlyAverage(10001, 2), 5001);
  assert.equal(monthlyAverage(10000, 3), 3333);
  assert.equal(monthlyAverage(0, 2), 0);
  assert.equal(monthlyAverage(0, 0), null);
});
