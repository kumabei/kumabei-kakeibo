// Fixed costs (spec: docs/superpowers/specs/2026-10-03-kumabei-kakeibo-fixed-costs-design.md in claude-workspace).
// Pure functions like logic.js: no DOM and no IndexedDB here, everything is unit-tested with `node --test`.
// Months are 'YYYY-MM' strings, so comparing them as strings compares the months.
import { monthOf, addMonths, daysInMonth, formatYen } from './logic.js';

// The payment date in month ym; a day the month doesn't have becomes its last day (spec 4-2).
export function payDate(ym, day) {
  return `${ym}-${String(Math.min(day, daysInMonth(ym))).padStart(2, '0')}`;
}

// The settings order (spec 6-1): earliest day first, then the one registered first.
export function sortFixed(list) {
  return [...list].sort((a, b) => a.day - b.day || a.createdAt - b.createdAt);
}

// The entry marked as fixed cost `fixedId`'s payment for month ym, if any.
export function findMark(entries, fixedId, ym) {
  return entries.find(e => e.fixedId === fixedId && e.fixedMonth === ym);
}

// Spec 5-1: ［もう入れた］ starts next month, ［まだ］ this month. doneThrough is the month before the start.
export function startMonths(today, alreadyEntered) {
  const startMonth = addMonths(monthOf(today), alreadyEntered ? 1 : 0);
  return { startMonth, doneThrough: addMonths(startMonth, -1) };
}

export function newFixed({ name, categoryId, amount, methodId, day }, alreadyEntered, today, id, now) {
  return { id, name, categoryId, amount, methodId, day, hidden: false, ...startMonths(today, alreadyEntered), createdAt: now };
}

// Resuming never goes back for the months it was stopped.
export function resumedFixed(f, alreadyEntered, today) {
  return { ...f, hidden: false, ...startMonths(today, alreadyEntered) };
}

// One row of the settings list: "27日　住宅ローン　85,000円　住居費・カード".
export function fixedRowText(f, categories, methods) {
  const cat = categories.find(c => c.id === f.categoryId);
  const method = methods.find(m => m.id === f.methodId);
  return `${f.day}日　${f.name}　${formatYen(f.amount)}　${cat?.name ?? '（分類なし）'}・${method?.name ?? ''}`;
}

// Spec 4-2. `snapshot` ({ fixed, entries, settings }) must be read inside the same readwrite transaction
// that saves the result (db.update), so a second run sees the first one's writes and records nothing.
// For each running fixed cost, the months after doneThrough up to this month are looked at in order,
// stopping at a payment day still to come. A month with a marked entry is not recorded again.
export function catchUpWrite({ fixed, entries, settings }, today, now, newId) {
  const thisMonth = monthOf(today);
  const newEntries = [];
  const changed = [];
  const recorded = [];
  for (const f of sortFixed(fixed)) {
    if (f.hidden) continue;
    let done = f.doneThrough;
    for (let ym = addMonths(done, 1); ym <= thisMonth; ym = addMonths(ym, 1)) {
      const date = payDate(ym, f.day);
      if (date > today) break;
      if (!findMark(entries, f.id, ym)) {
        const entry = {
          id: newId(), type: 'expense', amount: f.amount, categoryId: f.categoryId, methodId: f.methodId,
          date, memo: f.name, createdAt: now, updatedAt: now, fixedId: f.id, fixedMonth: ym,
        };
        newEntries.push(entry);
        recorded.push({ name: f.name, ym, entry });
      }
      done = ym;
    }
    if (done !== f.doneThrough) changed.push({ ...f, doneThrough: done });
  }
  const put = {};
  if (newEntries.length) put.entries = newEntries;
  if (changed.length) put.fixed = changed;
  // A new entry is a data change (the backup nudge counts it).
  return { put, settings: newEntries.length ? { ...settings, lastChangedAt: now } : null, result: recorded };
}

// Spec 4-2: runs fn (resolving to an array) one call at a time. A call made while it runs does not start
// a second run alongside: fn runs once more afterwards. The first caller gets every result, the others [].
export function oneAtATime(fn) {
  let running = null;
  let again = false;
  return () => {
    if (running) {
      again = true;
      return running.then(() => []);
    }
    running = (async () => {
      const out = [];
      try {
        do {
          again = false;
          out.push(...await fn());
        } while (again);
      } finally {
        running = null;
      }
      return out;
    })();
    return running;
  };
}
