import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFixed, fixedSummary } from '../js/fixed.js';

const make = (name, categoryId, amount, day, id, createdAt) => (patch = {}) => ({
  ...newFixed({ name, categoryId, amount, methodId: 'm2', day }, false, '2026-10-01', id, createdAt), ...patch,
});
const loan = make('住宅ローン', 'e16', 85000, 27, 'f-1', 1);
const wifi = make('Wi-Fi', 'e14', 5500, 5, 'f-2', 2);
const ins = make('保険', 'e21', 12000, 27, 'f-3', 3);
const mark = (fixedId, fixedMonth, amount, extra = {}) => ({ id: `${fixedId}-${fixedMonth}`, amount, fixedId, fixedMonth, ...extra });

test('the example in the spec: recorded with ✓, the rest with its day', () => {
  const fixed = [loan({ doneThrough: '2026-10' }), wifi({ doneThrough: '2026-10' }), ins()];
  const entries = [mark('f-1', '2026-10', 85000), mark('f-2', '2026-10', 5500)];
  assert.deepEqual(fixedSummary(fixed, entries, '2026-10'), {
    rows: [
      { id: 'f-2', name: 'Wi-Fi', amount: 5500, done: true, day: null },
      { id: 'f-1', name: '住宅ローン', amount: 85000, done: true, day: null },
      { id: 'f-3', name: '保険', amount: 12000, done: false, day: 27 },
    ],
    recorded: 90500,
    total: 102500,
  });
});

test('a recorded row shows the amount of the entry (after editing it)', () => {
  const s = fixedSummary([loan({ doneThrough: '2026-10' })], [mark('f-1', '2026-10', 80000)], '2026-10');
  assert.deepEqual(s.rows.map(r => [r.amount, r.done]), [[80000, true]]);
  assert.equal(s.recorded, 80000);
});

test('the month is fixedMonth, not the date of the entry', () => {
  const moved = mark('f-1', '2026-10', 85000, { date: '2026-11-03' });
  assert.equal(fixedSummary([loan({ doneThrough: '2026-10' })], [moved], '2026-10').rows[0].done, true);
});

test('not shown: a month done without its entry (deleted), months before the start, and nothing at all', () => {
  assert.equal(fixedSummary([loan({ doneThrough: '2026-10' })], [], '2026-10'), null);
  assert.equal(fixedSummary([loan()], [], '2026-09'), null);
  assert.equal(fixedSummary([], [], '2026-10'), null);
});

test('a stopped fixed cost: its recorded months stay, its future months are not shown', () => {
  const stopped = loan({ hidden: true, doneThrough: '2026-10' });
  assert.equal(fixedSummary([stopped], [mark('f-1', '2026-10', 85000)], '2026-10').rows[0].done, true);
  assert.equal(fixedSummary([stopped], [], '2026-11'), null);
});

test('the planned day is the real payment day of that month', () => {
  const f = loan({ day: 31, startMonth: '2027-02', doneThrough: '2027-01' });
  assert.equal(fixedSummary([f], [], '2027-02').rows[0].day, 28);
  assert.equal(fixedSummary([f], [], '2028-02').rows[0].day, 29);
  assert.equal(fixedSummary([f], [], '2027-03').rows[0].day, 31);
});

test('a deleted fixed cost still shows the months it was paid, and nothing to come', () => {
  const gone = loan({ doneThrough: '2026-10', hidden: true, deleted: true });
  assert.deepEqual(fixedSummary([gone], [mark('f-1', '2026-10', 85000)], '2026-10').rows,
    [{ id: 'f-1', name: '住宅ローン', amount: 85000, done: true, day: null }]);
  assert.equal(fixedSummary([gone], [mark('f-1', '2026-10', 85000)], '2026-11'), null);
});
