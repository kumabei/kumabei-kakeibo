// The data the screens draw from, and every change to it. Changes are saved first, then listeners re-render.
import * as db from './db.js';
import { newCategoryColor, migrateData, todayStr } from './logic.js';
import { catchUpWrite, fixedEntryWrite, oneAtATime } from './fixed.js';

export const state = { entries: [], categories: [], methods: [], fixed: [], settings: {} };

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); }
function emit() { listeners.forEach(fn => fn()); }

export async function init() {
  const loaded = await db.loadAll();
  const data = migrateData(loaded);
  // Fixed costs spec 7, once per data set. Not a data change, so lastChangedAt is not stamped.
  if (data !== loaded) await db.write({ put: { categories: data.categories }, settings: data.settings });
  Object.assign(state, data);
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
  state.entries = state.entries.some(e => e.id === next.id)
    ? state.entries.map(e => (e.id === next.id ? next : e))
    : [...state.entries, next];
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

// storeName: 'categories' | 'methods' | 'fixed'. Adds the item or replaces the one with the same id.
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

// A fixed cost added, edited, stopped (hidden), resumed or deleted (only marked: see deletedFixed in fixed.js).
export function saveFixed(f) {
  return saveItem('fixed', f);
}

function mergeById(list, items) {
  const known = new Set(list.map(x => x.id));
  const byId = new Map(items.map(x => [x.id, x]));
  return [...list.map(x => byId.get(x.id) ?? x), ...items.filter(x => !known.has(x.id))];
}

// Saves what decide (a fixed.js *Write function) makes of the stored data, read in the same transaction.
async function applyUpdate(decide) {
  const w = await db.update(['fixed', 'entries'], decide);
  const put = Object.entries(w.put ?? {});
  for (const [name, items] of put) state[name] = mergeById(state[name], items);
  if (w.settings) state.settings = w.settings;
  if (put.length || w.settings) emit();
  return w.result;
}

// Fixed costs spec 4-2: records every fixed cost that is due and resolves with what was recorded.
// One run at a time; a call made meanwhile runs once afterwards.
export const catchUpFixed = oneAtATime(() =>
  applyUpdate(snap => catchUpWrite(snap, todayStr(), Date.now(), () => crypto.randomUUID())));

// Fixed costs spec 5-2 ［固定費の分として記録］.
export function addFixedEntry(draft, fixedId) {
  return applyUpdate(snap => fixedEntryWrite(snap, draft, fixedId, Date.now(), () => crypto.randomUUID()));
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

// A backup of version 1 gets the fixed costs spec 7 change before it is saved, all in one go.
export async function replaceAllData(data) {
  const next = migrateData(data);
  await db.replaceAll(next);
  Object.assign(state, structuredClone(next));
  emit();
}
