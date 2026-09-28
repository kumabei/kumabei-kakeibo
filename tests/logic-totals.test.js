import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  entriesInMonth, monthTotals, methodBreakdown, expenseByDate, expenseOnDate, datesWithEntries,
  entriesOnDate, sortNewestFirst, isFirstRecordToday,
} from '../js/logic.js';

const at = (m, d, h) => new Date(2026, m - 1, d, h).getTime();
const E = (id, type, amount, date, methodId, createdAt) =>
  ({ id, type, amount, date, methodId, categoryId: 'e01', memo: '', createdAt, updatedAt: createdAt });

const methods = [
  { id: 'm1', name: '現金', order: 0, hidden: false },
  { id: 'm2', name: 'カード', order: 1, hidden: false },
  { id: 'm3', name: '電子マネー', order: 2, hidden: true },
  { id: 'm4', name: 'PayPay', order: 3, hidden: false },
];

const entries = [
  E('a', 'expense', 1000, '2026-09-01', 'm1', at(9, 1, 10)),
  E('b', 'expense', 2500, '2026-09-01', 'm2', at(9, 1, 11)),
  E('c', 'expense', 300, '2026-09-30', 'm3', at(9, 30, 9)),
  E('d', 'income', 50000, '2026-09-25', null, at(9, 25, 8)),
  E('e', 'expense', 700, '2026-10-01', 'm1', at(10, 1, 8)),
  E('f', 'expense', 400, '2026-08-31', 'm1', at(8, 31, 20)),
];

test('a month runs from the 1st to the last day', () => {
  assert.deepEqual(entriesInMonth(entries, '2026-09').map(e => e.id), ['a', 'b', 'c', 'd']);
});

test('monthTotals', () => {
  assert.deepEqual(monthTotals(entries, '2026-09'), { expense: 3800, income: 50000, diff: 46200 });
  assert.deepEqual(monthTotals(entries, '2026-11'), { expense: 0, income: 0, diff: 0 });
  assert.deepEqual(monthTotals(entries, '2026-10'), { expense: 700, income: 0, diff: -700 });
});

test('methodBreakdown keeps method order, shows used hidden methods, drops zero', () => {
  assert.deepEqual(methodBreakdown(entries, methods, '2026-09'), [
    { methodId: 'm1', name: '現金', amount: 1000 },
    { methodId: 'm2', name: 'カード', amount: 2500 },
    { methodId: 'm3', name: '電子マネー', amount: 300 },
  ]);
});

test('daily expense totals ignore income', () => {
  assert.deepEqual(expenseByDate(entries, '2026-09'), { '2026-09-01': 3500, '2026-09-30': 300 });
  assert.equal(expenseOnDate(entries, '2026-09-01'), 3500);
  assert.equal(expenseOnDate(entries, '2026-09-25'), 0);
});

test('datesWithEntries counts income days too', () => {
  assert.deepEqual([...datesWithEntries(entries, '2026-09')].sort(), ['2026-09-01', '2026-09-25', '2026-09-30']);
});

test('ordering of lists', () => {
  assert.deepEqual(entriesOnDate(entries, '2026-09-01').map(e => e.id), ['b', 'a']);
  assert.deepEqual(sortNewestFirst(entriesInMonth(entries, '2026-09')).map(e => e.id), ['c', 'd', 'b', 'a']);
});

test('isFirstRecordToday looks at when it was recorded, not the entry date', () => {
  assert.equal(isFirstRecordToday(entries, entries[0]), true);
  assert.equal(isFirstRecordToday(entries, entries[1]), false);
  const lateForYesterday = E('g', 'expense', 100, '2026-08-31', 'm1', at(9, 1, 12));
  assert.equal(isFirstRecordToday([...entries, lateForYesterday], lateForYesterday), false);
  const nextDay = E('h', 'expense', 100, '2026-09-02', 'm1', at(9, 2, 7));
  assert.equal(isFirstRecordToday([...entries, nextDay], nextDay), true);
});
