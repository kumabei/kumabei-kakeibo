// IndexedDB access. Stores: entries, categories, methods (keyPath id) and settings (one record, key 'main').
import { initialCategories, initialMethods, initialSettings } from './logic.js';

const DB_NAME = 'kumabei-kakeibo';
const DB_VERSION = 1;
const LISTS = ['entries', 'categories', 'methods'];
const ALL = [...LISTS, 'settings'];

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of LISTS) req.result.createObjectStore(name, { keyPath: 'id' });
      req.result.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// Runs fn(stores) in one transaction and resolves with its return value once committed.
async function run(names, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    const stores = Object.fromEntries(names.map(n => [n, t.objectStore(n)]));
    const out = fn(stores);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function loadAll() {
  const reqs = await run(ALL, 'readonly', s => ({
    entries: s.entries.getAll(),
    categories: s.categories.getAll(),
    methods: s.methods.getAll(),
    settings: s.settings.get('main'),
  }));
  if (!reqs.settings.result) {
    const seeded = { entries: [], categories: initialCategories(), methods: initialMethods(), settings: initialSettings() };
    await replaceAll(seeded);
    return seeded;
  }
  const { key, ...settings } = reqs.settings.result;
  return { entries: reqs.entries.result, categories: reqs.categories.result, methods: reqs.methods.result, settings };
}

// put: { storeName: items[] }, del: { storeName: ids[] }, settings: the whole settings object.
export function write({ put = {}, del = {}, settings = null }) {
  const names = [...new Set([...Object.keys(put), ...Object.keys(del), ...(settings ? ['settings'] : [])])];
  return run(names, 'readwrite', s => {
    for (const [name, items] of Object.entries(put)) items.forEach(x => s[name].put(x));
    for (const [name, ids] of Object.entries(del)) ids.forEach(id => s[name].delete(id));
    if (settings) s.settings.put({ key: 'main', ...settings });
  });
}

export function replaceAll(data) {
  return run(ALL, 'readwrite', s => {
    for (const name of LISTS) {
      s[name].clear();
      data[name].forEach(x => s[name].put(x));
    }
    s.settings.clear();
    s.settings.put({ key: 'main', ...data.settings });
  });
}
