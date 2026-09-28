// Small DOM helpers shared by the screens.
import { addMonths, formatMonthLabel } from './logic.js';
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
