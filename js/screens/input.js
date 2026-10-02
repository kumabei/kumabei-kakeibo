// Input screen (the app opens here) and the editor sheet, which reuses the same form parts.
import { state, addEntry, updateEntry, removeEntry, addCategory } from '../state.js';
import {
  todayStr, addDays, applyKey, amountValue, formatNumber, formatYen, formatDateLabel,
  visibleSorted, listWithCurrent, pickDefaultMethod, expenseOnDate, isFirstRecordToday, colorOf,
} from '../logic.js';
import { SCENES, recordReaction, renderKuma } from '../kuma.js';
import { LINES } from '../lines.js';
import { el, showToast, openSheet, closeSheet, askText } from '../ui.js';
import { show } from '../nav.js';

// Keypad, 4 per row; the submit button fills the last row next to 0.
const KEYS = ['7', '8', '9', 'back', '4', '5', '6', 'clear', '1', '2', '3', '00', '0'];
const KEY_LABELS = { back: '⌫', clear: 'C' };
const GUARD_MS = 1000;

let form = null; // the new-entry form; kept across re-renders
let formDay = null; // the day form.date was defaulted to (blankForm), so an overnight resume can catch up
let rootEl = null;
let busyUntil = 0; // taps on the submit button are ignored until then (double-tap guard)
let bumpNext = false; // play the small bump on the next drawn submit button
let firstShow = true;
const kumaEl = el('div', { class: 'kuma kuma-input' });

function blankForm(type, methodId) {
  formDay = todayStr();
  return { type, amountStr: '', categoryId: null, methodId, date: formDay, memo: '', memoOpen: false };
}

function setKuma(scene) {
  renderKuma(kumaEl, { ...scene, transient: true });
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
    setKuma(firstShow ? SCENES.welcome : SCENES.peek);
    firstShow = false;
  }
  const bump = bumpNext;
  bumpNext = false;
  root.replaceChildren(buildForm(form, {
    rerender: () => render(root),
    submitLabel: '記録する',
    onSubmit: submitNew,
    onMissing: () => setKuma(SCENES.missing),
    kuma: kumaEl,
    todaySpend: expenseOnDate(state.entries, todayStr()),
    bump,
  }));
}

async function submitNew() {
  const f = form;
  let entry;
  try {
    entry = await addEntry({
      type: f.type, amount: amountValue(f.amountStr), categoryId: f.categoryId,
      methodId: f.methodId, date: f.date, memo: f.memo.trim(),
    });
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

  const amountRow = el('div', { class: 'amount-row' },
    el('div', { class: 'amount' + (amount === 0 ? ' zero' : '') }, el('span', { class: 'yen' }, '¥'), formatNumber(amount)),
    kuma);

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
    KEYS.map(k => el('button', {
      class: 'key' + (KEY_LABELS[k] ? ' fn' : ''),
      onclick: () => set({ amountStr: applyKey(f.amountStr, k) }),
    }, KEY_LABELS[k] ?? k)),
    el('button', {
      class: 'record' + (ready ? '' : ' not-ready') + (bump ? ' bump' : ''),
      onclick: () => {
        if (Date.now() < busyUntil) return;
        if (!ready) { onMissing(); return; }
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
    if (!confirm('この記録を消しますか？')) return;
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
      onMissing: () => showToast(SCENES.missing.line, { image: SCENES.missing.image }),
    })));
  draw();
}
