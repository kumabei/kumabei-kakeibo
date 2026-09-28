// Pure functions shared by the screens. No DOM and no IndexedDB here:
// everything in this file is unit-tested with `node --test`.

// ---- dates: 'YYYY-MM-DD' strings in local time ----

const pad2 = n => String(n).padStart(2, '0');
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function isMonthEdge(dateStr) {
  const day = Number(dateStr.slice(8));
  return day === 1 || day === daysInMonth(monthOf(dateStr));
}

// Month grid starting on Sunday; null fills the cells outside the month.
export function calendarCells(ym) {
  const [y, m] = ym.split('-').map(Number);
  const cells = Array(new Date(y, m - 1, 1).getDay()).fill(null);
  for (let d = 1; d <= daysInMonth(ym); d++) cells.push(`${ym}-${pad2(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}

export function formatDateLabel(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

export function formatDateShort(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function formatDateTime(ms) {
  const d = new Date(ms);
  return `${formatDateLabel(toDateStr(d))} ${d.getHours()}:${pad2(d.getMinutes())}`;
}

// ---- money and text ----

export function formatNumber(n) {
  return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatYen(n) {
  return formatNumber(n) + '円';
}

export function memoHead(memo, n = 12) {
  return memo.length > n ? memo.slice(0, n) + '…' : memo;
}

// ---- keypad ----

export const MAX_DIGITS = 8;

// amountStr holds digits without leading zeros; '' means 0 yen.
export function applyKey(amountStr, key) {
  if (key === 'clear') return '';
  if (key === 'back') return amountStr.slice(0, -1);
  if (!/^(\d|00)$/.test(key)) return amountStr;
  const next = (amountStr + key).replace(/^0+/, '');
  return next.length > MAX_DIGITS ? amountStr : next;
}

export function amountValue(amountStr) {
  return amountStr === '' ? 0 : Number(amountStr);
}

// ---- initial data, colors and ordering ----

export const SCHEMA_VERSION = 1;

// Pastel colors per group of categories (spec 5). bg = button, strong = selected button and dots.
export const COLORS = {
  food:    { bg: '#dff3e0', strong: '#9fd4a3' },
  outing:  { bg: '#ffe6cc', strong: '#f5b77a' },
  living:  { bg: '#dcebfa', strong: '#93bde8' },
  family:  { bg: '#fde0ea', strong: '#f2a3bd' },
  move:    { bg: '#ececec', strong: '#b5b5b5' },
  medical: { bg: '#fbd9d9', strong: '#ee9a9a' },
  monthly: { bg: '#ebe0f5', strong: '#c0a4e0' },
  other:   { bg: '#f3ebdd', strong: '#d4bf98' },
  income:  { bg: '#fff4c2', strong: '#f0d468' },
};

const EXPENSE_DEFAULTS = [
  ['食費', 'food'], ['外食', 'outing'], ['おやつ', 'food'], ['日用品', 'living'], ['服', 'family'],
  ['子供', 'family'], ['教育費', 'family'], ['交際費', 'outing'], ['車', 'move'], ['ガソリン', 'move'],
  ['交通費', 'move'], ['イベント・レジャー', 'outing'], ['医療費', 'medical'], ['通信費', 'monthly'],
  ['光熱費', 'monthly'], ['住居費', 'monthly'], ['家具・家電', 'living'], ['お小遣い', 'family'],
  ['固定費', 'monthly'], ['雑費', 'other'],
];

export function initialCategories() {
  return EXPENSE_DEFAULTS.map(([name, color], i) =>
    ({ id: `e${pad2(i + 1)}`, type: 'expense', name, order: i, hidden: false, color }));
}

export function initialMethods() {
  return ['現金', 'カード', '電子マネー'].map((name, i) => ({ id: `m${i + 1}`, name, order: i, hidden: false }));
}

export function initialSettings() {
  return { lastMethodId: 'm1', lastBackupAt: null, lastChangedAt: null, nudgeSnoozedOn: null, schemaVersion: SCHEMA_VERSION };
}

export function newCategoryColor(type) {
  return type === 'income' ? 'income' : 'other';
}

export function colorOf(category) {
  return COLORS[category?.color] ?? COLORS.other;
}

export function allSorted(list) {
  return [...list].sort((a, b) => a.order - b.order);
}

export function visibleSorted(list) {
  return allSorted(list).filter(x => !x.hidden);
}

// Visible items, plus the current one if it has been hidden since (editing an old entry).
export function listWithCurrent(list, currentId) {
  const visible = visibleSorted(list);
  const current = list.find(x => x.id === currentId);
  return current && current.hidden ? [...visible, current] : visible;
}

export function pickDefaultMethod(methods, lastMethodId) {
  const visible = visibleSorted(methods);
  return (visible.find(m => m.id === lastMethodId) ?? visible[0])?.id ?? null;
}

export function canHide(list, id) {
  return list.some(x => !x.hidden && x.id !== id);
}

// ---- totals (always computed from entries; nothing is stored) ----

export function entriesInMonth(entries, ym) {
  return entries.filter(e => monthOf(e.date) === ym);
}

export function monthTotals(entries, ym) {
  let expense = 0;
  let income = 0;
  for (const e of entriesInMonth(entries, ym)) {
    if (e.type === 'expense') expense += e.amount;
    else income += e.amount;
  }
  return { expense, income, diff: income - expense };
}

export function methodBreakdown(entries, methods, ym) {
  const sums = new Map();
  for (const e of entriesInMonth(entries, ym)) {
    if (e.type === 'expense') sums.set(e.methodId, (sums.get(e.methodId) ?? 0) + e.amount);
  }
  return allSorted(methods)
    .filter(m => sums.get(m.id) > 0)
    .map(m => ({ methodId: m.id, name: m.name, amount: sums.get(m.id) }));
}

export function expenseByDate(entries, ym) {
  const out = {};
  for (const e of entriesInMonth(entries, ym)) {
    if (e.type === 'expense') out[e.date] = (out[e.date] ?? 0) + e.amount;
  }
  return out;
}

export function expenseOnDate(entries, dateStr) {
  return entries.reduce((sum, e) => (e.type === 'expense' && e.date === dateStr ? sum + e.amount : sum), 0);
}

export function datesWithEntries(entries, ym) {
  return new Set(entriesInMonth(entries, ym).map(e => e.date));
}

export function entriesOnDate(entries, dateStr) {
  return entries.filter(e => e.date === dateStr).sort((a, b) => b.createdAt - a.createdAt);
}

export function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

// Kumabee only talks on the first record of the day, judged by when it was recorded.
export function isFirstRecordToday(entries, entry) {
  const day = toDateStr(new Date(entry.createdAt));
  return !entries.some(e => e.id !== entry.id && e.createdAt < entry.createdAt
    && toDateStr(new Date(e.createdAt)) === day);
}
