import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVER_RATE, THRIFTY_SHARE, reviewRange, finishedMonths, fixedCategoryIds, topCategories, biggestPurchase,
  zeroSpendDays, compareMonths, yearFeature, buildReview, reviewCardShown, reviewBannerShown, seenYearsAfter,
} from '../js/review.js';

const C = (id, type, name, order) => ({ id, type, name, order, color: 'other', hidden: false });
const categories = [
  C('e01', 'expense', '食費', 0), C('e02', 'expense', '外食', 1), C('e03', 'expense', 'おやつ', 2),
  C('e16', 'expense', '住居費', 3), C('e14', 'expense', '通信費', 4), C('i01', 'income', '給料', 0),
];
// e16 has a running fixed cost; e14's fixed cost was deleted (still counts, spec 4-3).
const fixed = [
  { id: 'f1', categoryId: 'e16', name: '家賃', amount: 62867, day: 8, hidden: false },
  { id: 'f2', categoryId: 'e14', name: 'Wi-Fi', amount: 5000, day: 15, hidden: true, deleted: true },
];
let n = 0;
const E = (type, amount, date, categoryId, more = {}) =>
  ({ id: `x${++n}`, type, amount, date, categoryId, methodId: 'm1', memo: '', createdAt: n, ...more });
const X = (amount, date, categoryId, more) => E('expense', amount, date, categoryId, more);

test('spec 3: reviewRange counts Jan 1 to today (this year) or Dec 31 (a past year), never later dates', () => {
  const entries = [
    X(100, '2025-12-31', 'e01'), X(200, '2026-10-05', 'e01'),
    E('income', 300, '2026-12-30', 'i01'), X(50, '2026-12-20', 'e02'),
  ];
  const r = reviewRange(entries, 2026, '2026-12-20');
  assert.equal(r.start, '2026-10-05');
  assert.equal(r.end, '2026-12-20');
  assert.deepEqual(r.entries.map(e => e.date), ['2026-10-05', '2026-12-20']);
  const past = reviewRange(entries, 2025, '2026-12-20');
  assert.deepEqual([past.start, past.end, past.entries.length], ['2025-12-31', '2025-12-31', 1]);
  assert.equal(reviewRange(entries, 2027, '2026-12-20'), null);
  assert.equal(reviewRange(entries, 2024, '2026-12-20'), null);
  assert.equal(reviewRange([], 2026, '2026-12-20'), null);
});

test('spec 3: finishedMonths runs from the first month (even mid-month) to last month', () => {
  assert.deepEqual(finishedMonths('2026-10-05', 2026, '2026-12-20'), ['2026-10', '2026-11']);
  assert.deepEqual(finishedMonths('2026-10-05', 2026, '2026-11-03'), ['2026-10']);
  assert.deepEqual(finishedMonths('2026-12-01', 2026, '2026-12-20'), []);
  assert.deepEqual(finishedMonths('2025-11-15', 2025, '2026-12-20'), ['2025-11', '2025-12']);
});

test('spec 4-2: topCategories by count, then amount, then settings order; missing categories as （分類なし）', () => {
  const expenses = [
    X(100, '2026-10-01', 'e01'), X(100, '2026-10-02', 'e01'), X(100, '2026-10-03', 'e01'),
    X(500, '2026-10-01', 'e02'), X(500, '2026-10-02', 'e02'),
    X(100, '2026-10-01', 'e03'), X(100, '2026-10-02', 'e03'),
    X(10, '2026-10-01', 'gone'), X(10, '2026-10-02', 'gone'),
    X(62867, '2026-10-08', 'e16'),
  ];
  assert.deepEqual(topCategories(expenses, categories), [
    { categoryId: 'e01', name: '食費', count: 3, amount: 300 },
    { categoryId: 'e02', name: '外食', count: 2, amount: 1000 },
    { categoryId: 'e03', name: 'おやつ', count: 2, amount: 200 },
  ]);
  const tie = [X(100, '2026-10-01', 'e03'), X(100, '2026-10-01', 'e02')];
  assert.deepEqual(topCategories(tie, categories).map(r => r.categoryId), ['e02', 'e03']);
  assert.deepEqual(topCategories([X(10, '2026-10-01', 'gone')], categories),
    [{ categoryId: 'none', name: '（分類なし）', count: 1, amount: 10 }]);
});

test('spec 4-3: biggestPurchase leaves out fixed costs (marked, or in a fixed cost category); ties go to the earlier one', () => {
  const fixedCats = fixedCategoryIds(fixed);
  assert.deepEqual([...fixedCats].sort(), ['e14', 'e16']);
  const expenses = [
    X(62867, '2026-10-01', 'e16'), // the October rent typed by hand: no mark, but a fixed cost category
    X(5000, '2026-10-20', 'e14'), // the deleted fixed cost's category still counts
    X(8000, '2026-10-21', 'e01', { fixedId: 'f9' }), // marked as a fixed cost
    X(3000, '2026-11-02', 'e02'),
    X(3000, '2026-10-30', 'e03'),
  ];
  assert.equal(biggestPurchase(expenses, fixedCats).date, '2026-10-30');
  const sameDay = [X(3000, '2026-10-30', 'e02'), X(3000, '2026-10-30', 'e03')];
  assert.equal(biggestPurchase(sameDay, fixedCats).categoryId, 'e02'); // made first
  assert.equal(biggestPurchase([X(62867, '2026-10-01', 'e16')], fixedCats), null);
  assert.equal(biggestPurchase([], fixedCats), null);
});

test('spec 4-4: zeroSpendDays counts start..lastDay; fixed-cost records are spending', () => {
  const expenses = [X(100, '2026-10-01', 'e01'), X(100, '2026-10-03', 'e01'), X(200, '2026-10-03', 'e02')];
  assert.deepEqual(zeroSpendDays(expenses, '2026-10-01', '2026-10-05'), { zero: 3, days: 5 });
  const withFixed = [...expenses, X(62867, '2026-10-04', 'e16', { fixedId: 'f1' })];
  assert.deepEqual(zeroSpendDays(withFixed, '2026-10-01', '2026-10-05'), { zero: 2, days: 5 });
  assert.deepEqual(zeroSpendDays([], '2026-10-30', '2026-11-02'), { zero: 4, days: 4 });
  assert.equal(zeroSpendDays(expenses, '2026-12-01', '2026-11-30'), null);
});

test('spec 4-5: compareMonths needs 2 finished months and picks the largest change', () => {
  const expenses = [
    X(5000, '2026-10-03', 'e01'), X(2000, '2026-10-04', 'e02'),
    X(1800, '2026-11-03', 'e01'), X(2500, '2026-11-04', 'e02'), X(300, '2026-11-05', 'e03'),
  ];
  assert.equal(compareMonths(expenses, categories, ['2026-11']), null);
  assert.deepEqual(compareMonths(expenses, categories, ['2026-10', '2026-11']), {
    a: '2026-10', b: '2026-11', change: { categoryId: 'e01', name: '食費', diff: -3200 }, most: null, least: null,
  });
  const same = [X(100, '2026-10-01', 'e01'), X(100, '2026-11-01', 'e01')];
  assert.equal(compareMonths(same, categories, ['2026-10', '2026-11']).change, null);
  const tie = [X(100, '2026-10-01', 'e02'), X(100, '2026-11-01', 'e01')];
  assert.equal(compareMonths(tie, categories, ['2026-10', '2026-11']).change.categoryId, 'e01'); // settings order
});

test('spec 4-5: from 3 finished months, the month spent most and least (ties: the earlier month)', () => {
  const expenses = [
    X(9000, '2026-09-10', 'e01'),
    X(5000, '2026-10-03', 'e01'), X(2000, '2026-10-04', 'e02'),
    X(1800, '2026-11-03', 'e01'), X(2500, '2026-11-04', 'e02'), X(300, '2026-11-05', 'e03'),
  ];
  const r = compareMonths(expenses, categories, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual([r.a, r.b], ['2026-10', '2026-11']);
  assert.deepEqual(r.most, { ym: '2026-09', amount: 9000 });
  assert.deepEqual(r.least, { ym: '2026-11', amount: 4600 });
  const flat = [X(100, '2026-09-01', 'e01'), X(100, '2026-10-01', 'e01'), X(100, '2026-11-01', 'e01')];
  const f = compareMonths(flat, categories, ['2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(f.most, { ym: '2026-09', amount: 100 });
  assert.deepEqual(f.least, { ym: '2026-08', amount: 0 }); // a month without expenses counts as 0
});

test('spec 4-7: yearFeature takes the first rule that fits', () => {
  const fixedCats = fixedCategoryIds(fixed);
  const expenses = [X(60000, '2026-10-08', 'e16'), X(3000, '2026-10-09', 'e03'), X(2000, '2026-10-10', 'e01')];
  assert.equal(SAVER_RATE, 20);
  assert.equal(THRIFTY_SHARE, 0.3);
  assert.deepEqual(yearFeature(20, { zero: 0, days: 10 }, expenses, categories, fixedCats), { feature: 'saver' });
  assert.deepEqual(yearFeature(19, { zero: 3, days: 10 }, expenses, categories, fixedCats), { feature: 'thrifty' });
  assert.deepEqual(yearFeature(19, { zero: 2, days: 10 }, expenses, categories, fixedCats),
    { feature: 'category', categoryId: 'e03', name: 'おやつ' });
  assert.deepEqual(yearFeature(null, null, expenses, categories, fixedCats),
    { feature: 'category', categoryId: 'e03', name: 'おやつ' });
  const tie = [X(100, '2026-10-01', 'e03'), X(100, '2026-10-01', 'e02')];
  assert.equal(yearFeature(null, null, tie, categories, fixedCats).categoryId, 'e02');
  assert.equal(yearFeature(null, null, [X(60000, '2026-10-08', 'e16')], categories, fixedCats), null);
});

test('spec 4: buildReview puts the cards in order with their numbers', () => {
  const entries = [
    X(3000, '2026-10-01', 'e01'),
    X(62867, '2026-10-01', 'e16'),
    X(5000, '2026-10-15', 'e02', { memo: 'おすし' }),
    X(62867, '2026-11-08', 'e16', { fixedId: 'f1', fixedMonth: '2026-11', memo: '家賃' }),
    X(1000, '2026-11-10', 'e01'),
    E('income', 200000, '2026-11-25', 'i01'),
    E('income', 50000, '2026-12-30', 'i01'), // put in ahead: not counted
  ];
  const r = buildReview(entries, categories, fixed, 2026, '2026-12-20');
  assert.deepEqual([r.year, r.start, r.end], [2026, '2026-10-01', '2026-12-20']);
  assert.deepEqual(r.cards.map(c => c.kind),
    ['cover', 'count', 'top3', 'biggest', 'zeroDays', 'compare', 'savings', 'feature', 'closing']);
  const card = kind => r.cards.find(c => c.kind === kind);
  assert.deepEqual(card('cover'), { kind: 'cover', year: 2026, start: '2026-10-01', end: '2026-12-20' });
  assert.deepEqual(card('count'), { kind: 'count', entries: 6, days: 5 });
  assert.deepEqual(card('top3').rows.map(row => row.categoryId), ['e16', 'e01', 'e02']);
  assert.deepEqual(card('biggest'),
    { kind: 'biggest', date: '2026-10-15', categoryId: 'e02', name: '外食', memo: 'おすし', amount: 5000 });
  assert.deepEqual(card('zeroDays'), { kind: 'zeroDays', zero: 76, days: 80 }); // Oct 1 – Dec 19
  assert.deepEqual(card('compare').change, { categoryId: 'e02', name: '外食', diff: -5000 });
  assert.deepEqual(card('savings'), { kind: 'savings', rate: 33, diff: 65266 });
  assert.deepEqual(card('feature'), { kind: 'feature', feature: 'saver' });
});

test('spec 4: buildReview leaves out the cards without data, and is null for an empty year', () => {
  const r = buildReview([E('income', 1000, '2026-12-01', 'i01')], categories, fixed, 2026, '2026-12-01');
  assert.deepEqual(r.cards.map(c => c.kind), ['cover', 'count', 'savings', 'closing']);
  assert.equal(buildReview([], categories, fixed, 2026, '2026-12-01'), null);
});

test('spec 5-2: the year report card shows for a past year with entries, or this year in December', () => {
  const entries = [X(100, '2025-06-01', 'e01'), X(100, '2026-10-01', 'e01')];
  assert.equal(reviewCardShown(entries, 2026, '2026-11-30'), false);
  assert.equal(reviewCardShown(entries, 2026, '2026-12-01'), true);
  assert.equal(reviewCardShown(entries, 2025, '2026-03-01'), true);
  assert.equal(reviewCardShown(entries, 2024, '2026-03-01'), false);
  assert.equal(reviewCardShown(entries, 2027, '2026-12-01'), false);
});

test('spec 5-2: the home banner shows in December until this year has been seen', () => {
  const entries = [X(100, '2026-10-01', 'e01')];
  assert.equal(reviewBannerShown(entries, {}, '2026-12-01'), true);
  assert.equal(reviewBannerShown(entries, { reviewSeenYears: [2025] }, '2026-12-31'), true);
  assert.equal(reviewBannerShown(entries, { reviewSeenYears: [2026] }, '2026-12-01'), false);
  assert.equal(reviewBannerShown(entries, {}, '2026-11-30'), false);
  assert.equal(reviewBannerShown([], {}, '2026-12-01'), false);
});

test('spec 5-4: seenYearsAfter adds the year once', () => {
  assert.deepEqual(seenYearsAfter({}, 2026), [2026]);
  assert.deepEqual(seenYearsAfter({ reviewSeenYears: [2025] }, 2026), [2025, 2026]);
  assert.equal(seenYearsAfter({ reviewSeenYears: [2026] }, 2026), null);
});
