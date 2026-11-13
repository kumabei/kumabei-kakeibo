// Settings: categories and payment methods (add, rename, reorder, hide, delete) and the backup.
import { state, saveItem, removeItem, reorderItems, addCategory, addMethod } from '../state.js';
import { allSorted, canHide, canDelete, colorOf, formatDateTime } from '../logic.js';
import { el, setChildren, makeSortable, showToast, askText, askIcon, askChoice } from '../ui.js';
import { iconOf, iconSvg } from '../icons.js';
import { exportBackup, importBackup } from '../backup.js';
import { show, rerender } from '../nav.js';
import { VERSION } from '../version.js';
import { SCENES, FIXED_ASK_IMAGE, renderKuma } from '../kuma.js';
import { LINES } from '../lines.js';
import { fixedSection } from './fixed.js';

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

// Ver.1.4.1: a hidden item can be deleted only when nothing points at it (canDelete). Kumabee asks first;
// ［やめる］ is the suggested answer.
async function removeHidden(storeName, item) {
  const ok = await askChoice(FIXED_ASK_IMAGE, LINES.deleteItem.replace('{name}', item.name),
    [[false, 'やめる'], [true, '削除する']]);
  if (ok) await guarded(() => removeItem(storeName, item.id));
}

function itemRow(storeName, item) {
  const deletable = canDelete(storeName, item, state.entries, state.fixed);
  return el('div', { class: 'item-row' + (item.hidden ? ' hidden-item' : ''), 'data-id': item.id },
    item.hidden ? null : el('span', { class: 'drag-handle', 'aria-label': '並べ替え' }, '≡'),
    storeName === 'categories'
      ? el('span', { class: 'item-icon', style: `--ink:${colorOf(item).ink}` }, iconSvg(iconOf(item)))
      : null,
    el('span', { class: 'item-name' }, item.name),
    item.hidden ? null : el('button', {
      class: 'small',
      onclick: () => guarded(async () => { const name = await askText('名前を入れてね', item.name); if (name) await saveItem(storeName, { ...item, name }); }),
    }, '名前'),
    storeName === 'categories' && !item.hidden
      ? el('button', {
        class: 'small',
        onclick: () => guarded(async () => { const icon = await askIcon(iconOf(item)); if (icon) await saveItem(storeName, { ...item, icon }); }),
      }, '絵')
      : null,
    el('button', { class: 'small', onclick: () => toggleHidden(storeName, item) }, item.hidden ? '表示する' : 'かくす'),
    deletable ? el('button', { class: 'small danger', onclick: () => removeHidden(storeName, item) }, '削除') : null);
}

// Which folded lists of hidden items are open. Opening the settings screen starts with all of them closed.
const opened = new Set();

// Ver.1.4.1: the shown items can be reordered; hidden ones are folded away under the list, where they can
// be shown again or, when nothing uses them, deleted.
function section(title, storeName, items, add, noun) {
  const sorted = allSorted(items);
  const hidden = sorted.filter(item => item.hidden);
  const list = el('div', { class: 'item-list' }, sorted.filter(item => !item.hidden).map(item => itemRow(storeName, item)));
  makeSortable(list, ids => guarded(() => reorderItems(storeName, [...ids, ...hidden.map(item => item.id)])));
  const key = title;
  return el('section', { class: 'card' },
    el('div', { class: 'card-title' }, title),
    list,
    el('button', { class: 'add', onclick: () => guarded(async () => { const name = await askText('名前を入れてね'); if (name) await add(name); }) }, '＋ 追加'),
    hidden.length
      ? el('details', {
        class: 'hidden-items', open: opened.has(key),
        ontoggle: e => (e.target.open ? opened.add(key) : opened.delete(key)),
      },
      el('summary', {}, `かくした${noun}（${hidden.length}）`),
      hidden.map(item => itemRow(storeName, item)),
      hidden.some(item => !canDelete(storeName, item, state.entries, state.fixed))
        ? el('div', { class: 'muted hidden-note' }, `記録や固定費で使っている${noun}は削除できません（かくしたままにできます）`)
        : null)
      : null);
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

export function render(root, { entering } = {}) {
  if (entering) opened.clear();
  const kuma = el('div', { class: 'kuma kuma-small' });
  setChildren(root,
    el('div', { class: 'settings-head' },
      el('button', { class: 'link', onclick: () => show('home') }, '‹ もどる'),
      el('h1', {}, '設定')),
    section('支出の分類', 'categories', state.categories.filter(c => c.type === 'expense'), async name => addCategory('expense', name, await askIcon(null, 'あとで')), '分類'),
    section('収入の分類', 'categories', state.categories.filter(c => c.type === 'income'), async name => addCategory('income', name, await askIcon(null, 'あとで')), '分類'),
    section('支払い方法', 'methods', state.methods, name => addMethod(name), '支払い方法'),
    fixedSection(),
    backupSection(),
    kuma,
    el('div', { class: 'version' }, `バージョン ${VERSION}`));
  renderKuma(kuma, { image: SCENES.peek.image });
}
