// Which report the home screen shows, and how it moves (Ver.1.2.0 spec 3, 8). Pure: every function takes
// a view and returns a new one. home.js keeps the current view and draws it.
//
// view = { kind: 'month' | 'year' | 'categoryYear' | 'entries', ym: 'YYYY-MM', year: number,
//          type: 'expense' | 'income', categoryId: string | null, stack: [{ view, scrollY }] }
// stack holds where ＜戻る goes back to, newest last (at most 2: year → categoryYear → entries).
import { monthOf, addMonths } from './logic.js';

const yearOf = dateStr => Number(dateStr.slice(0, 4));

// Spec 8: the home tab always starts at this month, expenses.
export function startView(today) {
  return { kind: 'month', ym: monthOf(today), year: yearOf(today), type: 'expense', categoryId: null, stack: [] };
}

// Spec 3: the month shown when switching from a year — this month for this year, December for a past
// year, January for a future year.
export function monthForYear(year, today) {
  const thisYear = yearOf(today);
  if (year === thisYear) return monthOf(today);
  return year < thisYear ? `${year}-12` : `${year}-01`;
}

// ［月｜年］. Only shown on the month and year views.
export function switchSpan(view, kind, today) {
  if (kind === view.kind) return view;
  return kind === 'year'
    ? { ...view, kind, year: yearOf(view.ym) }
    : { ...view, kind, ym: monthForYear(view.year, today) };
}

// ＜ ＞ on the month or the year view.
export function step(view, n) {
  return view.kind === 'month' ? { ...view, ym: addMonths(view.ym, n) } : { ...view, year: view.year + n };
}

// ［支出｜収入］
export function setType(view, type) {
  return { ...view, type };
}

function push(view, scrollY, patch) {
  const { stack, ...here } = view;
  return { ...here, ...patch, stack: [...stack, { view: here, scrollY }] };
}

// Year view → one category's year. scrollY is where the year view was, for ＜戻る.
export function openCategoryYear(view, categoryId, scrollY) {
  return push(view, scrollY, { kind: 'categoryYear', categoryId });
}

// Month view or category's year → the entries of one category in one month.
export function openEntries(view, categoryId, ym, scrollY) {
  return push(view, scrollY, { kind: 'entries', categoryId, ym });
}

// ＜戻る: the view it came from, and the scroll position to put back.
export function back(view) {
  const frame = view.stack.at(-1);
  return { view: { ...frame.view, stack: view.stack.slice(0, -1) }, scrollY: frame.scrollY };
}

// Spec 5-1: a bar of the year chart → that month's month view.
export function pickMonth(view, ym) {
  return { ...view, kind: 'month', ym, categoryId: null, stack: [] };
}
