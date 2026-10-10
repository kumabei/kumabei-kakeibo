import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_CATEGORY, hexToHsl, hslToHex, categoryColors } from '../js/stats.js';
import { COLORS } from '../js/logic.js';

const C = (id, type, name, order, color, hidden = false) => ({ id, type, name, order, color, hidden });
const categories = [
  C('e01', 'expense', '食費', 0, 'food'),
  C('e02', 'expense', '外食', 1, 'outing'),
  C('e03', 'expense', 'おやつ', 2, 'food'),
  C('e04', 'expense', '日用品', 3, 'living'),
  C('e05', 'expense', '服', 4, 'family', true),
  C('i01', 'income', '給料', 0, 'income'),
];
test('hexToHsl and hslToHex go back and forth for every strong color', () => {
  for (const { strong } of Object.values(COLORS)) assert.equal(hslToHex(hexToHsl(strong)), strong);
});

test('categoryColors: one color per category, darker first within a group, hidden ones counted', () => {
  const colors = categoryColors(categories);
  // food: 食費 (first of 2) is darker, おやつ (last) is the strong color
  assert.equal(colors.get('e03'), COLORS.food.strong);
  assert.notEqual(colors.get('e01'), COLORS.food.strong);
  assert.ok(Math.abs(hexToHsl(colors.get('e01'))[2] - (hexToHsl(COLORS.food.strong)[2] - 0.22)) < 0.01);
  // groups of one keep the strong color, the hidden 服 included
  assert.equal(colors.get('e02'), COLORS.outing.strong);
  assert.equal(colors.get('e05'), COLORS.family.strong);
  assert.equal(colors.get('i01'), COLORS.income.strong);
  assert.equal(colors.get(NO_CATEGORY), COLORS.other.strong);
});

test('categoryColors: equal steps in a big group; hiding does not move the others', () => {
  const group = [0, 1, 2, 3].map(i => C(`f${i}`, 'expense', `f${i}`, i, 'monthly', i === 1));
  const l = id => hexToHsl(categoryColors(group).get(id))[2];
  const base = hexToHsl(COLORS.monthly.strong)[2];
  assert.ok(Math.abs(l('f0') - (base - 0.22)) < 0.01);
  assert.ok(Math.abs(l('f1') - (base - 0.22 * 2 / 3)) < 0.01);
  assert.ok(Math.abs(l('f2') - (base - 0.22 / 3)) < 0.01);
  assert.equal(categoryColors(group).get('f3'), COLORS.monthly.strong);
  // an unknown color key falls back to the 'other' group
  assert.equal(categoryColors([C('z', 'expense', 'z', 0, 'nope')]).get('z'), COLORS.other.strong);
});
