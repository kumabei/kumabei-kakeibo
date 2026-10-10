// The fixed-cost parts of the screens: telling what was recorded automatically (spec 4-4), and the
// "毎月の固定費" list in the settings with its add / edit sheet (spec 5-1, 6-1).
import { state, saveFixed, catchUpFixed } from '../state.js';
import { todayStr, monthOf, amountValue, applyKey, listWithCurrent, pickDefaultMethod, colorOf } from '../logic.js';
import { listedFixed, newFixed, resumedFixed, deletedFixed, fixedRowText, autoRecordLine, askStartedLine } from '../fixed.js';
import { SCENES, FIXED_ASK_IMAGE } from '../kuma.js';
import { LINES } from '../lines.js';
import { el, setChildren, openSheet, closeSheet, showToast, askChoice } from '../ui.js';
import { currentView } from '../nav.js';
import { keyButtons, amountView, missingScene, announce, submitLabelParts, belowZeroOnEquals } from './input.js';

// Records the fixed costs that are due and says so: Kumabee on the input screen, a toast elsewhere.
// Resolves with what was recorded.
export async function checkFixed() {
  let recorded;
  try {
    recorded = await catchUpFixed();
  } catch (e) {
    showToast('毎月の固定費を記録できませんでした：' + e.message);
    return [];
  }
  if (recorded.length) {
    const line = autoRecordLine(recorded, monthOf(todayStr()));
    const view = currentView();
    if (view === null || view === 'input') announce(line);
    else showToast(line, { image: SCENES.autoRecorded.image });
  }
  return recorded;
}

// Spec 5-1. Resolves true for ［もう入れた］.
function askStarted(day) {
  return askChoice(FIXED_ASK_IMAGE, askStartedLine(day, todayStr()), [[true, 'もう入れた'], [false, 'まだ']]);
}

async function saved(change) {
  try {
    await change();
    return true;
  } catch (e) {
    showToast('保存できませんでした：' + e.message);
    return false;
  }
}

// A catch-up may have advanced doneThrough since a row or sheet was drawn. Saving is a whole-object
// put, so always start from the stored object, never from the one captured at draw time.
const latest = f => state.fixed.find(x => x.id === f.id) ?? f;

async function stop(f) {
  if (await saved(() => saveFixed({ ...latest(f), hidden: true }))) showToast(`${f.name}をやめました（これまでの記録はそのままです）`);
}

async function resume(f) {
  const already = await askStarted(f.day);
  if (!(await saved(() => saveFixed(resumedFixed(latest(f), already, todayStr()))))) return;
  if ((await checkFixed()).length === 0) showToast(`${f.name}を再開しました`);
}

// Ver.1.1.1: only a stopped one can be deleted (two steps, so a running one is never deleted by mistake).
async function remove(f) {
  if (!confirm(`${f.name}を一覧から消しますか？これまでの記録はそのまま残ります`)) return;
  if (await saved(() => saveFixed(deletedFixed(latest(f))))) showToast(`${f.name}を消しました`);
}

export function fixedSection() {
  const rows = listedFixed(state.fixed).map(f =>
    el('div', { class: 'item-row fixed-item' + (f.hidden ? ' hidden-item' : '') },
      el('span', { class: 'item-name' }, fixedRowText(f, state.categories, state.methods)),
      f.hidden
        ? [el('button', { class: 'small', onclick: () => resume(f) }, '再開'),
          el('button', { class: 'small', onclick: () => remove(f) }, '消す')]
        : [el('button', { class: 'small', onclick: () => openFixedSheet(f) }, '直す'),
          el('button', { class: 'small', onclick: () => stop(f) }, 'やめる')]));
  return el('section', { class: 'card' },
    el('div', { class: 'card-title' }, '毎月の固定費'),
    rows.length ? el('div', { class: 'item-list' }, rows) : el('div', { class: 'muted' }, 'まだ登録していません'),
    el('button', { class: 'add', onclick: () => openFixedSheet(null) }, '＋ 追加'));
}

// The add / edit sheet (spec 6-1). The name field is built once, so typing keeps the keyboard open;
// everything below it is drawn again on each change.
function openFixedSheet(existing) {
  const d = existing
    ? { name: existing.name, amountStr: String(existing.amount), categoryId: existing.categoryId, methodId: existing.methodId, day: existing.day }
    : { name: '', amountStr: '', categoryId: null, methodId: pickDefaultMethod(state.methods, state.settings.lastMethodId), day: null };
  const body = el('div');
  const nameInput = el('input', {
    type: 'text', class: 'memo', placeholder: '名前（例：住宅ローン）', value: d.name, enterkeyhint: 'done',
    oninput: e => { d.name = e.target.value; drawBody(); },
  });

  let busy = false;
  const submit = async () => {
    if (busy) return;
    busy = true;
    try {
      const draft = { name: d.name.trim(), amount: amountValue(d.amountStr), categoryId: d.categoryId, methodId: d.methodId, day: d.day };
      if (existing) {
        // Editing changes only the entries recorded from now on (spec 4-3); no question here (spec 6-1).
        if (!(await saved(() => saveFixed({ ...latest(existing), ...draft })))) return;
        closeSheet();
        showToast(LINES.edited, { image: SCENES.recorded.image });
        return;
      }
      const already = await askStarted(draft.day);
      if (!(await saved(() => saveFixed(newFixed(draft, already, todayStr(), `f-${crypto.randomUUID()}`, Date.now()))))) return;
      closeSheet();
      // ［まだ］ with the day already passed: this month's is recorded at once (spec 5-1).
      if ((await checkFixed()).length === 0) showToast(`${draft.name}を登録しました`);
    } finally {
      busy = false;
    }
  };

  function drawBody() {
    const cats = listWithCurrent(state.categories.filter(c => c.type === 'expense'), d.categoryId);
    const methods = listWithCurrent(state.methods, d.methodId);
    const amount = amountValue(d.amountStr);
    const ready = d.name.trim() !== '' && amount > 0 && cats.some(c => c.id === d.categoryId)
      && methods.some(m => m.id === d.methodId) && d.day !== null;
    const set = patch => { Object.assign(d, patch); drawBody(); };
    setChildren(body,
      el('div', { class: 'fixed-label' }, '金額'),
      amountView(d.amountStr),
      el('div', { class: 'fixed-label' }, '分類'),
      el('div', { class: 'cat-grid' }, cats.map(c => el('button', {
        class: 'cat' + (c.id === d.categoryId ? ' on' : ''),
        style: `--cat-bg:${colorOf(c).bg};--cat-strong:${colorOf(c).strong}`,
        onclick: () => set({ categoryId: c.id }),
      }, c.name))),
      el('div', { class: 'fixed-label' }, '支払い方法'),
      el('div', { class: 'chips' }, methods.map(m =>
        el('button', { class: 'chip' + (m.id === d.methodId ? ' on' : ''), onclick: () => set({ methodId: m.id }) }, m.name))),
      el('div', { class: 'fixed-label' }, '毎月何日'),
      el('div', { class: 'day-grid' }, Array.from({ length: 31 }, (_, i) => i + 1).map(n =>
        el('button', { class: 'day' + (n === d.day ? ' on' : ''), onclick: () => set({ day: n }) }, String(n)))),
      d.day >= 29 ? el('div', { class: 'muted fixed-note' }, 'その日がない月は、月末に記録します') : null,
      el('div', { class: 'keypad' },
        keyButtons(k => {
          if (belowZeroOnEquals(k, d.amountStr)) showToast(SCENES.belowZero.line);
          else set({ amountStr: applyKey(d.amountStr, k) });
        }),
        el('button', {
          class: 'record' + (ready ? '' : ' not-ready'),
          onclick: () => {
            if (ready) submit();
            else if (missingScene(d.amountStr) === SCENES.belowZero) showToast(SCENES.belowZero.line);
            else showToast('名前・金額・分類・支払い方法・日を入れてね');
          },
        }, submitLabelParts(existing ? '保存する' : '登録する'))));
  }

  drawBody();
  openSheet(el('div', { class: 'fixed-sheet' },
    el('div', { class: 'sheet-head' },
      el('button', { class: 'link', onclick: closeSheet }, '閉じる'),
      el('b', {}, existing ? '固定費を直す' : '毎月の固定費を追加'),
      el('span', { class: 'sheet-spacer' })),
    el('div', { class: 'fixed-label' }, '名前'),
    nameInput,
    body));
}
