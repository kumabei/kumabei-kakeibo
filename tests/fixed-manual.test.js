import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFixed, manualCheck, fixedEntryWrite, deleteConfirmText } from '../js/fixed.js';

const loan = (patch = {}) => ({
  ...newFixed({ name: '住宅ローン', categoryId: 'e16', amount: 85000, methodId: 'm2', day: 27 }, false, '2026-10-05', 'f-1', 1),
  ...patch,
});
const draft = (patch = {}) => ({ type: 'expense', amount: 85000, categoryId: 'e16', methodId: 'm1', date: '2026-10-25', memo: '', ...patch });
const SETTINGS = { lastMethodId: 'm2', lastChangedAt: 5, schemaVersion: 2 };

test('no question unless an expense with the same category and amount as a running fixed cost', () => {
  assert.equal(manualCheck([loan()], [], draft({ type: 'income' })), null);
  assert.equal(manualCheck([loan()], [], draft({ amount: 85001 })), null);
  assert.equal(manualCheck([loan()], [], draft({ categoryId: 'e15' })), null);
  assert.equal(manualCheck([loan({ hidden: true })], [], draft()), null);
  assert.equal(manualCheck([], [], draft()), null);
});

test('the day is not looked at, but the month must not be before the start month', () => {
  assert.equal(manualCheck([loan()], [], draft({ date: '2026-10-01' })).kind, 'new');
  assert.equal(manualCheck([loan()], [], draft({ date: '2026-09-27' })), null);
});

test('the three states of the month', () => {
  assert.deepEqual(manualCheck([loan()], [], draft()), { kind: 'new', fixed: loan(), ym: '2026-10' });
  const mark = { id: 'a', fixedId: 'f-1', fixedMonth: '2026-10' };
  assert.equal(manualCheck([loan({ doneThrough: '2026-10' })], [mark], draft()).kind, 'recorded');
  assert.equal(manualCheck([loan({ doneThrough: '2026-10' })], [], draft()).kind, 'deleted');
  // entered early as the fixed cost: the month is not processed yet, but its entry is there
  assert.equal(manualCheck([loan()], [mark], draft()).kind, 'recorded');
});

test('with several matches, the first in the settings order wins', () => {
  const a = loan({ id: 'f-a', day: 27 });
  const b = loan({ id: 'f-b', day: 3 });
  assert.equal(manualCheck([a, b], [], draft()).fixed.id, 'f-b');
});

let n = 0;
const newId = () => `id${++n}`;
const write = (fixed, entries, d) => fixedEntryWrite({ fixed, entries, settings: SETTINGS }, d, 'f-1', 200, newId);

test('a month not processed yet: the entry as typed, marked, and the month counts as done', () => {
  const w = write([loan()], [], draft());
  const e = w.put.entries[0];
  assert.deepEqual({ ...e, id: 'x' }, {
    id: 'x', type: 'expense', amount: 85000, categoryId: 'e16', methodId: 'm1', date: '2026-10-25', memo: '',
    createdAt: 200, updatedAt: 200, fixedId: 'f-1', fixedMonth: '2026-10',
  });
  assert.equal(w.put.fixed[0].doneThrough, '2026-10');
  assert.equal(w.result, e);
  assert.equal(w.settings.lastMethodId, 'm1');
  assert.equal(w.settings.lastChangedAt, 200);
});

test('putting a deleted month back: marked, doneThrough unchanged', () => {
  const w = write([loan({ doneThrough: '2026-10' })], [], draft());
  assert.equal(w.put.entries[0].fixedMonth, '2026-10');
  assert.equal(w.put.fixed, undefined);
});

test('a month further ahead than the next one is marked but does not move doneThrough', () => {
  const w = write([loan()], [], draft({ date: '2026-11-03' }));
  assert.equal(w.put.entries[0].fixedMonth, '2026-11');
  assert.equal(w.put.fixed, undefined);
});

test('if the month got its marked entry meanwhile, the new one is recorded without a mark', () => {
  const mark = { id: 'a', fixedId: 'f-1', fixedMonth: '2026-10' };
  const w = write([loan({ doneThrough: '2026-10' })], [mark], draft());
  assert.equal(w.put.entries[0].fixedId, undefined);
  assert.equal(w.put.entries[0].fixedMonth, undefined);
  assert.equal(w.put.fixed, undefined);
});

test('the confirmation when deleting an entry of a fixed cost', () => {
  const entry = { id: 'a', memo: '住宅ローン', fixedId: 'f-1', fixedMonth: '2026-10' };
  assert.equal(deleteConfirmText(entry, [loan({ name: 'ローン' })]),
    '毎月の固定費（ローン）の10月分です。消すと、この月はもう自動では入りません。消しますか？');
  assert.equal(deleteConfirmText(entry, []),
    '毎月の固定費（住宅ローン）の10月分です。消すと、この月はもう自動では入りません。消しますか？');
});
