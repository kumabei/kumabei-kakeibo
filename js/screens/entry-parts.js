// Parts shared by the input screen, the editor and the fixed-cost sheet (Ver.1.3.0 big input spec 4, 5).
// Built big for presbyopic eyes: state is shown by shape as well as color (a thick frame, a check).
import { amountValue, hasOps, formatExpr, formatNumber, formatDateLabel, todayStr, addDays, colorOf } from '../logic.js';
import { iconOf, iconSvg } from '../icons.js';
import { LINES } from '../lines.js';
import { el } from '../ui.js';

// Keypad, 5 per row (Ver.1.1.3, after the calculator る～ちゃん uses). × − ＋ ＝ go down the 4th column;
// the submit button takes the bottom right 1×2 (CSS places it), so 0, the wide 00 and ＝ go under 1 2 3.
const KEYS = ['7', '8', '9', 'times', 'clear', '4', '5', '6', 'minus', 'back', '1', '2', '3', 'plus', '0', '00', 'equals'];
const KEY_LABELS = { clear: 'C', plus: '＋', minus: '−', times: '×', equals: '＝' };
const KEY_NAMES = { back: '1文字消す', clear: '全部消す' }; // read aloud; back is drawn as a picture
const LONG_EXPR = 13; // a longer expression is drawn smaller

// A long name breaks only after its ・ (イベント・ / レジャー), never inside a word.
export function nameParts(name) {
  return name.split(/(?<=・)/);
}

// What the amount box says instead of saving; null when the amount can be saved (spec 5-4).
export function amountWarning(amountStr) {
  if (amountValue(amountStr) > 0) return null;
  return hasOps(amountStr) ? LINES.belowZero : LINES.missingAmount;
}

// ＝ that cannot turn the expression into its result because it is 0 yen or less.
export function belowZeroOnEquals(key, amountStr) {
  return key === 'equals' && hasOps(amountStr) && amountValue(amountStr) <= 0;
}

// ［支出｜収入］, big (spec 3).
export function typeSeg(type, onPick) {
  return el('div', { class: 'seg seg-big' }, [['expense', '支出'], ['income', '収入']].map(([t, label]) =>
    el('button', {
      class: t === type ? 'on' : '', 'aria-pressed': String(t === type),
      onclick: () => { if (t !== type) onPick(t); },
    }, label)));
}

// Big picture buttons, 3 per row (spec 4). extra: a button added at the end (＋ 分類を追加).
export function catGrid(cats, selectedId, onPick, extra = null) {
  return el('div', { class: 'big-grid' },
    cats.map(c => el('button', {
      class: 'big-cat', 'aria-pressed': String(c.id === selectedId), style: `--ink:${colorOf(c).ink}`,
      onclick: () => onPick(c.id),
    },
    iconSvg(iconOf(c), 'icon cat-icon'),
    el('span', { class: 'cat-name' }, nameParts(c.name).flatMap((p, i) => (i ? [el('wbr'), p] : [p]))),
    el('span', { class: 'cat-tick' }, iconSvg('check')))),
    extra);
}

// The payment, one tap (spec 5-3).
export function payRow(methods, selectedId, onPick) {
  return el('div', { class: 'pay', role: 'group', 'aria-label': '払い方' }, methods.map(m =>
    el('button', { 'aria-pressed': String(m.id === selectedId), onclick: () => onPick(m.id) }, m.name)));
}

// The amount, right-aligned and big. With + − ×, the expression and ＝ its result (spec 5-4).
export function amountBox(amountStr, warning = null, shake = false) {
  const amount = amountValue(amountStr);
  const box = (cls, ...children) => el('div', { class: 'amount-box' + cls + (shake ? ' shake' : '') }, ...children);
  const big = (text, cls = '') => el('span', { class: 'amount-big' + cls }, text);
  if (warning) return box(' warn', el('span', { class: 'amount-ask' }, warning), big('¥' + formatNumber(amount)));
  if (amountStr === '') return box(' empty', el('span', { class: 'amount-ask' }, LINES.missingAmount), big('¥0'));
  if (!hasOps(amountStr)) return box('', big('¥' + formatNumber(amount)));
  const expr = formatExpr(amountStr);
  return box(expr.length > LONG_EXPR ? ' long' : '',
    el('span', { class: 'amount-expr' }, '¥' + expr),
    big('＝ ' + (amount < 0 ? '−' : '') + formatNumber(Math.abs(amount)), amount <= 0 ? ' minus' : ''));
}

// The keys and the submit button (spec 5-5). label: 4 characters, drawn on two lines (記録 / する).
export function keypad(onKey, { label, ready, onSubmit }) {
  return el('div', { class: 'big-keypad' },
    KEYS.map(k => el('button', {
      class: 'big-key' + (KEY_LABELS[k] || k === 'back' ? ' fn' : '') + (k === '00' ? ' key-wide' : '') + (k === 'back' ? ' key-back' : ''),
      'aria-label': KEY_NAMES[k] ?? null,
      onclick: () => onKey(k),
    }, k === 'back' ? iconSvg('backspace') : KEY_LABELS[k] ?? k)),
    el('button', { class: 'big-record' + (ready ? '' : ' not-ready'), onclick: onSubmit },
      iconSvg('check'), el('span', {}, label.slice(0, 2), el('br'), label.slice(2))));
}

// The date and the memo buttons (spec 5-2). onOpen(true) when the memo button was tapped.
export function whenRow(f, onOpen) {
  return el('div', { class: 'when-row' },
    el('button', { class: 'when-date', onclick: () => onOpen(false) },
      iconSvg('calendar'), el('span', { class: 'when-text' }, formatDateLabel(f.date)), el('span', { class: 'when-chev' }, '›')),
    el('button', { class: 'when-memo' + (f.memo ? ' has' : ''), onclick: () => onOpen(true) }, iconSvg('pencil'), 'メモ'));
}

// Date and memo in place of the keys (spec 5-2). Changes f in place and never re-renders while open:
// iOS keeps its date picker open and sends later picks and ［リセット］ (an empty value) to the same
// <input>, and drops them once it is replaced. ［これでOK］ calls onDone, which re-renders.
export function changePanel(f, onDone) {
  const today = todayStr();
  const yesterday = addDays(today, -1);
  const todayChip = el('button', { class: 'big-chip', onclick: () => { f.date = today; paint(); } }, '今日');
  const yesterdayChip = el('button', { class: 'big-chip', onclick: () => { f.date = yesterday; paint(); } }, '昨日');
  const pickLabel = document.createTextNode('');
  const pickChip = el('label', { class: 'big-chip date-chip' }, pickLabel,
    el('input', {
      type: 'date', class: 'date-input', value: f.date,
      onchange: e => { f.date = e.target.value || todayStr(); paint(); },
    }));
  function paint() {
    const custom = f.date !== today && f.date !== yesterday;
    todayChip.setAttribute('aria-pressed', String(f.date === today));
    yesterdayChip.setAttribute('aria-pressed', String(f.date === yesterday));
    pickChip.setAttribute('aria-pressed', String(custom));
    pickLabel.data = custom ? formatDateLabel(f.date) : '日付を選ぶ';
  }
  paint();
  return el('div', { class: 'change-panel' },
    el('div', { class: 'panel-label' }, '日付'),
    el('div', { class: 'big-chips' }, todayChip, yesterdayChip, pickChip),
    el('div', { class: 'panel-label' }, 'メモ'),
    el('input', {
      class: 'memo big-memo', type: 'text', placeholder: 'なくてもいいよ', value: f.memo, enterkeyhint: 'done',
      oninput: e => { f.memo = e.target.value; },
    }),
    el('button', { class: 'ok-btn', onclick: onDone }, 'これでOK'));
}
