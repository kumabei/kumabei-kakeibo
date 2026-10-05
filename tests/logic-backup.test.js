import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_ID, SCHEMA_VERSION, DAY_MS, backupFileName, buildBackup, parseBackup, shouldNudgeBackup,
  initialCategories, initialMethods, initialSettings,
} from '../js/logic.js';

const NOW = new Date(2026, 8, 28, 10, 0);
const entry = (createdAt, extra = {}) => ({
  id: 'x' + createdAt, type: 'expense', amount: 500, categoryId: 'e01', methodId: 'm1',
  date: '2026-09-01', memo: '', createdAt, updatedAt: createdAt, ...extra,
});
const daysAgo = n => NOW.getTime() - n * DAY_MS;
const data = () => ({
  entries: [entry(daysAgo(3))], categories: initialCategories(), methods: initialMethods(), fixed: [], settings: initialSettings(),
});

test('backup file name carries the date', () => {
  assert.equal(backupFileName(NOW), 'kakeibo-backup-20260928.json');
});

test('a backup round-trips and counts as unchanged after restoring', () => {
  const backup = buildBackup(data(), NOW);
  assert.equal(backup.app, APP_ID);
  assert.equal(backup.schemaVersion, SCHEMA_VERSION);
  assert.equal(backup.exportedAt, NOW.getTime());
  const r = parseBackup(JSON.stringify(backup));
  assert.equal(r.ok, true);
  assert.equal(r.entryCount, 1);
  assert.equal(r.exportedAt, NOW.getTime());
  assert.equal(r.data.categories.length, 21);
  assert.equal(r.data.settings.lastBackupAt, NOW.getTime());
  assert.equal(r.data.settings.lastChangedAt, NOW.getTime());
  assert.equal(r.data.settings.nudgeSnoozedOn, null);
});

test('broken or foreign files are rejected with a reason', () => {
  assert.deepEqual(parseBackup('{oops'), { ok: false, reason: 'ファイルが壊れています' });
  assert.deepEqual(parseBackup('null'), { ok: false, reason: 'くまべえ家計簿のバックアップではありません' });
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'other' })),
    { ok: false, reason: 'くまべえ家計簿のバックアップではありません' });
});

test('the old test page backup is a different format', () => {
  const old = { app: 'kumabei-kakeibo', version: 'test-1', exportedAt: '2026-09-27T12:00:00Z', records: [] };
  assert.deepEqual(parseBackup(JSON.stringify(old)),
    { ok: false, reason: '検証ページのバックアップなので戻せません。新しい日付のファイルを選んでね' });
});

test('missing lists or bad entries are rejected', () => {
  const noEntries = { ...buildBackup(data(), NOW), entries: undefined };
  assert.deepEqual(parseBackup(JSON.stringify(noEntries)), { ok: false, reason: '形式がちがうバックアップです' });
  const bad = buildBackup({ ...data(), entries: [entry(1, { amount: '500' })] }, NOW);
  assert.deepEqual(parseBackup(JSON.stringify(bad)), { ok: false, reason: '記録の中身がおかしいバックアップです' });
});

test('a category missing id is rejected', () => {
  const cats = initialCategories();
  cats[0] = { ...cats[0], id: undefined };
  const bad = buildBackup({ ...data(), categories: cats }, NOW);
  assert.deepEqual(parseBackup(JSON.stringify(bad)), { ok: false, reason: '形式がちがうバックアップです' });
});

test('a method with a non-string name is rejected', () => {
  const methods = initialMethods();
  methods[0] = { ...methods[0], name: 123 };
  const bad = buildBackup({ ...data(), methods }, NOW);
  assert.deepEqual(parseBackup(JSON.stringify(bad)), { ok: false, reason: '形式がちがうバックアップです' });
});

test('an entry without a numeric createdAt is rejected', () => {
  const bad = buildBackup({ ...data(), entries: [entry(3, { createdAt: '3' })] }, NOW);
  assert.deepEqual(parseBackup(JSON.stringify(bad)), { ok: false, reason: '記録の中身がおかしいバックアップです' });
});

const settings = patch => ({ ...initialSettings(), ...patch });

test('no nudge without entries', () => {
  assert.equal(shouldNudgeBackup([], settings({}), NOW), false);
});

test('never backed up: nudge 7 days after the first entry', () => {
  assert.equal(shouldNudgeBackup([entry(daysAgo(6))], settings({ lastChangedAt: daysAgo(6) }), NOW), false);
  assert.equal(shouldNudgeBackup([entry(daysAgo(7))], settings({ lastChangedAt: daysAgo(7) }), NOW), true);
});

test('backed up 8 days ago: nudge only if something changed since', () => {
  const entries = [entry(daysAgo(20))];
  // same number of entries, but an amount was edited after the backup
  assert.equal(shouldNudgeBackup(entries, settings({ lastBackupAt: daysAgo(8), lastChangedAt: daysAgo(2) }), NOW), true);
  assert.equal(shouldNudgeBackup(entries, settings({ lastBackupAt: daysAgo(8), lastChangedAt: daysAgo(9) }), NOW), false);
  assert.equal(shouldNudgeBackup(entries, settings({ lastBackupAt: daysAgo(8), lastChangedAt: daysAgo(8) }), NOW), false);
});

test('changed, but the last backup is only 6 days old', () => {
  assert.equal(shouldNudgeBackup([entry(daysAgo(20))], settings({ lastBackupAt: daysAgo(6), lastChangedAt: daysAgo(1) }), NOW), false);
});

test('"later" silences the nudge for the rest of that day', () => {
  const s = { lastBackupAt: daysAgo(8), lastChangedAt: daysAgo(1) };
  assert.equal(shouldNudgeBackup([entry(daysAgo(20))], settings({ ...s, nudgeSnoozedOn: '2026-09-28' }), NOW), false);
  assert.equal(shouldNudgeBackup([entry(daysAgo(20))], settings({ ...s, nudgeSnoozedOn: '2026-09-27' }), NOW), true);
});

test('right after restoring there is no nudge, even long after the backup', () => {
  const r = parseBackup(JSON.stringify(buildBackup(data(), new Date(daysAgo(30)))));
  assert.equal(shouldNudgeBackup(r.data.entries, r.data.settings, NOW), false);
});

const FIXED = {
  id: 'f-1', name: '住宅ローン', categoryId: 'e16', amount: 85000, methodId: 'm2', day: 27, hidden: false,
  startMonth: '2026-10', doneThrough: '2026-10', createdAt: 1,
};

test('fixed costs and the marks on entries round-trip', () => {
  const marked = entry(daysAgo(1), { fixedId: 'f-1', fixedMonth: '2026-10' });
  const r = parseBackup(JSON.stringify(buildBackup({ ...data(), entries: [marked], fixed: [FIXED] }, NOW)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.fixed, [FIXED]);
  assert.deepEqual(r.data.entries, [marked]);
});

test('a schemaVersion 1 file is accepted, with no fixed costs', () => {
  const { fixed, ...v1 } = { ...buildBackup(data(), NOW), schemaVersion: 1 };
  const r = parseBackup(JSON.stringify(v1));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.fixed, []);
});

test('other versions, and a version 2 file without fixed, are rejected', () => {
  for (const schemaVersion of [0, 3]) {
    const file = { ...buildBackup(data(), NOW), schemaVersion };
    assert.deepEqual(parseBackup(JSON.stringify(file)), { ok: false, reason: '形式がちがうバックアップです' });
  }
  const { fixed, ...noFixed } = buildBackup(data(), NOW);
  assert.deepEqual(parseBackup(JSON.stringify(noFixed)), { ok: false, reason: '形式がちがうバックアップです' });
});

test('a fixed cost in a bad shape is rejected', () => {
  const bads = [{ day: 0 }, { day: 32 }, { day: 1.5 }, { amount: 0 }, { amount: '85000' }, { startMonth: '2026-1' },
    { doneThrough: undefined }, { name: 1 }, { methodId: null }, { categoryId: undefined }, { id: 3 }];
  for (const bad of bads) {
    const file = buildBackup({ ...data(), fixed: [{ ...FIXED, ...bad }] }, NOW);
    assert.deepEqual(parseBackup(JSON.stringify(file)), { ok: false, reason: '形式がちがうバックアップです' }, JSON.stringify(bad));
  }
});

test('an entry with half a mark is rejected', () => {
  for (const half of [{ fixedId: 'f-1' }, { fixedMonth: '2026-10' }, { fixedId: 'f-1', fixedMonth: '2026-1' }]) {
    const bad = buildBackup({ ...data(), entries: [entry(3, half)] }, NOW);
    assert.deepEqual(parseBackup(JSON.stringify(bad)), { ok: false, reason: '記録の中身がおかしいバックアップです' }, JSON.stringify(half));
  }
});

test('a deleted fixed cost round-trips; a non-boolean deleted is rejected', () => {
  const gone = { ...FIXED, hidden: true, deleted: true };
  const r = parseBackup(JSON.stringify(buildBackup({ ...data(), fixed: [gone] }, NOW)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.fixed, [gone]);
  const bad = buildBackup({ ...data(), fixed: [{ ...FIXED, deleted: 'yes' }] }, NOW);
  assert.deepEqual(parseBackup(JSON.stringify(bad)), { ok: false, reason: '形式がちがうバックアップです' });
});

test('months that cannot be are rejected', () => {
  for (const bad of [{ startMonth: '2026-13' }, { startMonth: '2026-00' }, { doneThrough: '2026-13' }]) {
    const file = buildBackup({ ...data(), fixed: [{ ...FIXED, ...bad }] }, NOW);
    assert.deepEqual(parseBackup(JSON.stringify(file)), { ok: false, reason: '形式がちがうバックアップです' }, JSON.stringify(bad));
  }
  const marked = buildBackup({ ...data(), entries: [entry(3, { fixedId: 'f-1', fixedMonth: '2026-13' })] }, NOW);
  assert.deepEqual(parseBackup(JSON.stringify(marked)), { ok: false, reason: '記録の中身がおかしいバックアップです' });
});

test('dates that cannot be are rejected; real ones (Feb 29 in a leap year) pass', () => {
  for (const date of ['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '2026-10-32']) {
    const file = buildBackup({ ...data(), entries: [entry(3, { date })] }, NOW);
    assert.deepEqual(parseBackup(JSON.stringify(file)), { ok: false, reason: '記録の中身がおかしいバックアップです' }, date);
  }
  for (const date of ['2028-02-29', '2026-12-31', '2026-01-01']) {
    assert.equal(parseBackup(JSON.stringify(buildBackup({ ...data(), entries: [entry(3, { date })] }, NOW))).ok, true, date);
  }
});
