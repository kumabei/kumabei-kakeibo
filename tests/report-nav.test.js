import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startView, monthForYear, switchSpan, step, setType, openCategoryYear, openEntries, openMethodEntries, back, pickMonth, openReview,
} from '../js/report-nav.js';

const today = '2026-10-07';

test('startView: this month, expenses, nothing to go back to', () => {
  assert.deepEqual(startView(today),
    { kind: 'month', ym: '2026-10', year: 2026, type: 'expense', categoryId: null, stack: [] });
});

test('monthForYear: this month, December for a past year, January for a future year', () => {
  assert.equal(monthForYear(2026, today), '2026-10');
  assert.equal(monthForYear(2025, today), '2025-12');
  assert.equal(monthForYear(2027, today), '2027-01');
});

test('switchSpan: month → the year of that month, year → month by monthForYear, type kept', () => {
  const income = setType(startView(today), 'income');
  const pastMonth = { ...income, ym: '2025-03' };
  const year = switchSpan(pastMonth, 'year', today);
  assert.equal(year.kind, 'year');
  assert.equal(year.year, 2025);
  assert.equal(year.type, 'income');
  const month = switchSpan(year, 'month', today);
  assert.equal(month.kind, 'month');
  assert.equal(month.ym, '2025-12');
  assert.equal(month.type, 'income');
  assert.equal(switchSpan(month, 'month', today), month);
});

test('step: months cross the year, years have no limit', () => {
  const m = startView('2026-12-31');
  assert.equal(step(m, 1).ym, '2027-01');
  assert.equal(step({ ...m, ym: '2026-01' }, -1).ym, '2025-12');
  const y = switchSpan(m, 'year', today);
  assert.equal(step(y, 1).year, 2027);
  assert.equal(step(step(y, -1), -1).year, 2024);
});

test('year → category year → entries → back → back returns to the year view and its scroll position', () => {
  const year = setType(switchSpan(startView(today), 'year', today), 'income');
  const cat = openCategoryYear(year, 'i01', 640);
  assert.equal(cat.kind, 'categoryYear');
  assert.equal(cat.categoryId, 'i01');
  assert.equal(cat.type, 'income');
  assert.equal(cat.stack.length, 1);
  const list = openEntries(cat, 'i01', '2026-03', 0);
  assert.equal(list.kind, 'entries');
  assert.equal(list.ym, '2026-03');
  assert.equal(list.stack.length, 2);
  const once = back(list);
  assert.equal(once.scrollY, 0);
  assert.equal(once.view.kind, 'categoryYear');
  assert.equal(once.view.ym, '2026-10'); // the category year did not take the entries' month
  assert.equal(once.view.stack.length, 1);
  const twice = back(once.view);
  assert.equal(twice.scrollY, 640);
  assert.deepEqual(twice.view, year);
});

test('month → entries → back', () => {
  const month = startView(today);
  const list = openEntries(month, 'none', '2026-10', 300);
  assert.equal(list.categoryId, 'none');
  const { view, scrollY } = back(list);
  assert.deepEqual(view, month);
  assert.equal(scrollY, 300);
});

test('month → the entries of one payment method → back', () => {
  const month = startView(today);
  const list = openMethodEntries(month, 'm2', '2026-10', 900);
  assert.equal(list.kind, 'methodEntries');
  assert.equal(list.methodId, 'm2');
  assert.equal(list.ym, '2026-10');
  assert.equal(list.type, 'expense');
  const { view, scrollY } = back(list);
  assert.deepEqual(view, month);
  assert.equal(scrollY, 900);
});

test('pickMonth: a bar of the year chart opens that month, type kept', () => {
  const year = setType(switchSpan(startView(today), 'year', today), 'income');
  const month = pickMonth(year, '2026-04');
  assert.equal(month.kind, 'month');
  assert.equal(month.ym, '2026-04');
  assert.equal(month.type, 'income');
  assert.deepEqual(month.stack, []);
});

test('openReview (Ver.1.4.0 spec 5-3): the list of a year, ＜戻る goes back where it came from', () => {
  const year = switchSpan(startView('2026-12-20'), 'year', '2026-12-20');
  const list = openReview(year, 2026, 320);
  assert.equal(list.kind, 'review');
  assert.equal(list.year, 2026);
  assert.equal(list.stack.length, 1);
  assert.deepEqual(back(list), { view: year, scrollY: 320 });
  const month = startView('2026-12-20'); // from the home banner (the month view)
  assert.deepEqual(back(openReview(month, 2026, 0)), { view: month, scrollY: 0 });
});
