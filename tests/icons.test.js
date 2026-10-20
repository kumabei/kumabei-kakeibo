import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_PATHS } from '../js/icon-paths.js';
import { DEFAULT_ICONS, PICKER_ICONS, UI_ICONS, iconOf } from '../js/icons.js';
import { initialCategories } from '../js/logic.js';

test('every initial category has a picture that is drawn', () => {
  const cats = initialCategories();
  assert.equal(cats.length, 21);
  for (const c of cats) {
    assert.ok(DEFAULT_ICONS[c.id], `no picture for ${c.id}`);
    assert.ok(ICON_PATHS[DEFAULT_ICONS[c.id]], `not drawn: ${DEFAULT_ICONS[c.id]}`);
  }
});

test('the settings offer 46 different pictures, the initial ones first', () => {
  assert.equal(PICKER_ICONS.length, 46);
  assert.equal(new Set(PICKER_ICONS).size, 46);
  assert.deepEqual(PICKER_ICONS.slice(0, 21), Object.values(DEFAULT_ICONS));
});

test('icon-paths.js holds exactly the offered and the screen pictures, as path data only', () => {
  const names = [...PICKER_ICONS, ...UI_ICONS];
  assert.deepEqual(Object.keys(ICON_PATHS).sort(), [...names].sort());
  for (const [name, markup] of Object.entries(ICON_PATHS)) {
    assert.match(markup, /^(<path [^>]*\/>)+$/, `not path data: ${name}`);
    assert.ok(!markup.includes('M0 0h24v24H0z'), `bounding box left in: ${name}`);
  }
});

test('iconOf: its own picture, then the initial one, then … for expense and cash for income', () => {
  assert.equal(iconOf({ id: 'e05', type: 'expense', icon: 'heart' }), 'heart');
  assert.equal(iconOf({ id: 'e05', type: 'expense', icon: 'no-such-picture' }), 'shirt');
  assert.equal(iconOf({ id: 'e01', type: 'expense' }), 'tools-kitchen-2');
  assert.equal(iconOf({ id: 'c-1', type: 'expense' }), 'dots');
  assert.equal(iconOf({ id: 'c-2', type: 'income' }), 'cash');
  assert.equal(iconOf(undefined), 'dots');
});
