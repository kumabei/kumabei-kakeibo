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

// In-app text dialog. focus() runs synchronously inside the tap handler, so iOS shows the
// keyboard at once (prompt() on iOS only shows the keyboard after the field is tapped again).
// Call askText() synchronously as the first thing in the click handler, before any await.
export function askText(title, initial = '') {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(value);
    };
    const input = el('input', {
      type: 'text', class: 'dialog-input', value: initial, enterkeyhint: 'done',
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim() || null); } },
    });
    const backdrop = el('div', { class: 'dialog-backdrop' },
      el('div', { class: 'dialog' },
        el('div', { class: 'dialog-title' }, title),
        input,
        el('div', { class: 'dialog-actions' },
          el('button', { class: 'dialog-btn', onclick: () => finish(null) }, 'キャンセル'),
          el('button', { class: 'dialog-btn primary', onclick: () => finish(input.value.trim() || null) }, 'OK'))));
    document.body.append(backdrop);
    input.focus();
    input.select();
  });
}

// Kumabee asks with a speech bubble and buttons (fixed costs spec 5-1, 5-2). Resolves with the value
// of the tapped button. choices: [[value, label], …]; the first one is the suggested answer.
export function askChoice(image, line, choices) {
  return new Promise(resolve => {
    const backdrop = el('div', { class: 'dialog-backdrop' },
      el('div', { class: 'dialog' },
        el('div', { class: 'kuma kuma-ask' },
          el('div', { class: 'bubble' }, line),
          el('img', { src: imageSrc(image), alt: '' })),
        el('div', { class: 'ask-actions' }, choices.map(([value, label], i) =>
          el('button', {
            class: 'dialog-btn' + (i === 0 ? ' primary' : ''),
            onclick: () => { backdrop.remove(); resolve(value); },
          }, label)))));
    document.body.append(backdrop);
  });
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
// The DOM order is never changed while dragging (iOS loses the pointer if a row is moved
// under the finger): rows only get a CSS transform, and the real reorder happens once at the end.
export function makeSortable(listEl, onDone) {
  const ids = () => [...listEl.querySelectorAll('[data-id]')].map(r => r.dataset.id);

  // Stop the page from scrolling while a drag is in progress (iOS still sends touch events
  // alongside pointer events, and a page scroll would fight with the drag).
  listEl.addEventListener('touchmove', ev => {
    if (ev.target.closest('.drag-handle')) ev.preventDefault();
  }, { passive: false });

  listEl.addEventListener('pointerdown', ev => {
    const handle = ev.target.closest('.drag-handle');
    if (!handle) return;
    ev.preventDefault();
    const row = handle.closest('[data-id]');
    const startY = ev.clientY;
    const before = ids();
    const rows = [...listEl.querySelectorAll('[data-id]')];
    const startIndex = rows.indexOf(row);
    const rects = rows.map(r => r.getBoundingClientRect());
    const rowHeight = rects[startIndex].height;
    let targetIndex = startIndex;
    let ended = false;

    row.classList.add('dragging');
    listEl.classList.add('sorting');

    const move = e => {
      const dy = e.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      const center = rects[startIndex].top + rowHeight / 2 + dy;
      // The target index is whichever row's start-center is closest to the dragged row's current center.
      targetIndex = rects.reduce((best, r, i) => {
        const rowCenter = r.top + r.height / 2;
        const bestCenter = rects[best].top + rects[best].height / 2;
        return Math.abs(center - rowCenter) < Math.abs(center - bestCenter) ? i : best;
      }, 0);

      rows.forEach((r, i) => {
        if (i === startIndex) return;
        if (targetIndex === startIndex) { r.style.transform = ''; return; }
        const inRange = targetIndex > startIndex
          ? i > startIndex && i <= targetIndex
          : i >= targetIndex && i < startIndex;
        r.style.transform = inRange ? `translateY(${targetIndex > startIndex ? -rowHeight : rowHeight}px)` : '';
      });
    };

    const end = cancelled => {
      if (ended) return;
      ended = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      row.classList.remove('dragging');
      listEl.classList.remove('sorting');
      rows.forEach(r => { r.style.transform = ''; });
      if (cancelled) return;
      if (targetIndex === startIndex) return;
      const reordered = rows.filter((_, i) => i !== startIndex);
      reordered.splice(targetIndex, 0, row);
      const after = reordered.map(r => r.dataset.id);
      if (after.join() !== before.join()) onDone(after);
    };
    const up = () => end(false);
    const cancel = () => end(true);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
}
