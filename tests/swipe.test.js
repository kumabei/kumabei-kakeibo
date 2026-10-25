import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELETE_W, swipeAxis, swipeOffset, swipeOpens } from '../js/swipe.js';

test('swipeAxis: undecided until the finger moves, then the larger direction', () => {
  assert.equal(swipeAxis(3, 4), null);
  assert.equal(swipeAxis(-12, 4), 'x');
  assert.equal(swipeAxis(5, -14), 'y');
  assert.equal(swipeAxis(-10, 10), 'y'); // a diagonal start is left to the page scroll
});

test('swipeOffset: follows the finger to the left only, a little past the button at most', () => {
  assert.equal(swipeOffset(30, false), 0);
  assert.equal(swipeOffset(-40, false), -40);
  assert.equal(swipeOffset(-500, false), -DELETE_W - 24);
  assert.equal(swipeOffset(30, true), -DELETE_W + 30);
  assert.equal(swipeOffset(200, true), 0);
});

test('swipeOpens: open when let go past half the button', () => {
  assert.equal(swipeOpens(-DELETE_W / 2 - 1, false), true);
  assert.equal(swipeOpens(-DELETE_W / 2 + 1, false), false);
  assert.equal(swipeOpens(-10, true), true);
  assert.equal(swipeOpens(DELETE_W / 2 + 1, true), false);
});
