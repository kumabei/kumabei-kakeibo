// Spec 10: operations done one after another. The point is that doneThrough and the marked entries never
// drift apart when someone deletes, re-enters, stops, resumes or restores in between.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newFixed, resumedFixed, catchUpWrite, fixedEntryWrite, manualCheck, fixedSummary, deleteConfirmText, oneAtATime,
} from '../js/fixed.js';
import { buildBackup, parseBackup, initialCategories, initialMethods, initialSettings } from '../js/logic.js';

// A stand-in for db.update(): like IndexedDB readwrite transactions on the same stores, updates run one
// after another, decide() sees the data as it is when its turn comes, and its writes land together.
function memoryDb(fixed) {
  const data = { fixed: structuredClone(fixed), entries: [], settings: initialSettings() };
  const putAll = (name, items) => {
    for (const x of items) {
      const i = data[name].findIndex(y => y.id === x.id);
      if (i < 0) data[name].push(x);
      else data[name][i] = x;
    }
  };
  let queue = Promise.resolve();
  const update = decide => {
    const done = queue.then(() => {
      const w = decide(structuredClone(data));
      for (const [name, items] of Object.entries(w.put ?? {})) putAll(name, items);
      if (w.settings) data.settings = w.settings;
      return w.result;
    });
    queue = done.catch(() => {});
    return done;
  };
  return { data, update, putAll };
}

let n = 0;
const newId = () => `e${++n}`;
const LOAN = newFixed({ name: '住宅ローン', categoryId: 'e16', amount: 85000, methodId: 'm2', day: 27 }, false, '2026-10-05', 'f-1', 1);
const DRAFT = { type: 'expense', amount: 85000, categoryId: 'e16', methodId: 'm2', memo: '' };

const catchUp = (db, today) => db.update(s => catchUpWrite(s, today, 100, newId));
const recordAsFixed = (db, date) => db.update(s => fixedEntryWrite(s, { ...DRAFT, date }, 'f-1', 200, newId));
const remove = (db, id) => { db.data.entries = db.data.entries.filter(e => e.id !== id); };
const loan = db => db.data.fixed.find(f => f.id === 'f-1');
const marks = (db, ym) => db.data.entries.filter(e => e.fixedId === 'f-1' && e.fixedMonth === ym);
const doneRows = (db, ym) => fixedSummary(db.data.fixed, db.data.entries, ym)?.rows.map(r => r.done);

test('1: recorded → deleted → typed in as the fixed cost: marked, doneThrough unchanged, no double, ✓ on home', async () => {
  const db = memoryDb([LOAN]);
  const [auto] = await catchUp(db, '2026-10-27');
  remove(db, auto.entry.id);
  assert.equal(manualCheck(db.data.fixed, db.data.entries, { ...DRAFT, date: '2026-10-28' }).kind, 'deleted');
  const back = await recordAsFixed(db, '2026-10-28');
  assert.equal(back.fixedMonth, '2026-10');
  assert.equal(loan(db).doneThrough, '2026-10');
  assert.deepEqual(await catchUp(db, '2026-10-29'), []);
  assert.equal(db.data.entries.length, 1);
  assert.deepEqual(doneRows(db, '2026-10'), [true]);
});

test('2: recorded → deleted → the app is opened again: not made again', async () => {
  const db = memoryDb([LOAN]);
  const [auto] = await catchUp(db, '2026-10-27');
  remove(db, auto.entry.id);
  assert.deepEqual(await catchUp(db, '2026-10-27'), []);
  assert.deepEqual(await catchUp(db, '2026-10-31'), []);
  assert.equal(db.data.entries.length, 0);
  assert.equal(doneRows(db, '2026-10'), undefined);
  assert.deepEqual((await catchUp(db, '2026-11-27')).map(r => r.ym), ['2026-11']); // the next month as usual
});

test('3: typed in as the fixed cost before the day → the day comes: not recorded automatically', async () => {
  const db = memoryDb([LOAN]);
  assert.equal(manualCheck(db.data.fixed, db.data.entries, { ...DRAFT, date: '2026-10-20' }).kind, 'new');
  await recordAsFixed(db, '2026-10-20');
  assert.equal(loan(db).doneThrough, '2026-10');
  assert.deepEqual(await catchUp(db, '2026-10-27'), []);
  assert.equal(marks(db, '2026-10').length, 1);
  assert.equal(db.data.entries.length, 1);
});

test('4: three months not opened → all recorded → only the middle one deleted', async () => {
  const db = memoryDb([LOAN]);
  const recorded = await catchUp(db, '2026-12-27');
  assert.deepEqual(recorded.map(r => r.ym), ['2026-10', '2026-11', '2026-12']);
  remove(db, recorded[1].entry.id);
  assert.deepEqual(await catchUp(db, '2026-12-28'), []);
  assert.deepEqual(doneRows(db, '2026-10'), [true]);
  assert.equal(doneRows(db, '2026-11'), undefined);
  assert.deepEqual(doneRows(db, '2026-12'), [true]);
});

test('5: stopped → resumed two months later: the stopped months are not recorded', async () => {
  for (const [already, expected] of [[false, ['2026-12']], [true, []]]) {
    const db = memoryDb([LOAN]);
    await catchUp(db, '2026-10-27');
    db.putAll('fixed', [{ ...loan(db), hidden: true }]);
    assert.deepEqual(await catchUp(db, '2026-11-30'), []);
    db.putAll('fixed', [resumedFixed(loan(db), already, '2026-12-28')]);
    assert.deepEqual((await catchUp(db, '2026-12-28')).map(r => r.ym), expected, `already: ${already}`);
    assert.equal(marks(db, '2026-11').length, 0);
    assert.equal(doneRows(db, '2026-11'), undefined);
  }
});

test('6: the entry put back is deleted again: the strong confirmation, and it can be put back again', async () => {
  const db = memoryDb([LOAN]);
  const [auto] = await catchUp(db, '2026-10-27');
  remove(db, auto.entry.id);
  const back = await recordAsFixed(db, '2026-10-28');
  assert.equal(deleteConfirmText(back, db.data.fixed),
    '毎月の固定費（住宅ローン）の10月分です。消すと、この月はもう自動では入りません。消しますか？');
  remove(db, back.id);
  assert.equal(manualCheck(db.data.fixed, db.data.entries, { ...DRAFT, date: '2026-10-29' }).kind, 'deleted');
  await recordAsFixed(db, '2026-10-29');
  assert.equal(marks(db, '2026-10').length, 1);
  assert.equal(loan(db).doneThrough, '2026-10');
});

test('7: the date of a fixed-cost entry moved to another month: ✓ stays in its own month', async () => {
  const db = memoryDb([LOAN]);
  const [auto] = await catchUp(db, '2026-10-27');
  db.putAll('entries', [{ ...auto.entry, date: '2026-11-03' }]); // what the editor does: the mark is kept
  assert.deepEqual(doneRows(db, '2026-10'), [true]);
  assert.deepEqual(fixedSummary(db.data.fixed, db.data.entries, '2026-11').rows.map(r => [r.done, r.day]), [[false, 27]]);
  assert.deepEqual((await catchUp(db, '2026-11-27')).map(r => r.ym), ['2026-11']);
});

test('8: export a backup → change things → restore: the entries and doneThrough are back as they were', async () => {
  const db = memoryDb([LOAN]);
  await catchUp(db, '2026-10-27');
  const file = JSON.stringify(buildBackup(
    { ...db.data, categories: initialCategories(), methods: initialMethods() }, new Date(2026, 9, 27)));
  const saved = structuredClone({ entries: db.data.entries, fixed: db.data.fixed });
  remove(db, db.data.entries[0].id);
  await catchUp(db, '2026-11-27');
  db.putAll('fixed', [{ ...loan(db), hidden: true }]);
  const r = parseBackup(file);
  assert.equal(r.ok, true);
  assert.deepEqual({ entries: r.data.entries, fixed: r.data.fixed }, saved);
});

test('9: catching up twice at the same time records once', async () => {
  const db = memoryDb([LOAN]);
  const [a, b] = await Promise.all([catchUp(db, '2026-10-27'), catchUp(db, '2026-10-27')]);
  assert.equal(a.length + b.length, 1);
  assert.equal(db.data.entries.length, 1);

  const db2 = memoryDb([LOAN]);
  const go = oneAtATime(() => catchUp(db2, '2026-10-27'));
  const [first, second] = await Promise.all([go(), go()]);
  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
  assert.equal(db2.data.entries.length, 1);
});
