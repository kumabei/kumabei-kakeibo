// Settings: categories and payment methods (add, rename, reorder, hide) and the backup.
import { state, saveItem, reorderItems, addCategory, addMethod } from '../state.js';
import { allSorted, canHide, colorOf, formatDateTime } from '../logic.js';
import { el, setChildren, makeSortable, showToast } from '../ui.js';
import { exportBackup, importBackup } from '../backup.js';
import { show, rerender } from '../nav.js';
import { VERSION } from '../version.js';

function askName(current = '') {
  return prompt('名前を入れてね', current)?.trim() || null;
}

// Runs a data change; a failed save is shown instead of being lost silently, and the
// screen is redrawn from state so a visually-moved-but-unsaved row doesn't linger.
async function guarded(change) {
  try { await change(); } catch (e) { showToast('保存できませんでした：' + e.message); rerender(); }
}

async function toggleHidden(storeName, item) {
  if (!item.hidden && storeName === 'methods' && !canHide(state.methods, item.id)) {
    showToast('支払い方法は1つ以上必要だよ');
    return;
  }
  await guarded(() => saveItem(storeName, { ...item, hidden: !item.hidden }));
}

// Hidden items stay in the list (greyed) so they can be shown again; nothing is ever deleted.
function section(title, storeName, items, add) {
  const list = el('div', { class: 'item-list' }, allSorted(items).map(item =>
    el('div', { class: 'item-row' + (item.hidden ? ' hidden-item' : ''), 'data-id': item.id },
      el('span', { class: 'drag-handle', 'aria-label': '並べ替え' }, '≡'),
      storeName === 'categories' ? el('span', { class: 'dot', style: `background:${colorOf(item).strong}` }) : null,
      el('span', { class: 'item-name' }, item.name),
      el('button', {
        class: 'small',
        onclick: () => guarded(async () => { const name = askName(item.name); if (name) await saveItem(storeName, { ...item, name }); }),
      }, '名前'),
      el('button', { class: 'small', onclick: () => toggleHidden(storeName, item) }, item.hidden ? '表示する' : 'かくす'))));
  makeSortable(list, ids => guarded(() => reorderItems(storeName, ids)));
  return el('section', { class: 'card' },
    el('div', { class: 'card-title' }, title),
    list,
    el('button', { class: 'add', onclick: () => guarded(async () => { const name = askName(); if (name) await add(name); }) }, '＋ 追加'));
}

function backupSection() {
  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) await importBackup(file);
    },
  });
  const last = state.settings.lastBackupAt;
  return el('section', { class: 'card' },
    el('div', { class: 'card-title' }, 'バックアップ'),
    el('div', { class: 'muted' }, last ? `最後に書き出した日時：${formatDateTime(last)}` : 'まだ書き出していません'),
    el('button', { class: 'wide', onclick: () => exportBackup() }, 'バックアップを書き出す'),
    el('button', { class: 'wide', onclick: () => fileInput.click() }, 'バックアップから戻す'),
    fileInput);
}

export function render(root) {
  setChildren(root,
    el('div', { class: 'settings-head' },
      el('button', { class: 'link', onclick: () => show('home') }, '‹ もどる'),
      el('h1', {}, '設定')),
    section('支出の分類', 'categories', state.categories.filter(c => c.type === 'expense'), name => addCategory('expense', name)),
    section('収入の分類', 'categories', state.categories.filter(c => c.type === 'income'), name => addCategory('income', name)),
    section('支払い方法', 'methods', state.methods, name => addMethod(name)),
    backupSection(),
    el('div', { class: 'version' }, `バージョン ${VERSION}`));
}
