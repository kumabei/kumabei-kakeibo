import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_IMAGES, cardContent } from '../js/review-text.js';
import { LINES } from '../js/lines.js';
import { lineChars } from '../js/kuma.js';

const base = { big: null, rows: null, details: [] };

test('cover and count', () => {
  assert.deepEqual(cardContent({ kind: 'cover', year: 2026, start: '2026-10-01', end: '2026-12-20' }), {
    ...base, image: 'y19', title: '2026年のふりかえり', details: ['10月1日〜12月20日の記録から'], line: '1年おつかれさま！発表するよ～',
  });
  assert.deepEqual(cardContent({ kind: 'count', entries: 1234, days: 80 }), {
    ...base, image: 'k09', title: '記録した件数', big: '1,234件', details: ['記録した日は80日'], line: LINES.reviewCount,
  });
});

test('top3: ranks from 1, the first category in the line, its picture when it has one', () => {
  const rows = [
    { categoryId: 'e01', name: '食費', count: 52, amount: 30000 },
    { categoryId: 'c-x', name: 'ペット', count: 10, amount: 9000 },
  ];
  const c = cardContent({ kind: 'top3', rows });
  assert.equal(c.image, 'y02');
  assert.equal(c.title, 'よく使った分類');
  assert.deepEqual(c.rows, [{ rank: 1, name: '食費', count: 52 }, { rank: 2, name: 'ペット', count: 10 }]);
  assert.equal(c.line, 'いちばん記録したのは食費だったよ');
  assert.equal(cardContent({ kind: 'top3', rows: rows.slice(1) }).image, REVIEW_IMAGES.top3);
});

test('biggest: the amount, then the date and category, then the memo if any', () => {
  const card = { kind: 'biggest', date: '2026-10-15', categoryId: 'e02', name: '外食', memo: 'おすし', amount: 5000 };
  assert.deepEqual(cardContent(card), {
    ...base, image: 'k12', title: '一番高い買い物', big: '5,000円', details: ['10月15日(木) 外食', 'おすし'], line: LINES.reviewBiggest,
  });
  assert.deepEqual(cardContent({ ...card, memo: '' }).details, ['10月15日(木) 外食']);
});

test('zeroDays: a different line for none', () => {
  const c = cardContent({ kind: 'zeroDays', zero: 14, days: 80 });
  assert.deepEqual([c.big, c.details, c.line], ['14日', ['80日のうち'], LINES.reviewZero]);
  assert.equal(cardContent({ kind: 'zeroDays', zero: 0, days: 80 }).line, LINES.reviewZeroNone);
});

test('compare: down, up, the same, and the most and least months', () => {
  const card = { kind: 'compare', a: '2026-10', b: '2026-11', change: { categoryId: 'e02', name: '外食', diff: -5000 }, most: null, least: null };
  const down = cardContent(card);
  assert.deepEqual([down.title, down.big, down.details, down.line],
    ['月をくらべると', '5,000円へった', ['10月と11月の外食'], LINES.reviewCompareDown]);
  const up = cardContent({ ...card, change: { ...card.change, diff: 1200 } });
  assert.deepEqual([up.big, up.line], ['1,200円ふえた', LINES.reviewCompareUp]);
  const same = cardContent({ ...card, change: null });
  assert.deepEqual([same.big, same.details, same.line], ['ほとんど同じ', ['10月と11月'], LINES.reviewCompareSame]);
  const three = cardContent({ ...card, most: { ym: '2026-09', amount: 9000 }, least: { ym: '2026-11', amount: 4600 } });
  assert.deepEqual(three.details, ['10月と11月の外食', '一番使った月　9月 9,000円', '一番少なかった月　11月 4,600円']);
});

test('savings: a rate, or how much more was spent', () => {
  const plus = cardContent({ kind: 'savings', rate: 33, diff: 65266 });
  assert.deepEqual([plus.image, plus.big, plus.details, plus.line], ['y15', '33%', ['収入のうち、これだけ残せたよ'], LINES.reviewSaving]);
  const minus = cardContent({ kind: 'savings', rate: -5, diff: -10000 });
  assert.deepEqual([minus.image, minus.big, minus.details, minus.line], ['k06', '10,000円', ['収入より多く使ったよ'], LINES.reviewSavingMinus]);
});

test('feature and closing', () => {
  assert.deepEqual(cardContent({ kind: 'feature', feature: 'saver' }),
    { ...base, image: 'k14', title: '今年の特徴', big: 'コツコツためた年', line: '今年はコツコツためた年！' });
  assert.equal(cardContent({ kind: 'feature', feature: 'thrifty' }).big, 'やりくり上手の年');
  const cat = cardContent({ kind: 'feature', feature: 'category', categoryId: 'e03', name: 'おやつ' });
  assert.deepEqual([cat.big, cat.line], ['『おやつ』をたのしんだ年', '今年は『おやつ』をたのしんだ年！']);
  assert.deepEqual(cardContent({ kind: 'closing' }), { ...base, image: 'k01', title: '1年ありがとう', line: LINES.reviewClosing });
});

test('the line font covers every review line once category names are added (js/app.js)', () => {
  const chars = lineChars('食費おやつ');
  for (const line of [cardContent({ kind: 'top3', rows: [{ categoryId: 'e01', name: '食費', count: 1 }] }).line,
    cardContent({ kind: 'feature', feature: 'category', name: 'おやつ' }).line]) {
    for (const ch of line) assert.ok(chars.includes(ch), `missing: ${ch}`);
  }
});
