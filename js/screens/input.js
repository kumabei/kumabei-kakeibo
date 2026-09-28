import { el } from '../ui.js';

export function render(root) {
  root.replaceChildren(el('p', { class: 'muted' }, '準備中'));
}
