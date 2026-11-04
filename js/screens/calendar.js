// Calendar: daily spending, 🐾 on days with records, today in pale yellow; tap a day for its list.
// Ver.1.3.2: a fixed cost's payment day still to come shows 🔁予定 (no amount) in a dashed frame.
import { state } from '../state.js';
import {
  todayStr, monthOf, calendarCells, expenseByDate, datesWithEntries, entriesOnDate, formatNumber, formatDateLabel, formatYen,
} from '../logic.js';
import { plannedByDate } from '../fixed.js';
import { SCENES, renderKuma } from '../kuma.js';
import { el, setChildren, monthNav, entryRow } from '../ui.js';
import { openEditor, swipeDelete } from './input.js';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
let ym = null;
let selected = null;

export function render(root, { entering = false } = {}) {
  const today = todayStr();
  if (entering || !ym) {
    ym = monthOf(today);
    selected = today;
  }
  const totals = expenseByDate(state.entries, ym);
  const marked = datesWithEntries(state.entries, ym);
  const planned = plannedByDate(state.fixed, state.entries, ym);
  const pick = d => { selected = d; render(root); };

  const grid = el('div', { class: 'cal-grid' },
    WEEK.map(w => el('div', { class: 'cal-week' }, w)),
    calendarCells(ym).map(d => (d === null
      ? el('div', { class: 'cal-cell empty' })
      : el('button', {
        class: ['cal-cell', d === today && 'today', d === selected && 'selected', planned[d] && 'plan'].filter(Boolean).join(' '),
        onclick: () => pick(d),
      },
      el('span', { class: 'cal-day' }, String(Number(d.slice(8)))),
      marked.has(d) ? el('span', { class: 'paw' }, '🐾') : null,
      totals[d] ? el('span', { class: 'cal-amount' }, formatNumber(totals[d])) : null,
      planned[d] ? el('span', { class: 'cal-plan' }, '🔁予定') : null))));

  const inMonth = selected !== null && monthOf(selected) === ym;
  const list = inMonth ? entriesOnDate(state.entries, selected) : [];
  const plans = inMonth ? planned[selected] ?? [] : [];
  const kuma = el('div', { class: 'kuma kuma-small' });
  renderKuma(kuma, inMonth && list.length === 0 && plans.length === 0 ? SCENES.empty : { image: SCENES.peek.image });

  setChildren(root,
    monthNav(ym, next => { ym = next; selected = null; render(root); }),
    grid,
    el('div', { class: 'day-head' }, inMonth ? formatDateLabel(selected) : '日をタップしてね'),
    list.map(e => entryRow(e, state, () => openEditor(e), { onDelete: () => swipeDelete(e) })),
    plans.map(p => el('div', { class: 'plan-row' },
      el('div', { class: 'plan-main' },
        el('span', { class: 'plan-name' }, `${p.name} 🔁`),
        el('span', { class: 'plan-note' }, `予定・${p.day}日になってアプリを開くと、自動で入ります`)),
      el('span', { class: 'plan-amount' }, formatYen(p.amount)))),
    plans.length ? el('div', { class: 'plan-hint' }, '先に払ったときは、入力画面からどうぞ') : null,
    kuma);
}
