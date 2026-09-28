import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDateStr, todayStr, addDays, monthOf, addMonths, daysInMonth, isMonthEdge, calendarCells,
  formatMonthLabel, formatDateLabel, formatDateShort, formatDateTime, formatNumber, formatYen, memoHead,
} from '../js/logic.js';

test('toDateStr uses local time and zero-pads', () => {
  assert.equal(toDateStr(new Date(2026, 0, 5)), '2026-01-05');
});

test('todayStr formats the given time', () => {
  assert.equal(todayStr(new Date(2026, 8, 28, 23, 59)), '2026-09-28');
});

test('addDays crosses months and years', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('addDays handles leap years', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
});

test('monthOf and addMonths', () => {
  assert.equal(monthOf('2026-09-28'), '2026-09');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
});

test('daysInMonth knows leap years', () => {
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2026-09'), 30);
});

test('isMonthEdge is true on the 1st and the last day only', () => {
  assert.equal(isMonthEdge('2026-09-01'), true);
  assert.equal(isMonthEdge('2026-09-30'), true);
  assert.equal(isMonthEdge('2026-09-29'), false);
  assert.equal(isMonthEdge('2028-02-29'), true);
  assert.equal(isMonthEdge('2028-02-28'), false);
});

test('calendarCells starts on Sunday and pads to whole weeks', () => {
  const cells = calendarCells('2026-09'); // 2026-09-01 is a Tuesday
  assert.equal(cells.length % 7, 0);
  assert.deepEqual(cells.slice(0, 3), [null, null, '2026-09-01']);
  const days = cells.filter(Boolean);
  assert.equal(days.length, 30);
  assert.equal(days.at(-1), '2026-09-30');
});

test('date labels', () => {
  assert.equal(formatMonthLabel('2026-09'), '2026年9月');
  assert.equal(formatDateLabel('2026-09-28'), '9月28日(月)');
  assert.equal(formatDateShort('2026-09-28'), '9/28(月)');
  assert.equal(formatDateTime(new Date(2026, 8, 28, 9, 5).getTime()), '9月28日(月) 9:05');
});

test('numbers and yen get thousands separators', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(8420), '8,420');
  assert.equal(formatNumber(1234567), '1,234,567');
  assert.equal(formatYen(3280), '3,280円');
  assert.equal(formatYen(-1000), '-1,000円');
});

test('memoHead shortens long memos', () => {
  assert.equal(memoHead('牛乳'), '牛乳');
  assert.equal(memoHead('あいうえおかきくけこさしすせそ'), 'あいうえおかきくけこさし…');
});
