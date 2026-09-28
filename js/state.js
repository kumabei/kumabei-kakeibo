// The data the screens draw from, and every change to it. Changes are saved first, then listeners re-render.
import * as db from './db.js';
import { newCategoryColor } from './logic.js';

export const state = { entries: [], categories: [], methods: [], settings: {} };

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); }
function emit() { listeners.forEach(fn => fn()); }

export async function init() {
  Object.assign(state, await db.loadAll());
  emit();
}

// Any change to entries/categories/methods stamps lastChangedAt (used by the backup nudge).
function stamped(patch = {}) {
  return { ...state.settings, ...patch, lastChangedAt: Date.now() };
}

function nextOrder(list) {
  return list.reduce((max, x) => Math.max(max, x.order), -1) + 1;
}

export async function addEntry({ type, amount, categoryId, methodId, date, memo }) {
  const now = Date.now();
  const entry = {
    id: crypto.randomUUID(), type, amount, categoryId,
    methodId: type === 'expense' ? methodId : null,
    date, memo, createdAt: now, updatedAt: now,
  };
  const settings = stamped(type === 'expense' ? { lastMethodId: methodId } : {});
  await db.write({ put: { entries: [entry] }, settings });
  state.entries = [...state.entries, entry];
  state.settings = settings;
  emit();
  return entry;
}

export async function updateEntry(entry) {
  const next = { ...entry, methodId: entry.type === 'expense' ? entry.methodId : null, updatedAt: Date.now() };
  const settings = stamped();
  await db.write({ put: { entries: [next] }, settings });
  state.entries = state.entries.map(e => (e.id === next.id ? next : e));
  state.settings = settings;
  emit();
  return next;
}

export async function removeEntry(id) {
  const settings = stamped();
  await db.write({ del: { entries: [id] }, settings });
  state.entries = state.entries.filter(e => e.id !== id);
  state.settings = settings;
  emit();
}

// storeName: 'categories' | 'methods'. Adds the item or replaces the one with the same id.
export async function saveItem(storeName, item) {
  const settings = stamped();
  await db.write({ put: { [storeName]: [item] }, settings });
  const list = state[storeName];
  state[storeName] = list.some(x => x.id === item.id) ? list.map(x => (x.id === item.id ? item : x)) : [...list, item];
  state.settings = settings;
  emit();
  return item;
}

export function addCategory(type, name) {
  const order = nextOrder(state.categories.filter(c => c.type === type));
  return saveItem('categories', { id: `c-${crypto.randomUUID()}`, type, name, order, hidden: false, color: newCategoryColor(type) });
}

export function addMethod(name) {
  return saveItem('methods', { id: `m-${crypto.randomUUID()}`, name, order: nextOrder(state.methods), hidden: false });
}

// ids: the new order of one list (e.g. the expense categories). Each item gets order = its index.
export async function reorderItems(storeName, ids) {
  const items = ids.map((id, order) => ({ ...state[storeName].find(x => x.id === id), order }));
  const settings = stamped();
  await db.write({ put: { [storeName]: items }, settings });
  const byId = new Map(items.map(x => [x.id, x]));
  state[storeName] = state[storeName].map(x => byId.get(x.id) ?? x);
  state.settings = settings;
  emit();
}

// Settings-only changes (last backup time, "later") do not count as data changes.
export async function updateSettings(patch) {
  const settings = { ...state.settings, ...patch };
  await db.write({ settings });
  state.settings = settings;
  emit();
}

export async function replaceAllData(data) {
  await db.replaceAll(data);
  Object.assign(state, structuredClone(data));
  emit();
}
