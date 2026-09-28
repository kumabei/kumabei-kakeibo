// Small DOM helpers shared by the screens.
import { addMonths, formatMonthLabel, colorOf, formatYen, formatDateShort, memoHead } from './logic.js';
import { imageSrc } from './kuma.js';

// el('button', { class: 'x', onclick: fn }, 'text', child). Strings become text nodes (never HTML).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}

// replaceChildren that, like el(), flattens arrays and skips null/false children.
export function setChildren(node, ...children) {
  node.replaceChildren(...children.flat().filter(c => c != null && c !== false));
}

let toastTimer = null;

export function showToast(text, { actionLabel = null, onAction = null, image = null, ms = 5000 } = {}) {
  const box = document.getElementById('toast');
  box.replaceChildren(...[
    image && el('img', { src: imageSrc(image), alt: '' }),
    el('span', { class: 'toast-text' }, text),
    actionLabel && el('button', { class: 'toast-action', onclick: () => { hideToast(); onAction(); } }, actionLabel),
  ].filter(Boolean));
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}

export function hideToast() {
  clearTimeout(toastTimer);
  document.getElementById('toast').hidden = true;
}

export function openSheet(content) {
  const sheet = document.getElementById('sheet');
  sheet.replaceChildren(content);
  sheet.hidden = false;
}

export function closeSheet() {
  const sheet = document.getElementById('sheet');
  sheet.hidden = true;
  sheet.replaceChildren();
}

export function monthNav(ym, onChange) {
  return el('div', { class: 'month-nav' },
    el('button', { class: 'nav-btn', 'aria-label': '前の月', onclick: () => onChange(addMonths(ym, -1)) }, '‹'),
    el('span', { class: 'month-label' }, formatMonthLabel(ym)),
    el('button', { class: 'nav-btn', 'aria-label': '次の月', onclick: () => onChange(addMonths(ym, 1)) }, '›'));
}

// One entry in a list (calendar and history). The dot has the category's color.
export function entryRow(entry, { categories, methods }, onTap, { showDate = false } = {}) {
  const cat = categories.find(c => c.id === entry.categoryId);
  const method = methods.find(m => m.id === entry.methodId);
  const income = entry.type === 'income';
  const sub = (income ? '収入' : method?.name ?? '') + (entry.memo ? '・' + memoHead(entry.memo) : '');
  return el('button', { class: 'entry-row', onclick: onTap },
    el('span', { class: 'dot', style: `background:${colorOf(cat).strong}` }),
    el('span', { class: 'entry-main' },
      el('span', { class: 'entry-cat' }, (showDate ? formatDateShort(entry.date) + ' ' : '') + (cat?.name ?? '（分類なし）')),
      el('span', { class: 'entry-sub' }, sub)),
    el('span', { class: 'entry-amount' + (income ? ' income' : '') }, (income ? '+' : '') + formatYen(entry.amount)));
}

// Drag-to-reorder for a vertical list. Rows carry data-id; dragging starts on .drag-handle.
export function makeSortable(listEl, onDone) {
  listEl.addEventListener('pointerdown', ev => {
    const handle = ev.target.closest('.drag-handle');
    if (!handle) return;
    ev.preventDefault();
    const row = handle.closest('[data-id]');
    row.classList.add('dragging');
    handle.setPointerCapture(ev.pointerId);
    const move = e => {
      const others = [...listEl.querySelectorAll('[data-id]')].filter(r => r !== row);
      const before = others.find(r => e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
      listEl.insertBefore(row, before ?? null);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      row.classList.remove('dragging');
      onDone([...listEl.querySelectorAll('[data-id]')].map(r => r.dataset.id));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}
