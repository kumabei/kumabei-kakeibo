import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameParts, amountWarning, belowZeroOnEquals } from '../js/screens/entry-parts.js';
import { LINES } from '../js/lines.js';

test('nameParts: a long name breaks only after its ・', () => {
  assert.deepEqual(nameParts('イベント・レジャー'), ['イベント・', 'レジャー']);
  assert.deepEqual(nameParts('家具・家電'), ['家具・', '家電']);
  assert.deepEqual(nameParts('食費'), ['食費']);
});

test('amountWarning: what the amount box says instead of saving (spec 5-4)', () => {
  assert.equal(amountWarning('1200'), null);
  assert.equal(amountWarning('500-'), null); // a trailing sign is ignored
  assert.equal(amountWarning(''), LINES.missingAmount);
  assert.equal(amountWarning('500-500'), LINES.belowZero);
  assert.equal(amountWarning('500-600'), LINES.belowZero);
});

test('belowZeroOnEquals: only ＝ on an expression of 0 yen or less', () => {
  assert.equal(belowZeroOnEquals('equals', '500-600'), true);
  assert.equal(belowZeroOnEquals('equals', '500-500'), true);
  assert.equal(belowZeroOnEquals('equals', '500+1'), false);
  assert.equal(belowZeroOnEquals('equals', '500'), false);
  assert.equal(belowZeroOnEquals('3', '500-600'), false);
});
