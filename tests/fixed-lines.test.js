import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, autoRecordLine, askStartedLine, manualCheckLine } from '../js/fixed.js';

const rec = (name, ym) => ({ name, ym, entry: {} });

test('fill puts the values into the marks', () => {
  assert.equal(fill('{a}と{b}', { a: 'X', b: 2 }), 'Xと2');
});

test('one or two recorded for this month: their names, with 今月の', () => {
  assert.equal(autoRecordLine([rec('住宅ローン', '2026-10')], '2026-10'), '今月の住宅ローン、自動で記録しておいたよ～！');
  assert.equal(autoRecordLine([rec('住宅ローン', '2026-10'), rec('Wi-Fi', '2026-10')], '2026-10'),
    '今月の住宅ローンとWi-Fi、自動で記録しておいたよ～！');
});

test('three or more: the first name and the count', () => {
  const three = [rec('住宅ローン', '2026-10'), rec('Wi-Fi', '2026-10'), rec('保険', '2026-10')];
  assert.equal(autoRecordLine(three, '2026-10'), '住宅ローンなど3件、自動で記録しておいたよ～！');
});

test('several months gathered: no 今月の; the same name twice counts as several', () => {
  assert.equal(autoRecordLine([rec('住宅ローン', '2026-09'), rec('Wi-Fi', '2026-10')], '2026-10'),
    '住宅ローンとWi-Fi、自動で記録しておいたよ～！');
  assert.equal(autoRecordLine([rec('住宅ローン', '2026-09'), rec('住宅ローン', '2026-10')], '2026-10'),
    '住宅ローンなど2件、自動で記録しておいたよ～！');
});

test('askStartedLine shows this month\'s payment day', () => {
  assert.equal(askStartedLine(27, '2026-10-05'), '今月分（10月27日）はもう入れた？');
  assert.equal(askStartedLine(31, '2026-11-05'), '今月分（11月30日）はもう入れた？');
});

test('manualCheckLine for the three states', () => {
  const fixed = { name: '住宅ローン' };
  assert.equal(manualCheckLine({ kind: 'new', fixed, ym: '2026-10' }, '2026-10'), 'これ、毎月の固定費（住宅ローン）にあるけど？');
  assert.equal(manualCheckLine({ kind: 'recorded', fixed, ym: '2026-10' }, '2026-10'),
    '今月の住宅ローンはもう記録してあるよ。それでも入れる？');
  assert.equal(manualCheckLine({ kind: 'recorded', fixed, ym: '2026-09' }, '2026-10'),
    '9月の住宅ローンはもう記録してあるよ。それでも入れる？');
  assert.equal(manualCheckLine({ kind: 'deleted', fixed, ym: '2026-10' }, '2026-10'),
    '10月の住宅ローンは消してあるよ。固定費の分として入れ直す？');
});
