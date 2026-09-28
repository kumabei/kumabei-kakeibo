// Calendar: daily spending, 🐾 on days with records, today in pale yellow; tap a day for its list.
import { state } from '../state.js';
import {
  todayStr, monthOf, calendarCells, expenseByDate, datesWithEntries, entriesOnDate, formatNumber, formatDateLabel,
} from '../logic.js';
import { SCENES, renderKuma } from '../kuma.js';
import { el, setChildren, monthNav, entryRow } from '../ui.js';
import { openEditor } from './input.js';

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
  const pick = d => { selected = d; render(root); };

  const grid = el('div', { class: 'cal-grid' },
    WEEK.map(w => el('div', { class: 'cal-week' }, w)),
    calendarCells(ym).map(d => (d === null
      ? el('div', { class: 'cal-cell empty' })
      : el('button', {
        class: ['cal-cell', d === today && 'today', d === selected && 'selected'].filter(Boolean).join(' '),
        onclick: () => pick(d),
      },
      el('span', { class: 'cal-day' }, String(Number(d.slice(8)))),
      marked.has(d) ? el('span', { class: 'paw' }, '🐾') : null,
      totals[d] ? el('span', { class: 'cal-amount' }, formatNumber(totals[d])) : null))));

  const inMonth = selected !== null && monthOf(selected) === ym;
  const list = inMonth ? entriesOnDate(state.entries, selected) : [];
  const kuma = el('div', { class: 'kuma kuma-small' });
  renderKuma(kuma, inMonth && list.length === 0 ? SCENES.empty : { image: SCENES.peek.image });

  setChildren(root,
    monthNav(ym, next => { ym = next; selected = null; render(root); }),
    grid,
    el('div', { class: 'day-head' }, inMonth ? formatDateLabel(selected) : '日をタップしてね'),
    list.map(e => entryRow(e, state, () => openEditor(e))),
    kuma);
}
