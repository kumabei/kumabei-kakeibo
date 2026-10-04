import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFixed, catchUpWrite, oneAtATime } from '../js/fixed.js';

const SETTINGS = { lastMethodId: 'm1', lastChangedAt: 5, schemaVersion: 2 };
const loan = (patch = {}) => ({
  ...newFixed({ name: '住宅ローン', categoryId: 'e16', amount: 85000, methodId: 'm2', day: 27 }, false, '2026-10-05', 'f-1', 1),
  ...patch,
});
const wifi = (patch = {}) => ({
  ...newFixed({ name: 'Wi-Fi', categoryId: 'e14', amount: 5500, methodId: 'm2', day: 5 }, false, '2026-10-01', 'f-2', 2),
  ...patch,
});
let n = 0;
const newId = () => `id${++n}`;
const run = (fixed, entries, today) => catchUpWrite({ fixed, entries, settings: SETTINGS }, today, 100, newId);

test('nothing before the payment day; recorded on the day itself', () => {
  const before = run([loan()], [], '2026-10-26');
  assert.deepEqual(before.put, {});
  assert.deepEqual(before.result, []);
  assert.equal(before.settings, null);

  const on = run([loan()], [], '2026-10-27');
  assert.equal(on.put.entries.length, 1);
  const e = on.put.entries[0];
  assert.deepEqual({ ...e, id: 'x' }, {
    id: 'x', type: 'expense', amount: 85000, categoryId: 'e16', methodId: 'm2', date: '2026-10-27',
    memo: '住宅ローン', createdAt: 100, updatedAt: 100, fixedId: 'f-1', fixedMonth: '2026-10',
  });
  assert.deepEqual(on.put.fixed.map(f => f.doneThrough), ['2026-10']);
  assert.deepEqual(on.result, [{ name: '住宅ローン', ym: '2026-10', entry: e }]);
  assert.equal(on.settings.lastChangedAt, 100);
  assert.equal(on.settings.lastMethodId, 'm1'); // the other settings are kept
});

test('the payment day of a shorter month is its last day', () => {
  const f = loan({ day: 31, startMonth: '2026-11', doneThrough: '2026-10' });
  assert.deepEqual(run([f], [], '2026-11-29').result, []);
  assert.equal(run([f], [], '2026-11-30').put.entries[0].date, '2026-11-30');
});

test('months left open are all recorded, oldest first, up to the last one that is due', () => {
  const w = run([loan()], [], '2027-01-26'); // Oct, Nov, Dec are due; Jan 27 is not yet
  assert.deepEqual(w.put.entries.map(e => e.fixedMonth), ['2026-10', '2026-11', '2026-12']);
  assert.deepEqual(w.put.entries.map(e => e.date), ['2026-10-27', '2026-11-27', '2026-12-27']);
  assert.equal(w.put.fixed[0].doneThrough, '2026-12');
});

test('a month that already has a marked entry is not recorded again, but counts as done', () => {
  const mark = { id: 'm', fixedId: 'f-1', fixedMonth: '2026-10' };
  const w = run([loan()], [mark], '2026-10-27');
  assert.equal(w.put.entries, undefined);
  assert.equal(w.put.fixed[0].doneThrough, '2026-10');
  assert.deepEqual(w.result, []);
  assert.equal(w.settings, null);
});

test('a month already done is never recorded again, even without its entry (it was deleted)', () => {
  assert.deepEqual(run([loan({ doneThrough: '2026-10' })], [], '2026-10-30').put, {});
});

test('stopped fixed costs are skipped', () => {
  assert.deepEqual(run([loan({ hidden: true })], [], '2026-12-30').put, {});
});

test('nothing before the start month', () => {
  assert.deepEqual(run([loan({ startMonth: '2026-11', doneThrough: '2026-10' })], [], '2026-10-30').put, {});
});

test('several fixed costs are each checked, in the settings order', () => {
  const w = run([loan(), wifi()], [], '2026-10-27');
  assert.deepEqual(w.result.map(r => r.name), ['Wi-Fi', '住宅ローン']);
  assert.equal(w.put.fixed.length, 2);
});

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

test('oneAtATime: calls made while running wait, then it runs once more', async () => {
  const gates = [deferred(), deferred()];
  let calls = 0;
  let active = 0;
  const go = oneAtATime(async () => {
    const i = calls++;
    active++;
    assert.equal(active, 1); // never two at the same time
    await gates[i].promise;
    active--;
    return [`run${i}`];
  });
  const first = go();
  const second = go();
  const third = go();
  assert.equal(calls, 1);
  gates[0].resolve();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(calls, 2); // the two waiting calls make one more run, not two
  gates[1].resolve();
  assert.deepEqual(await first, ['run0', 'run1']); // the first caller gets everything
  assert.deepEqual(await second, []);
  assert.deepEqual(await third, []);
  assert.equal(calls, 2);
});

test('oneAtATime: a later call runs again, also after an error', async () => {
  let calls = 0;
  const go = oneAtATime(async () => {
    calls++;
    if (calls === 1) throw new Error('boom');
    return ['ok'];
  });
  await assert.rejects(go(), /boom/);
  assert.deepEqual(await go(), ['ok']);
  assert.equal(calls, 2);
});
