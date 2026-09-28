import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SCENES, CATEGORY_IMAGES, recordReaction, homeScene, imageSrc, lineChars } from '../js/kuma.js';
import { LINES } from '../js/lines.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const exp = (categoryId, amount) => ({ type: 'expense', categoryId, amount });

test('every image the app refers to exists', () => {
  const keys = [...Object.values(SCENES).map(s => s.image), ...Object.values(CATEGORY_IMAGES).flat()];
  for (const k of keys) assert.ok(existsSync(join(ROOT, imageSrc(k))), k);
});

test('every scene has a line', () => {
  for (const [name, s] of Object.entries(SCENES)) assert.ok(typeof s.line === 'string' && s.line.length > 0, name);
});

test('10,000 yen or more: "えっ!" wins over the category image, and always talks', () => {
  assert.deepEqual(recordReaction(exp('e01', 10000), false), { image: 'k12', line: LINES.big });
  assert.deepEqual(recordReaction(exp('e01', 9999), false), { image: 'y02', line: null });
});

test('income always talks', () => {
  assert.deepEqual(recordReaction({ type: 'income', categoryId: 'c-x', amount: 50000 }, false),
    { image: 'k15', line: LINES.income });
});

test('ordinary expenses only talk on the first record of the day', () => {
  assert.deepEqual(recordReaction(exp('e01', 3280), true), { image: 'y02', line: LINES.recorded });
  assert.deepEqual(recordReaction(exp('e01', 3280), false), { image: 'y02', line: null });
});

test('categories without their own picture use "わーい"', () => {
  assert.deepEqual(recordReaction(exp('e04', 1280), false), { image: 'k09', line: null });
});

test('snacks pick ice cream or cream puff at random', () => {
  assert.equal(recordReaction(exp('e03', 498), false, () => 0).image, 'y03');
  assert.equal(recordReaction(exp('e03', 498), false, () => 0.99).image, 'y04');
});

test('home shows the month-end scene on the 1st and the last day', () => {
  assert.equal(homeScene('2026-09-01'), SCENES.monthEnd);
  assert.equal(homeScene('2026-09-30'), SCENES.monthEnd);
  assert.equal(homeScene('2026-09-15'), SCENES.home);
});

test('imageSrc', () => {
  assert.equal(imageSrc('k01'), 'img/kuma/k01.png');
});

test('lineChars includes every character of every line, no duplicates', () => {
  const chars = lineChars();
  assert.equal(new Set(chars).size, chars.length);
  for (const line of Object.values(LINES)) {
    for (const ch of line) assert.ok(chars.includes(ch), `missing: ${ch}`);
  }
});
