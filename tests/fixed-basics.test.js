import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payDate, sortFixed, findMark, startMonths, newFixed, resumedFixed, fixedRowText } from '../js/fixed.js';
import { initialCategories, initialMethods } from '../js/logic.js';

test('payDate uses the day, or the last day of a shorter month', () => {
  assert.equal(payDate('2026-10', 27), '2026-10-27');
  assert.equal(payDate('2026-10', 5), '2026-10-05');
  assert.equal(payDate('2026-11', 31), '2026-11-30');
  assert.equal(payDate('2027-02', 30), '2027-02-28');
  assert.equal(payDate('2028-02', 31), '2028-02-29');
});

test('sortFixed: earliest day first, then the one registered first', () => {
  const list = [{ id: 'a', day: 27, createdAt: 1 }, { id: 'b', day: 5, createdAt: 3 }, { id: 'c', day: 5, createdAt: 2 }];
  assert.deepEqual(sortFixed(list).map(f => f.id), ['c', 'b', 'a']);
  assert.deepEqual(list.map(f => f.id), ['a', 'b', 'c']); // not changed in place
});

test('findMark matches both the fixed cost and the month', () => {
  const entries = [{ id: 'x', fixedId: 'f-1', fixedMonth: '2026-10' }, { id: 'y', fixedId: 'f-2', fixedMonth: '2026-11' }, { id: 'z' }];
  assert.equal(findMark(entries, 'f-1', '2026-10').id, 'x');
  assert.equal(findMark(entries, 'f-1', '2026-11'), undefined);
  assert.equal(findMark(entries, 'f-2', '2026-10'), undefined);
});

test('startMonths: "not yet" starts this month, "already entered" next month', () => {
  assert.deepEqual(startMonths('2026-10-05', false), { startMonth: '2026-10', doneThrough: '2026-09' });
  assert.deepEqual(startMonths('2026-10-05', true), { startMonth: '2026-11', doneThrough: '2026-10' });
  assert.deepEqual(startMonths('2026-12-31', true), { startMonth: '2027-01', doneThrough: '2026-12' });
});

const DRAFT = { name: '住宅ローン', categoryId: 'e16', amount: 85000, methodId: 'm2', day: 27 };

test('newFixed', () => {
  assert.deepEqual(newFixed(DRAFT, false, '2026-10-05', 'f-1', 123), {
    id: 'f-1', name: '住宅ローン', categoryId: 'e16', amount: 85000, methodId: 'm2', day: 27, hidden: false,
    startMonth: '2026-10', doneThrough: '2026-09', createdAt: 123,
  });
});

test('resumedFixed starts again from now and keeps the rest', () => {
  const stopped = { ...newFixed(DRAFT, false, '2026-10-05', 'f-1', 123), hidden: true, doneThrough: '2026-10' };
  const r = resumedFixed(stopped, false, '2026-12-28');
  assert.equal(r.hidden, false);
  assert.equal(r.startMonth, '2026-12');
  assert.equal(r.doneThrough, '2026-11');
  assert.equal(r.name, '住宅ローン');
  assert.equal(r.createdAt, 123);
  assert.equal(resumedFixed(stopped, true, '2026-12-28').startMonth, '2027-01');
});

test('fixedRowText', () => {
  const f = newFixed(DRAFT, false, '2026-10-05', 'f-1', 123);
  assert.equal(fixedRowText(f, initialCategories(), initialMethods()), '27日　住宅ローン　85,000円　住居費・カード');
});
