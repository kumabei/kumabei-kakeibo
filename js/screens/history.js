// History: the month's entries, newest first. Tap a row to edit or delete it.
import { state } from '../state.js';
import { todayStr, monthOf, entriesInMonth, sortNewestFirst } from '../logic.js';
import { SCENES, renderKuma } from '../kuma.js';
import { el, setChildren, monthNav, entryRow } from '../ui.js';
import { openEditor } from './input.js';

let ym = null;

export function render(root, { entering = false } = {}) {
  if (entering || !ym) ym = monthOf(todayStr());
  const list = sortNewestFirst(entriesInMonth(state.entries, ym));
  const kuma = el('div', { class: 'kuma kuma-small' });
  renderKuma(kuma, list.length ? { image: SCENES.peek.image } : SCENES.empty);
  setChildren(root,
    monthNav(ym, next => { ym = next; render(root); }),
    list.map(e => entryRow(e, state, () => openEditor(e), { showDate: true })),
    kuma);
}
