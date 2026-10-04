import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, withInsurance, migrateData, initialMethods, allSorted } from '../js/logic.js';

// The categories of 1.0.x: 20 expense categories with 固定費 (e19) shown, and one income category.
const OLD_NAMES = ['食費', '外食', 'おやつ', '日用品', '服', '子供', '教育費', '交際費', '車', 'ガソリン', '交通費',
  'イベント・レジャー', '医療費', '通信費', '光熱費', '住居費', '家具・家電', 'お小遣い', '固定費', '雑費'];
const oldCategories = () => [
  ...OLD_NAMES.map((name, i) => ({ id: `e${String(i + 1).padStart(2, '0')}`, type: 'expense', name, order: i, hidden: false, color: 'monthly' })),
  { id: 'c-in', type: 'income', name: '給料', order: 0, hidden: false, color: 'income' },
];
const oldData = (settings = {}) => ({
  entries: [], categories: oldCategories(), methods: initialMethods(),
  settings: { lastMethodId: 'm1', lastBackupAt: null, lastChangedAt: 7, nudgeSnoozedOn: null, schemaVersion: 1, ...settings },
});

test('withInsurance hides 固定費 and puts 保険 where it was', () => {
  const cats = withInsurance(oldCategories());
  const expense = allSorted(cats.filter(c => c.type === 'expense'));
  assert.deepEqual(expense.map(c => c.name).slice(17), ['お小遣い', '保険', '固定費', '雑費']);
  assert.deepEqual(expense.map(c => c.order), [...Array(21).keys()]);
  assert.equal(expense.find(c => c.name === '固定費').hidden, true);
  assert.deepEqual(expense.find(c => c.name === '保険'),
    { id: 'e21', type: 'expense', name: '保険', order: 18, hidden: false, color: 'monthly' });
  assert.deepEqual(cats.find(c => c.type === 'income'), oldCategories().at(-1)); // income untouched
});

test('withInsurance: an existing 保険 is not added twice and nothing moves', () => {
  const mine = [...oldCategories(), { id: 'c-1', type: 'expense', name: '保険', order: 20, hidden: false, color: 'other' }];
  const cats = withInsurance(mine);
  assert.equal(cats.filter(c => c.name === '保険').length, 1);
  assert.equal(cats.find(c => c.id === 'e19').hidden, true);
  assert.equal(cats.find(c => c.id === 'e20').order, 19);
});

test('migrateData: schemaVersion 1 becomes 2, lastChangedAt is kept', () => {
  assert.equal(SCHEMA_VERSION, 2);
  const next = migrateData(oldData());
  assert.equal(next.settings.schemaVersion, 2);
  assert.equal(next.settings.lastChangedAt, 7);
  assert.ok(next.categories.some(c => c.name === '保険'));
  assert.deepEqual(next.fixed, []);
});

test('migrateData leaves version 2 data alone, so a 固定費 shown again stays shown', () => {
  const shownAgain = { ...oldData({ schemaVersion: 2 }), fixed: [] };
  assert.equal(migrateData(shownAgain), shownAgain);
});

test('settings without schemaVersion count as version 1', () => {
  const { schemaVersion, ...settings } = oldData().settings;
  assert.equal(migrateData({ ...oldData(), settings }).settings.schemaVersion, 2);
});
