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

// Ver.1.1.3: × and ＝ keys (る～ちゃんの要望). × is worked out before + and −, like the iPhone calculator.
test('times is appended after a number and replaces another operator', () => {
  assert.equal(applyKey('300', 'times'), '300*');
  assert.equal(applyKey('300+', 'times'), '300*');
  assert.equal(applyKey('300*', 'plus'), '300+');
  assert.equal(applyKey('', 'times'), '');
});

test('digits after times start a new number; back removes times', () => {
  assert.equal(applyKey('300*', '3'), '300*3');
  assert.equal(applyKey('300*', '0'), '300*');
  assert.equal(applyKey('300*3', '00'), '300*300');
  assert.equal(applyKey('300*', 'back'), '300');
  assert.equal(applyKey('1+99999999*99999999', '1'), '1+99999999*99999999');
});

test('amountValue works out times before plus and minus', () => {
  assert.equal(amountValue('300*3'), 900);
  assert.equal(amountValue('500+300*3'), 1400);
  assert.equal(amountValue('300*3+500'), 1400);
  assert.equal(amountValue('1000-200*3'), 400);
  assert.equal(amountValue('2*3*4-4'), 20);
  assert.equal(amountValue('300*'), 300);
  assert.equal(amountValue('100-50*3'), -50);
});

test('equals turns the expression into its result', () => {
  assert.equal(applyKey('500+300*3', 'equals'), '1400');
  assert.equal(applyKey('1200+', 'equals'), '1200');
  assert.equal(applyKey('1400', 'equals'), '1400');
  assert.equal(applyKey('', 'equals'), '');
});

test('equals keeps the expression when the result is 0 or less, or longer than 8 digits', () => {
  assert.equal(applyKey('100-300', 'equals'), '100-300');
  assert.equal(applyKey('100-100', 'equals'), '100-100');
  assert.equal(applyKey('99999999+1', 'equals'), '99999999+1');
  assert.equal(applyKey('99999998+1', 'equals'), '99999999');
});

test('hasOps and formatExpr know times', () => {
  assert.equal(hasOps('300*3'), true);
  assert.equal(formatExpr('1200+300*3'), '1,200＋300×3');
});
