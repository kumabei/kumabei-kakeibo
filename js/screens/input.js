// Input screen (the app opens here) and the editor sheet. Ver.1.3.0 (big input spec): the category is
// picked first from big picture buttons, then the calculator sheet slides up (spec 3-5). The editor
// uses the same parts (spec 7).
import { state, addEntry, updateEntry, removeEntry, addCategory, addFixedEntry } from '../state.js';
import {
  todayStr, monthOf, applyKey, amountValue, formatNumber, formatYen,
  visibleSorted, listWithCurrent, pickDefaultMethod, expenseOnDate, isFirstRecordToday, colorOf,
} from '../logic.js';
import { manualCheck, manualCheckLine, deleteConfirmText } from '../fixed.js';
import { SCENES, FIXED_ASK_IMAGE, recordReaction, renderKuma } from '../kuma.js';
import { LINES } from '../lines.js';
import { iconOf, iconSvg } from '../icons.js';
import { el, setChildren, showToast, openSheet, closeSheet, askText, askChoice, askIcon } from '../ui.js';
import { show } from '../nav.js';
import {
  typeSeg, catGrid, payRow, amountBox, keypad, whenRow, changePanel, amountWarning, belowZeroOnEquals,
} from './entry-parts.js';

const GUARD_MS = 1000;
const ANNOUNCE_MS = 5000; // how long the auto-record line stays (fixed costs spec 4-4)
const KEPT_MS = 5000; // how long "…円はとっておいたよ" stays (spec 5-1)
const RECORDED_MS = 6000; // the "…を記録しました［取り消す］" toast (spec 5-6)
// Fixed costs spec 5-2: the buttons for each state of the month. [value, label]; the first is suggested.
const FIXED_CHOICES = {
  new: [['fixed', '固定費の分として記録'], ['normal', '別のものとして記録'], ['cancel', 'やめる']],
  deleted: [['fixed', '固定費の分として記録'], ['normal', '別のものとして記録'], ['cancel', 'やめる']],
  recorded: [['normal', '入れる'], ['cancel', 'やめる']],
};

let form = null; // the new-entry form; kept across re-renders. A categoryId means the sheet is open.
let formDay = null; // the day form.date was defaulted to (blankForm), so an overnight resume can catch up
let rootEl = null;
let busyUntil = 0; // taps on the submit button are ignored until then (double-tap guard)
let sheetOpening = false; // slide the sheet up when it opens, not on every key
let firstShow = true;
let pending = null; // an auto-record line waiting for the input screen to be drawn
const kumaEl = el('div', { class: 'kuma kuma-input' });

// panel: 'keys' (amount and keys), 'change' (date and memo) or, in the editor only, 'cats'.
// warning: what the amount box says instead of saving; shake: shake it once on the next draw.
function blankForm(type, methodId) {
  formDay = todayStr();
  return { type, amountStr: '', categoryId: null, methodId, date: formDay, memo: '', panel: 'keys', warning: null, shake: false };
}

function setKuma(scene, ms) {
  renderKuma(kumaEl, { ...scene, transient: true, ms });
}

// Fixed costs spec 4-4: Kumabee tells what was recorded automatically, instead of "welcome".
export function announce(line) {
  const scene = { image: SCENES.autoRecorded.image, line, transient: true, ms: ANNOUNCE_MS };
  if (rootEl && !rootEl.hidden) renderKuma(kumaEl, scene);
  else pending = scene;
}

// The rows under the category, shared with the editor: date and memo, the payment, then the amount and
// the keys, or the date-and-memo panel in their place (spec 5-2 to 5-5).
function entryBody(f, { rerender, submitLabel, onSubmit }) {
  const set = patch => { Object.assign(f, patch); rerender(); };
  const when = whenRow(f, focusMemo => {
    set({ panel: 'change' });
    if (focusMemo) document.querySelector('.change-panel .big-memo')?.focus(); // inside the tap, so iOS shows the keyboard
  });
  if (f.panel === 'change') return [when, changePanel(f, () => set({ panel: 'keys' }))];
  const shake = f.shake;
  f.shake = false;
  return [
    when,
    f.type === 'expense' ? payRow(listWithCurrent(state.methods, f.methodId), f.methodId, id => set({ methodId: id })) : null,
    amountBox(f.amountStr, f.warning, shake),
    keypad(k => {
      if (belowZeroOnEquals(k, f.amountStr)) set({ warning: LINES.belowZero, shake: true });
      else set({ amountStr: applyKey(f.amountStr, k), warning: null });
    }, {
      label: submitLabel,
      ready: amountValue(f.amountStr) > 0,
      onSubmit: () => {
        if (Date.now() < busyUntil) return;
        const warning = amountWarning(f.amountStr);
        if (warning) { set({ warning, shake: true }); return; }
        busyUntil = Date.now() + GUARD_MS;
        onSubmit();
      },
    }),
  ];
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
  const cats = visibleSorted(state.categories.filter(c => c.type === form.type));
  const cat = state.categories.find(c => c.id === form.categoryId && c.type === form.type);
  if (!cat) form.categoryId = null;
  const set = patch => { Object.assign(form, patch); render(root); };
  const addIncome = form.type === 'income' && cats.length === 0
    ? addIncomeButton(id => { sheetOpening = true; set({ categoryId: id, panel: 'keys', warning: null }); })
    : null;
  setChildren(root,
    el('div', { class: 'input-head' },
      typeSeg(form.type, t => set({ type: t, categoryId: null })),
      el('div', { class: 'kuma-row' }, kumaEl,
        el('div', { class: 'today-spend' }, el('small', {}, '今日の支出'), el('b', {}, formatYen(expenseOnDate(state.entries, today)))))),
    catGrid(cats, form.categoryId, id => {
      sheetOpening = true;
      set({ categoryId: id, panel: 'keys', warning: null });
    }, addIncome),
    cats.length ? el('p', { class: 'cat-hint' }, '並び順は、設定の画面で入れかえられます') : null,
    cat ? calcSheet(cat) : null);
}

// The calculator sheet (spec 5). The dim layer under it takes the taps meant for the screen behind (spec 5-1).
function calcSheet(cat) {
  const opening = sheetOpening;
  sheetOpening = false;
  return [
    el('div', { class: 'calc-dim' }),
    el('section', { class: 'calc-sheet' + (opening ? ' opening' : ''), 'aria-label': '金額を入れる' },
      el('div', { class: 'calc-head' },
        el('div', { class: 'calc-cat', style: `--ink:${colorOf(cat).ink}` }, iconSvg(iconOf(cat)), el('span', {}, cat.name)),
        el('button', { class: 'quit', onclick: quit }, iconSvg('x'), 'やめる')),
      entryBody(form, { rerender: () => render(rootEl), submitLabel: '記録する', onSubmit: submitNew })),
  ];
}

// Spec 5-1: close the sheet; the amount, date, payment and memo stay for the next category.
function quit() {
  const kept = amountValue(form.amountStr);
  Object.assign(form, { categoryId: null, panel: 'keys', warning: null });
  render(rootEl);
  if (kept > 0) setKuma({ ...SCENES.kept, line: SCENES.kept.line.replace('{amount}', formatNumber(kept)) }, KEPT_MS);
}

// The "＋ 分類を追加" button shown in place of the grid when there is no income category (input screen and editor).
function addIncomeButton(onAdded) {
  return el('button', { class: 'big-cat cat-add', onclick: () => addIncomeCategory(onAdded) }, '＋ 分類を追加');
}

async function addIncomeCategory(onAdded) {
  const name = await askText('収入の分類の名前を入れてね'); // first, inside the tap, so iOS shows the keyboard
  if (!name) return;
  const icon = await askIcon(null, 'あとで');
  try {
    onAdded((await addCategory('income', name, icon)).id);
  } catch (e) {
    showToast('保存できませんでした：' + e.message);
  }
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
  if (choice === 'cancel') { // back to the sheet, with what was typed
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
  form = blankForm(f.type, f.methodId); // spec 5-6: the date goes back to today, the payment stays
  if (rootEl) render(rootEl);
  const cat = state.categories.find(c => c.id === entry.categoryId);
  showToast(`${cat?.name ?? ''} ${formatYen(entry.amount)}を記録しました`, {
    actionLabel: '取り消す',
    onAction: () => undo(entry),
    ms: RECORDED_MS,
  });
}

// Spec 5-7: undo deletes the entry. If the sheet is closed and nothing is typed, the sheet opens again
// with the entry's values, so a typo is one key away; otherwise just say it's gone.
async function undo(entry) {
  try {
    await removeEntry(entry.id);
  } catch (e) {
    showToast('消せませんでした：' + e.message);
    return;
  }
  if (form.categoryId === null && form.amountStr === '') {
    form = {
      ...blankForm(entry.type, entry.methodId ?? form.methodId),
      amountStr: String(entry.amount), categoryId: entry.categoryId, date: entry.date, memo: entry.memo,
    };
    sheetOpening = true;
  } else {
    const cat = state.categories.find(c => c.id === entry.categoryId);
    showToast(`${cat?.name ?? ''} ${formatYen(entry.amount)}を取り消しました`);
  }
  show('input');
}

// Editor sheet for an existing entry (opened from the calendar, the history and the reports). Spec 7.
export function openEditor(entry) {
  const f = {
    type: entry.type, amountStr: String(entry.amount), categoryId: entry.categoryId,
    methodId: entry.methodId ?? pickDefaultMethod(state.methods, state.settings.lastMethodId),
    date: entry.date, memo: entry.memo ?? '', panel: 'keys', warning: null, shake: false,
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
  const draw = () => {
    const cats = listWithCurrent(state.categories.filter(c => c.type === f.type), f.categoryId);
    const cat = cats.find(c => c.id === f.categoryId);
    if (!cat) f.panel = 'cats';
    const set = patch => { Object.assign(f, patch); draw(); };
    const body = f.panel === 'cats'
      ? [el('div', { class: 'panel-label' }, '分類をえらんでね'),
        catGrid(cats, f.categoryId, id => set({ categoryId: id, panel: 'keys' }),
          f.type === 'income' && cats.length === 0 ? addIncomeButton(id => set({ categoryId: id, panel: 'keys' })) : null)]
      : [el('button', { class: 'cat-change', style: `--ink:${colorOf(cat).ink}`, onclick: () => set({ panel: 'cats' }) },
        iconSvg(iconOf(cat)), el('span', { class: 'cat-change-name' }, cat.name), el('span', { class: 'cat-change-go' }, '変える ›')),
      ...entryBody(f, { rerender: draw, submitLabel: '保存する', onSubmit: save })];
    openSheet(el('div', { class: 'editor' },
      el('div', { class: 'sheet-head' },
        el('button', { class: 'link', onclick: closeSheet }, '閉じる'),
        el('b', {}, '記録を直す'),
        el('button', { class: 'link danger', onclick: del }, '削除')),
      typeSeg(f.type, t => set({ type: t, categoryId: null })),
      ...body));
  };
  draw();
}
