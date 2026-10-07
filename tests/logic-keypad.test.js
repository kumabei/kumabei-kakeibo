import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyKey, amountValue, hasOps, formatExpr } from '../js/logic.js';

test('digits are appended', () => {
  assert.equal(applyKey('', '3'), '3');
  assert.equal(applyKey('3', '2'), '32');
  assert.equal(applyKey('5', '00'), '500');
});

test('leading zeros are never kept', () => {
  assert.equal(applyKey('', '0'), '');
  assert.equal(applyKey('', '00'), '');
});

test('back removes one digit, clear removes all', () => {
  assert.equal(applyKey('328', 'back'), '32');
  assert.equal(applyKey('', 'back'), '');
  assert.equal(applyKey('3280', 'clear'), '');
});

test('amounts stop at 8 digits', () => {
  assert.equal(applyKey('99999999', '1'), '99999999');
  assert.equal(applyKey('9999999', '00'), '9999999');
  assert.equal(applyKey('9999999', '1'), '99999991');
});

test('unknown keys change nothing', () => {
  assert.equal(applyKey('12', '+'), '12');
});

test('amountValue', () => {
  assert.equal(amountValue(''), 0);
  assert.equal(amountValue('3280'), 3280);
});

// Ver.1.1.2: + and - keys (る～ちゃんの要望: add to an amount later, like a calculator).
test('plus and minus are appended after a number', () => {
  assert.equal(applyKey('1200', 'plus'), '1200+');
  assert.equal(applyKey('1200', 'minus'), '1200-');
  assert.equal(applyKey('1200+300', 'minus'), '1200+300-');
});

test('an operator right after an operator replaces it', () => {
  assert.equal(applyKey('1200+', 'minus'), '1200-');
  assert.equal(applyKey('1200-', 'plus'), '1200+');
  assert.equal(applyKey('1200+', 'plus'), '1200+');
});

test('operators do nothing on an empty amount', () => {
  assert.equal(applyKey('', 'plus'), '');
  assert.equal(applyKey('', 'minus'), '');
});

test('digits after an operator start a new number', () => {
  assert.equal(applyKey('1200+', '3'), '1200+3');
  assert.equal(applyKey('1200+', '0'), '1200+');
  assert.equal(applyKey('1200+', '00'), '1200+');
  assert.equal(applyKey('1200+3', '00'), '1200+300');
});

test('back removes an operator too, clear removes the whole expression', () => {
  assert.equal(applyKey('1200+', 'back'), '1200');
  assert.equal(applyKey('1200+3', 'back'), '1200+');
  assert.equal(applyKey('1200+300', 'clear'), '');
});

test('each number stops at 8 digits', () => {
  assert.equal(applyKey('1+99999999', '1'), '1+99999999');
  assert.equal(applyKey('99999999', 'plus'), '99999999+');
  assert.equal(applyKey('99999999+9999999', '1'), '99999999+99999991');
});

test('the whole expression stops at 20 characters', () => {
  const full = '1234+5678+9012+34567'; // 20
  assert.equal(applyKey(full, 'plus'), full);
  assert.equal(applyKey('1234+5678+9012+3456', '7'), full);
  assert.equal(applyKey('1234+5678+9012+345+', '1'), '1234+5678+9012+345+1');
  assert.equal(applyKey('1234+5678+9012+345+1', 'minus'), '1234+5678+9012+345+1');
});

test('amountValue adds and subtracts, ignoring a trailing operator', () => {
  assert.equal(amountValue('1200+300'), 1500);
  assert.equal(amountValue('1200+300-50'), 1450);
  assert.equal(amountValue('1200+'), 1200);
  assert.equal(amountValue('1200-'), 1200);
  assert.equal(amountValue('100-300'), -200);
  assert.equal(amountValue('100-100'), 0);
});

test('hasOps', () => {
  assert.equal(hasOps(''), false);
  assert.equal(hasOps('1200'), false);
  assert.equal(hasOps('1200+'), true);
  assert.equal(hasOps('1200-300'), true);
});

test('formatExpr puts commas in each number and shows full-width operators', () => {
  assert.equal(formatExpr('1200+300'), '1,200＋300');
  assert.equal(formatExpr('12000-1500+'), '12,000−1,500＋');
  assert.equal(formatExpr('3280'), '3,280');
});
