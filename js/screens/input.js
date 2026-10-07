// Input screen (the app opens here) and the editor sheet, which reuses the same form parts.
import { state, addEntry, updateEntry, removeEntry, addCategory, addFixedEntry } from '../state.js';
import {
  todayStr, addDays, monthOf, applyKey, amountValue, hasOps, formatExpr, formatNumber, formatYen, formatDateLabel,
  visibleSorted, listWithCurrent, pickDefaultMethod, expenseOnDate, isFirstRecordToday, colorOf,
} from '../logic.js';
import { manualCheck, manualCheckLine, deleteConfirmText } from '../fixed.js';
import { SCENES, FIXED_ASK_IMAGE, recordReaction, renderKuma } from '../kuma.js';
import { LINES } from '../lines.js';
import { el, showToast, openSheet, closeSheet, askText, askChoice } from '../ui.js';
import { show } from '../nav.js';

// Keypad, 5 per row (Ver.1.1.2, after the calculator る～ちゃん uses). The submit button takes the
// bottom right 2×2 (CSS places it), so 0 and the wide 00 go under 1 2 3.
const KEYS = ['7', '8', '9', 'minus', 'clear', '4', '5', '6', 'plus', 'back', '1', '2', '3', '0', '00'];
const KEY_LABELS = { back: '⌫', clear: 'C', plus: '＋', minus: '−' };
const LONG_EXPR = 13; // a longer expression is drawn smaller
const GUARD_MS = 1000;
const ANNOUNCE_MS = 5000; // how long the auto-record line stays (fixed costs spec 4-4)
// Fixed costs spec 5-2: the buttons for each state of the month. [value, label]; the first is suggested.
const FIXED_CHOICES = {
  new: [['fixed', '固定費の分として記録'], ['normal', '別のものとして記録'], ['cancel', 'やめる']],
  deleted: [['fixed', '固定費の分として記録'], ['normal', '別のものとして記録'], ['cancel', 'やめる']],
  recorded: [['normal', '入れる'], ['cancel', 'やめる']],
};

let form = null; // the new-entry form; kept across re-renders
let formDay = null; // the day form.date was defaulted to (blankForm), so an overnight resume can catch up
let rootEl = null;
let busyUntil = 0; // taps on the submit button are ignored until then (double-tap guard)
let bumpNext = false; // play the small bump on the next drawn submit button
let firstShow = true;
let pending = null; // an auto-record line waiting for the input screen to be drawn
const kumaEl = el('div', { class: 'kuma kuma-input' });

function blankForm(type, methodId) {
  formDay = todayStr();
  return { type, amountStr: '', categoryId: null, methodId, date: formDay, memo: '', memoOpen: false };
}

function setKuma(scene) {
  renderKuma(kumaEl, { ...scene, transient: true });
}

// Fixed costs spec 4-4: Kumabee tells what was recorded automatically, instead of "welcome".
export function announce(line) {
  const scene = { image: SCENES.autoRecorded.image, line, transient: true, ms: ANNOUNCE_MS };
  if (rootEl && !rootEl.hidden) renderKuma(kumaEl, scene);
  else pending = scene;
}

// The keypad keys without the submit button. Shared with the fixed-cost sheet.
export function keyButtons(onKey) {
  return KEYS.map(k => el('button', {
    class: 'key' + (KEY_LABELS[k] ? ' fn' : '') + (k === '00' ? ' wide' : ''),
    onclick: () => onKey(k),
  }, KEY_LABELS[k] ?? k));
}

// The amount as typed. With + or -, the expression and its result under it. Shared with the fixed-cost sheet.
export function amountView(amountStr) {
  const amount = amountValue(amountStr);
  const yen = el('span', { class: 'yen' }, '¥');
  if (!hasOps(amountStr)) return el('div', { class: 'amount' + (amount === 0 ? ' zero' : '') }, yen, formatNumber(amount));
  const expr = formatExpr(amountStr);
  return el('div', { class: 'amount calc' + (expr.length > LONG_EXPR ? ' long' : '') },
    el('div', { class: 'calc-expr' }, yen, expr),
    el('div', { class: 'calc-result' + (amount <= 0 ? ' minus' : '') },
      '＝' + (amount < 0 ? '−' : '') + formatNumber(Math.abs(amount))));
}

// What Kumabee says when the submit button is not ready yet.
export function missingScene(amountStr) {
  return hasOps(amountStr) && amountValue(amountStr) <= 0 ? SCENES.belowZero : SCENES.missing;
}

export function render(root, { entering = false } = {}) {
  rootEl = root;
  form ??= blankForm('expense', pickDefaultMethod(state.methods, state.settings.lastMethodId));
  if (!visibleSorted(state.methods).some(m => m.id === form.methodId)) {
    form.methodId = pickDefaultMethod(state.methods, state.settings.lastMethodId);
  }
  const today = todayStr();
  if (today !== formDay && form.date === formDay) {
    form.date = today;
    formDay = today;
  }
  if (entering) {
    if (pending) renderKuma(kumaEl, pending);
    else setKuma(firstShow ? SCENES.welcome : SCENES.peek);
    pending = null;
    firstShow = false;
  }
  const bump = bumpNext;
  bumpNext = false;
  root.replaceChildren(buildForm(form, {
    rerender: () => render(root),
    submitLabel: '記録する',
    onSubmit: submitNew,
    onMissing: scene => setKuma(scene),
    kuma: kumaEl,
    todaySpend: expenseOnDate(state.entries, todayStr()),
    bump,
  }));
}

async function submitNew() {
  const f = form;
  const draft = {
    type: f.type, amount: amountValue(f.amountStr), categoryId: f.categoryId,
    methodId: f.methodId, date: f.date, memo: f.memo.trim(),
  };
  // Fixed costs spec 5-2: the same category and amount as a fixed cost → Kumabee asks first.
  const check = manualCheck(state.fixed, state.entries, draft);
  const choice = check
    ? await askChoice(FIXED_ASK_IMAGE, manualCheckLine(check, monthOf(todayStr())), FIXED_CHOICES[check.kind])
    : 'normal';
  if (choice === 'cancel') { // back to the form, with what was typed
    busyUntil = 0;
    return;
  }
  busyUntil = Date.now() + GUARD_MS; // the question took time: guard the save itself
  let entry;
  try {
    entry = choice === 'fixed' ? await addFixedEntry(draft, check.fixed.id) : await addEntry(draft);
  } catch (e) {
    busyUntil = 0;
    showToast('保存できませんでした：' + e.message);
    return;
  }
  setKuma(recordReaction(entry, isFirstRecordToday(state.entries, entry)));
  form = blankForm(f.type, f.methodId);
  bumpNext = true;
  if (rootEl) render(rootEl);
  const cat = state.categories.find(c => c.id === entry.categoryId);
  showToast(`${cat?.name ?? ''} ${formatYen(entry.amount)}を記録しました`, {
    actionLabel: '取り消す',
    onAction: () => undo(entry),
  });
}

// Undo: delete the entry. If the form is still untouched, put its values back so a typo is one
// key away; otherwise leave whatever the user has started typing alone and just say it's gone.
async function undo(entry) {
  try {
    await removeEntry(entry.id);
  } catch (e) {
    showToast('消せませんでした：' + e.message);
    return;
  }
  if (form.amountStr === '' && form.categoryId === null) {
    form = {
      type: entry.type, amountStr: String(entry.amount), categoryId: entry.categoryId,
      methodId: entry.methodId ?? form.methodId, date: entry.date, memo: entry.memo, memoOpen: entry.memo !== '',
    };
  } else {
    const cat = state.categories.find(c => c.id === entry.categoryId);
    showToast(`${cat?.name ?? ''} ${formatYen(entry.amount)}を取り消しました`);
  }
  show('input');
}

// Builds the entry form for `f` (mutated in place). Shared by the input screen and the editor sheet.
function buildForm(f, { rerender, submitLabel, onSubmit, onMissing, kuma = null, todaySpend = null, bump = false }) {
  const cats = listWithCurrent(state.categories.filter(c => c.type === f.type), f.categoryId);
  const amount = amountValue(f.amountStr);
  const ready = amount > 0 && cats.some(c => c.id === f.categoryId);
  const set = patch => { Object.assign(f, patch); rerender(); };

  const top = el('div', { class: 'input-top' },
    el('div', { class: 'seg' }, [['expense', '支出'], ['income', '収入']].map(([t, label]) =>
      el('button', { class: t === f.type ? 'on' : '', onclick: () => { if (t !== f.type) set({ type: t, categoryId: null }); } }, label))),
    todaySpend === null ? null : el('div', { class: 'today-spend' }, '今日の支出 ', el('b', {}, formatYen(todaySpend))));

  const amountRow = el('div', { class: 'amount-row' }, amountView(f.amountStr), kuma);

  const grid = el('div', { class: 'cat-grid' },
    cats.map(c => el('button', {
      class: 'cat' + (c.id === f.categoryId ? ' on' : ''),
      style: `--cat-bg:${colorOf(c).bg};--cat-strong:${colorOf(c).strong}`,
      onclick: () => set({ categoryId: c.id }),
    }, c.name)),
    f.type === 'income' && cats.length === 0
      ? el('button', {
        class: 'cat add',
        onclick: async () => {
          const name = await askText('収入の分類の名前を入れてね');
          if (!name) return;
          try {
            set({ categoryId: (await addCategory('income', name)).id });
          } catch (e) {
            showToast('保存できませんでした：' + e.message);
          }
        },
      }, '＋ 分類を追加')
      : null);

  const methods = f.type === 'expense'
    ? el('div', { class: 'chips' }, listWithCurrent(state.methods, f.methodId).map(m =>
      el('button', { class: 'chip' + (m.id === f.methodId ? ' on' : ''), onclick: () => set({ methodId: m.id }) }, m.name)))
    : null;

  const today = todayStr();
  const yesterday = addDays(today, -1);
  const todayChip = el('button', { class: 'chip', onclick: () => set({ date: today }) }, '今日');
  const yesterdayChip = el('button', { class: 'chip', onclick: () => set({ date: yesterday }) }, '昨日');
  const pickLabel = document.createTextNode('');
  // A date change must not re-render: iOS keeps its picker open and sends later picks and
  // ［リセット］ (an empty value) to the same <input>, and drops them once it is replaced.
  const pickChip = el('label', { class: 'chip date-chip' }, pickLabel,
    el('input', {
      type: 'date', class: 'date-input', value: f.date,
      onchange: e => { f.date = e.target.value || todayStr(); paintDates(); },
    }));
  const paintDates = () => {
    const custom = f.date !== today && f.date !== yesterday;
    todayChip.classList.toggle('on', f.date === today);
    yesterdayChip.classList.toggle('on', f.date === yesterday);
    pickChip.classList.toggle('on', custom);
    pickLabel.data = custom ? formatDateLabel(f.date) : '日付を選ぶ';
  };
  paintDates();
  const dates = el('div', { class: 'chips' }, todayChip, yesterdayChip, pickChip,
    el('button', { class: 'chip' + (f.memo ? ' on' : ''), onclick: () => set({ memoOpen: !f.memoOpen }) }, '✏️メモ'));

  const memo = f.memoOpen
    ? el('input', { class: 'memo', type: 'text', placeholder: 'メモ', value: f.memo, oninput: e => { f.memo = e.target.value; } })
    : null;

  const pad = el('div', { class: 'keypad' },
    keyButtons(k => set({ amountStr: applyKey(f.amountStr, k) })),
    el('button', {
      class: 'record' + (ready ? '' : ' not-ready') + (bump ? ' bump' : ''),
      onclick: () => {
        if (Date.now() < busyUntil) return;
        if (!ready) { onMissing(missingScene(f.amountStr)); return; }
        busyUntil = Date.now() + GUARD_MS;
        onSubmit();
      },
    }, submitLabel));

  return el('div', { class: 'entry-form' }, top, amountRow, grid, methods, dates, memo, pad);
}

// Editor sheet for an existing entry (opened from the calendar or the history).
export function openEditor(entry) {
  const f = {
    type: entry.type, amountStr: String(entry.amount), categoryId: entry.categoryId,
    methodId: entry.methodId ?? pickDefaultMethod(state.methods, state.settings.lastMethodId),
    date: entry.date, memo: entry.memo ?? '', memoOpen: Boolean(entry.memo),
  };
  const save = async () => {
    try {
      await updateEntry({
        ...entry, type: f.type, amount: amountValue(f.amountStr), categoryId: f.categoryId,
        methodId: f.methodId, date: f.date, memo: f.memo.trim(),
      });
    } catch (e) {
      showToast('保存できませんでした：' + e.message);
      return;
    }
    closeSheet();
    showToast(LINES.edited, { image: SCENES.recorded.image });
  };
  const del = async () => {
    // Fixed costs spec 4-3: a stronger confirmation for an entry of a fixed cost.
    if (!confirm(entry.fixedId ? deleteConfirmText(entry, state.fixed) : 'この記録を消しますか？')) return;
    try {
      await removeEntry(entry.id);
    } catch (e) {
      showToast('消せませんでした：' + e.message);
      return;
    }
    closeSheet();
    showToast(SCENES.deleted.line, { image: SCENES.deleted.image });
  };
  const draw = () => openSheet(el('div', { class: 'editor' },
    el('div', { class: 'sheet-head' },
      el('button', { class: 'link', onclick: closeSheet }, '閉じる'),
      el('b', {}, '記録を直す'),
      el('button', { class: 'link danger', onclick: del }, '削除')),
    buildForm(f, {
      rerender: draw,
      submitLabel: '保存する',
      onSubmit: save,
      onMissing: scene => showToast(scene.line, { image: scene.image }),
    })));
  draw();
}
