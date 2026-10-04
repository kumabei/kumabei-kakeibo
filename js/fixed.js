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

// Spec 5-2: when an expense is typed in with the same category and amount as a running fixed cost
// (the first one in the settings order), from its start month on. The day is not looked at.
export function manualCheck(fixedList, entries, draft) {
  if (draft.type !== 'expense') return null;
  const ym = monthOf(draft.date);
  const f = sortFixed(fixedList).find(x => !x.hidden && x.categoryId === draft.categoryId
    && x.amount === draft.amount && ym >= x.startMonth);
  if (!f) return null;
  if (findMark(entries, f.id, ym)) return { kind: 'recorded', fixed: f, ym };
  return { kind: ym > f.doneThrough ? 'new' : 'deleted', fixed: f, ym };
}

// Spec 5-2 ［固定費の分として記録］: the entry as typed, marked as the fixed cost's payment for its month.
// Like catchUpWrite, decided from what is stored inside the saving transaction.
export function fixedEntryWrite({ fixed, entries, settings }, draft, fixedId, now, newId) {
  const f = fixed.find(x => x.id === fixedId);
  const ym = monthOf(draft.date);
  // Already marked meanwhile (recorded automatically while Kumabee was asking): record it plainly.
  const mark = Boolean(f) && !findMark(entries, fixedId, ym);
  const entry = {
    id: newId(), type: 'expense', amount: draft.amount, categoryId: draft.categoryId, methodId: draft.methodId,
    date: draft.date, memo: draft.memo, createdAt: now, updatedAt: now,
    ...(mark ? { fixedId, fixedMonth: ym } : {}),
  };
  const put = { entries: [entry] };
  // Only the next month moves doneThrough: a month further ahead would skip the months between.
  // (Its mark already keeps that month from being recorded again.)
  if (mark && ym === addMonths(f.doneThrough, 1)) put.fixed = [{ ...f, doneThrough: ym }];
  return { put, settings: { ...settings, lastMethodId: draft.methodId, lastChangedAt: now }, result: entry };
}

// Spec 4-3: the confirmation shown instead of "この記録を消しますか？" for an entry of a fixed cost.
export function deleteConfirmText(entry, fixedList) {
  const name = fixedList.find(f => f.id === entry.fixedId)?.name ?? entry.memo;
  return `毎月の固定費（${name}）の${Number(entry.fixedMonth.slice(5))}月分です。消すと、この月はもう自動では入りません。消しますか？`;
}
