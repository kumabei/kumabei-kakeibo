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
