// IndexedDB access. Stores: entries, categories, methods, fixed (keyPath id) and settings (one record, key 'main').
import { initialCategories, initialMethods, initialSettings } from './logic.js';

const DB_NAME = 'kumabei-kakeibo';
const DB_VERSION = 2; // 2: the fixed store (Ver.1.1.0)
const LISTS = ['entries', 'categories', 'methods', 'fixed'];
const ALL = [...LISTS, 'settings'];

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = req.result;
      if (e.oldVersion < 1) {
        for (const name of ['entries', 'categories', 'methods']) db.createObjectStore(name, { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (e.oldVersion < 2) db.createObjectStore('fixed', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      req.result.onclose = () => { dbPromise = null; };
      // A newer version opened elsewhere: let it upgrade instead of blocking it.
      req.result.onversionchange = () => { req.result.close(); dbPromise = null; };
      resolve(req.result);
    };
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
    t.onerror = () => reject(t.error ?? new Error('保存に失敗しました'));
    t.onabort = () => reject(t.error ?? new Error('保存に失敗しました'));
    let out;
    try {
      out = fn(stores);
    } catch (e) {
      try { t.abort(); } catch {}
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(out);
  });
}

export async function loadAll() {
  const reqs = await run(ALL, 'readonly', s => ({
    entries: s.entries.getAll(),
    categories: s.categories.getAll(),
    methods: s.methods.getAll(),
    fixed: s.fixed.getAll(),
    settings: s.settings.get('main'),
  }));
  if (!reqs.settings.result) {
    const seeded = { entries: [], categories: initialCategories(), methods: initialMethods(), fixed: [], settings: initialSettings() };
    await replaceAll(seeded);
    return seeded;
  }
  const { key, ...settings } = reqs.settings.result;
  return {
    entries: reqs.entries.result, categories: reqs.categories.result, methods: reqs.methods.result,
    fixed: reqs.fixed.result, settings,
  };
}

// put: { storeName: items[] }, del: { storeName: ids[] }, settings: the whole settings object.
export function write({ put = {}, del = {}, settings = null }) {
  const names = [...new Set([...Object.keys(put), ...Object.keys(del), ...(settings ? ['settings'] : [])])];
  return run(names, 'readwrite', s => {
    for (const [name, items] of Object.entries(put)) items.forEach(x => s[name].put(x));
    for (const [name, ids] of Object.entries(del)) ids.forEach(id => s[name].delete(id));
    if (settings) s.settings.put({ ...settings, key: 'main' });
  });
}

// Reads every item of the stores in `names` and the settings, then writes what decide(snapshot) returns
// ({ put, del, settings }), all in one readwrite transaction: nothing can change the data between the
// read and the write, and transactions on the same stores run one after another (fixed costs spec 4-2).
// Resolves with decide's return value once committed.
export async function update(names, decide) {
  const db = await open();
  const scope = [...names, 'settings'];
  return new Promise((resolve, reject) => {
    const t = db.transaction(scope, 'readwrite');
    const s = Object.fromEntries(scope.map(n => [n, t.objectStore(n)]));
    t.onerror = () => reject(t.error ?? new Error('保存に失敗しました'));
    t.onabort = () => reject(t.error ?? new Error('保存に失敗しました'));
    const reads = names.map(n => [n, s[n].getAll()]);
    const settingsReq = s.settings.get('main');
    let out;
    // Requests in one transaction complete in the order they were made, so every read is done here.
    settingsReq.onsuccess = () => {
      try {
        const { key, ...settings } = settingsReq.result ?? {};
        out = decide({ ...Object.fromEntries(reads.map(([n, r]) => [n, r.result])), settings });
        for (const [name, items] of Object.entries(out.put ?? {})) items.forEach(x => s[name].put(x));
        for (const [name, ids] of Object.entries(out.del ?? {})) ids.forEach(id => s[name].delete(id));
        if (out.settings) s.settings.put({ ...out.settings, key: 'main' });
      } catch (e) {
        try { t.abort(); } catch {}
        reject(e);
      }
    };
    t.oncomplete = () => resolve(out);
  });
}

export function replaceAll(data) {
  return run(ALL, 'readwrite', s => {
    for (const name of LISTS) {
      s[name].clear();
      data[name].forEach(x => s[name].put(x));
    }
    s.settings.clear();
    s.settings.put({ ...data.settings, key: 'main' });
  });
}
