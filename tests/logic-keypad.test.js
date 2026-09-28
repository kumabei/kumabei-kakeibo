import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyKey, amountValue } from '../js/logic.js';

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
