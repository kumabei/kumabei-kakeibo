import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS, SCHEMA_VERSION, initialCategories, initialMethods, initialSettings, newCategoryColor, colorOf,
  visibleSorted, allSorted, listWithCurrent, pickDefaultMethod, canHide,
} from '../js/logic.js';

const EXPECTED = [
  ['食費', 'food'], ['外食', 'outing'], ['おやつ', 'food'], ['日用品', 'living'], ['服', 'family'],
  ['子供', 'family'], ['教育費', 'family'], ['交際費', 'outing'], ['車', 'move'], ['ガソリン', 'move'],
  ['交通費', 'move'], ['イベント・レジャー', 'outing'], ['医療費', 'medical'], ['通信費', 'monthly'],
  ['光熱費', 'monthly'], ['住居費', 'monthly'], ['家具・家電', 'living'], ['お小遣い', 'family'],
  ['保険', 'monthly'], ['固定費', 'monthly'], ['雑費', 'other'],
];

test('initial expense categories: the spec order and colors, 保険 in place of the hidden 固定費', () => {
  const cats = allSorted(initialCategories());
  assert.deepEqual(cats.map(c => [c.name, c.color]), EXPECTED);
  for (const c of cats) {
    assert.equal(c.type, 'expense');
    assert.ok(COLORS[c.color], c.color);
  }
  assert.deepEqual(cats.map(c => c.order), [...Array(21).keys()]);
  assert.deepEqual(cats.filter(c => c.hidden).map(c => c.id), ['e19']);
  assert.equal(cats.find(c => c.name === '食費').id, 'e01');
  assert.equal(cats.find(c => c.name === '保険').id, 'e21');
  assert.equal(cats.find(c => c.name === '雑費').id, 'e20');
  assert.equal(new Set(cats.map(c => c.id)).size, 21);
});

test('initial methods and settings', () => {
  assert.deepEqual(initialMethods().map(m => [m.id, m.name, m.order, m.hidden]),
    [['m1', '現金', 0, false], ['m2', 'カード', 1, false], ['m3', '電子マネー', 2, false]]);
  assert.deepEqual(initialSettings(), {
    lastMethodId: 'm1', lastBackupAt: null, lastChangedAt: null, nudgeSnoozedOn: null, schemaVersion: SCHEMA_VERSION,
  });
});

test('colors of added categories and unknown colors', () => {
  assert.equal(newCategoryColor('income'), 'income');
  assert.equal(newCategoryColor('expense'), 'other');
  assert.equal(colorOf({ color: 'food' }), COLORS.food);
  assert.equal(colorOf({ color: 'nope' }), COLORS.other);
  assert.equal(colorOf(undefined), COLORS.other);
});

const M = (id, order, hidden = false) => ({ id, name: id, order, hidden });

test('visibleSorted drops hidden items and sorts by order; allSorted keeps them', () => {
  const list = [M('b', 1), M('a', 0), M('c', 2, true)];
  assert.deepEqual(visibleSorted(list).map(x => x.id), ['a', 'b']);
  assert.deepEqual(allSorted(list).map(x => x.id), ['a', 'b', 'c']);
});

test('listWithCurrent keeps a hidden current item so old entries can still be edited', () => {
  const list = [M('a', 0), M('b', 1, true)];
  assert.deepEqual(listWithCurrent(list, 'b').map(x => x.id), ['a', 'b']);
  assert.deepEqual(listWithCurrent(list, 'a').map(x => x.id), ['a']);
  assert.deepEqual(listWithCurrent(list, null).map(x => x.id), ['a']);
});

test('pickDefaultMethod prefers the last used visible method', () => {
  const methods = [M('m1', 0), M('m2', 1), M('m3', 2, true)];
  assert.equal(pickDefaultMethod(methods, 'm2'), 'm2');
  assert.equal(pickDefaultMethod(methods, 'm3'), 'm1');
  assert.equal(pickDefaultMethod(methods, 'zzz'), 'm1');
  assert.equal(pickDefaultMethod([M('m1', 0, true)], 'm1'), null);
});

test('canHide refuses to hide the last visible item', () => {
  assert.equal(canHide([M('m1', 0), M('m2', 1)], 'm1'), true);
  assert.equal(canHide([M('m1', 0), M('m2', 1, true)], 'm1'), false);
});
