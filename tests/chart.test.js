import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pieSlices, textWidth, arcLength, showLabel, labelPoint, polar, segmentPath, centerFontSize, labelColor,
  barHeights, labelClear, R_MID, BAR_AREA, MIN_BAR, TEXT_DARK, TEXT_LIGHT, SIZE,
} from '../js/chart.js';
import { categoryColors, hslToHex, hexToHsl } from '../js/stats.js';
import { COLORS } from '../js/logic.js';

const row = (name, amount, total) => ({ categoryId: name, name, amount, share: amount / total });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('pieSlices: clockwise from 12 o\'clock, ending exactly at 360', () => {
  const s = pieSlices([row('a', 500, 1000), row('b', 300, 1000), row('c', 200, 1000)]);
  assert.deepEqual(s.map(x => [x.start, x.end]), [[0, 180], [180, 288], [288, 360]]);
  const odd = pieSlices([row('a', 1, 3), row('b', 1, 3), row('c', 1, 3)]);
  assert.equal(odd.at(-1).end, 360);
  close(odd.reduce((sum, x) => sum + (x.end - x.start), 0), 360);
});

test('pieSlices: one category is the whole ring', () => {
  assert.deepEqual(pieSlices([row('a', 700, 700)]).map(x => [x.start, x.end]), [[0, 360]]);
});

test('textWidth: full-width 1, half-width 0.6 of the font size', () => {
  assert.equal(textWidth('食費', 12), 24);
  assert.equal(textWidth('Wi-Fi', 10), 30);
  assert.equal(textWidth('家具・家電', 12), 60);
});

test('showLabel: 8% or more of the raw share, and the name has to fit the arc', () => {
  const at = (name, share) => ({ name, share, start: 0, end: share * 360 });
  assert.equal(showLabel(at('食費', 0.08)), true); // 28.8° → arc ≈ 41.5 ≥ 24
  assert.equal(showLabel(at('食費', 0.0799)), false); // shows as 「8%」 but is under 8%
  assert.equal(showLabel(at('お小遣い', 0.08)), false); // 48 does not fit 41.5
  assert.equal(showLabel(at('お小遣い', 0.1)), true); // 36° → arc ≈ 51.8
  assert.equal(showLabel(at('イベント・レジャー', 1)), true); // a full ring
  close(arcLength({ start: 0, end: 180 }), Math.PI * R_MID);
});

test('labelPoint: the middle of the slice, 12 o\'clock for a full ring', () => {
  const [x, y] = labelPoint({ start: 0, end: 360 }, true);
  close(x, SIZE / 2);
  close(y, SIZE / 2 - R_MID);
  const [x2, y2] = labelPoint({ start: 0, end: 180 }, false); // 90° = 3 o'clock
  close(x2, SIZE / 2 + R_MID);
  close(y2, SIZE / 2);
});

test('polar and segmentPath: a half ring uses the small-arc flag, more than half the large one', () => {
  const [x, y] = polar(180, 10);
  close(x, SIZE / 2);
  close(y, SIZE / 2 + 10);
  assert.match(segmentPath(0, 180), /A104 104 0 0 1 /);
  assert.match(segmentPath(0, 200), /A104 104 0 1 1 /);
  assert.match(segmentPath(0, 200), /A62 62 0 1 0 /);
});

test('centerFontSize: smaller for more digits', () => {
  assert.equal(centerFontSize('0円'), 24);
  assert.equal(centerFontSize('32,180円'), 24);
  assert.equal(centerFontSize('123,456円'), 20);
  assert.equal(centerFontSize('1,234,567円'), 16);
  assert.equal(centerFontSize('99,999,999,999円'), 13); // never smaller than the last size
});

test('labelColor: dark text on light slices, white on dark ones', () => {
  for (const { strong } of Object.values(COLORS)) assert.equal(labelColor(strong), TEXT_DARK);
  assert.equal(labelColor('#ffffff'), TEXT_DARK);
  assert.equal(labelColor('#000000'), TEXT_LIGHT);
  assert.equal(labelColor('#4a3a3a'), TEXT_LIGHT);
  const darkest = hslToHex([...hexToHsl(COLORS.monthly.strong).slice(0, 2), 0.3]);
  assert.equal(labelColor(darkest), TEXT_LIGHT);
});

test('labelColor: every chart color of the initial categories is readable with one of the two', () => {
  const groups = Object.keys(COLORS);
  const cats = groups.flatMap((g, gi) => [0, 1, 2, 3, 4].map(i => ({ id: `${g}${i}`, order: gi * 10 + i, color: g })));
  for (const color of categoryColors(cats).values()) assert.ok([TEXT_DARK, TEXT_LIGHT].includes(labelColor(color)));
});

test('barHeights: the largest month fills the area, 0 has no bar, tiny ones stay visible', () => {
  assert.deepEqual(barHeights([0, 50, 100, 0, 0, 0, 0, 0, 0, 0, 0, 25]), [0, BAR_AREA / 2, BAR_AREA, 0, 0, 0, 0, 0, 0, 0, 0, BAR_AREA / 4]);
  assert.deepEqual(barHeights(Array(12).fill(0)), Array(12).fill(0));
  const tall = barHeights([1000000, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(tall[0], BAR_AREA);
  assert.equal(tall[1], MIN_BAR);
  assert.equal(tall[2], 0);
});

test('labelClear: the straight label box stays inside the SVG and off the center total (F1)', () => {
  const at = (name, share, start = 0) => ({ name, share, start, end: start + share * 360 });
  const total = '234,200円';
  // 50% from 12 o'clock: slice centre 90° = 3 o'clock, where the box runs along the ring's thickness
  assert.equal(labelClear(at('イベント・レジャー', 0.5), false, total), false); // clips right, hits the total
  assert.equal(labelClear(at('お小遣い', 0.5), false, total), true);
  assert.equal(labelClear(at('ガソリン', 0.5), false, total), true);
  assert.equal(labelClear(at('家具・家電', 0.5), false, total), false); // 60 wide: right edge 223 > 220, clipped 3px
  assert.equal(labelClear(at('（分類なし）', 0.4, 0), false, total), false); // centre 72°, clips ~5px
  assert.equal(labelClear(at('イベント・レジャー', 0.5, 180), false, total), false); // 9 o'clock side
  assert.equal(labelClear(at('イベント・レジャー', 0.1), false, total), true); // centre 18°, near 12 o'clock
  assert.equal(labelClear(at('イベント・レジャー', 1), true, total), true); // full ring: 12 o'clock
});
