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

export const SCHEMA_VERSION = 2;

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
  return withInsurance(EXPENSE_DEFAULTS.map(([name, color], i) =>
    ({ id: `e${pad2(i + 1)}`, type: 'expense', name, order: i, hidden: false, color })));
}

// Fixed costs spec 7: the initial 固定費 (e19) is hidden, and 保険 (pale purple, like 固定費) takes its
// place in the order; e19 and everything after it move back by one. An existing 保険 is not added again.
export function withInsurance(categories) {
  const list = categories.map(c => (c.id === 'e19' && !c.hidden ? { ...c, hidden: true } : c));
  if (list.some(c => c.type === 'expense' && c.name === '保険')) return list;
  const expense = list.filter(c => c.type === 'expense');
  const at = list.find(c => c.id === 'e19')?.order ?? expense.reduce((max, c) => Math.max(max, c.order), -1) + 1;
  return [
    ...list.map(c => (c.type === 'expense' && c.order >= at ? { ...c, order: c.order + 1 } : c)),
    { id: 'e21', type: 'expense', name: '保険', order: at, hidden: false, color: 'monthly' },
  ];
}

// Fixed costs spec 7: once per data set (schemaVersion below 2; none means 1). Returns the same object when
// there is nothing to do. Not a data change: lastChangedAt is kept, so the backup nudge is not triggered.
export function migrateData(data) {
  if ((data.settings.schemaVersion ?? 1) >= SCHEMA_VERSION) return data;
  return {
    ...data,
    fixed: data.fixed ?? [],
    categories: withInsurance(data.categories),
    settings: { ...data.settings, schemaVersion: SCHEMA_VERSION },
  };
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

// ---- backup ----

export const APP_ID = 'kumabei-kakeibo';
export const DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_INTERVAL_DAYS = 7;

export function backupFileName(now) {
  return `kakeibo-backup-${toDateStr(now).replaceAll('-', '')}.json`;
}

export function buildBackup(data, now) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.getTime(),
    entries: data.entries,
    categories: data.categories,
    methods: data.methods,
    fixed: data.fixed,
    settings: data.settings,
  };
}

// Months 01-12 only, and dates that exist (2026-02-31 does not).
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const day = Number(s.slice(8));
  return YM.test(s.slice(0, 7)) && day >= 1 && day <= daysInMonth(s.slice(0, 7));
}

function isValidEntry(e) {
  return e !== null && typeof e === 'object'
    && typeof e.id === 'string'
    && (e.type === 'expense' || e.type === 'income')
    && Number.isInteger(e.amount) && e.amount > 0
    && isRealDate(e.date)
    && typeof e.categoryId === 'string'
    && typeof e.createdAt === 'number'
    && (e.memo === undefined || typeof e.memo === 'string')
    // the fixed-cost mark: both or neither
    && (e.fixedId === undefined
      ? e.fixedMonth === undefined
      : typeof e.fixedId === 'string' && YM.test(e.fixedMonth));
}

function isValidFixed(f) {
  return f !== null && typeof f === 'object'
    && typeof f.id === 'string'
    && typeof f.name === 'string'
    && typeof f.categoryId === 'string'
    && Number.isInteger(f.amount) && f.amount > 0
    && typeof f.methodId === 'string'
    && Number.isInteger(f.day) && f.day >= 1 && f.day <= 31
    && YM.test(f.startMonth)
    && YM.test(f.doneThrough)
    && (f.deleted === undefined || typeof f.deleted === 'boolean');
}

function isValidCategory(c) {
  return c !== null && typeof c === 'object'
    && typeof c.id === 'string'
    && (c.type === 'expense' || c.type === 'income')
    && typeof c.name === 'string'
    && typeof c.order === 'number';
}

function isValidMethod(m) {
  return m !== null && typeof m === 'object'
    && typeof m.id === 'string'
    && typeof m.name === 'string'
    && typeof m.order === 'number';
}

// Checks a backup file. Nothing is changed unless this returns ok.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'ファイルが壊れています' };
  }
  if (!obj || obj.app !== APP_ID) return { ok: false, reason: 'くまべえ家計簿のバックアップではありません' };
  if (Array.isArray(obj.records) && obj.schemaVersion === undefined) {
    return { ok: false, reason: '検証ページのバックアップなので戻せません。新しい日付のファイルを選んでね' };
  }
  // Version 1 files (1.0.x) have no fixed costs; they are restored with none.
  const v = obj.schemaVersion;
  const lists = v === 1 ? ['entries', 'categories', 'methods'] : ['entries', 'categories', 'methods', 'fixed'];
  const shapeOk = (v === 1 || v === SCHEMA_VERSION)
    && lists.every(k => Array.isArray(obj[k]))
    && obj.settings !== null && typeof obj.settings === 'object'
    && typeof obj.exportedAt === 'number';
  if (!shapeOk) return { ok: false, reason: '形式がちがうバックアップです' };
  const fixed = v === 1 ? [] : obj.fixed;
  if (!obj.categories.every(isValidCategory) || !obj.methods.every(isValidMethod) || !fixed.every(isValidFixed)) {
    return { ok: false, reason: '形式がちがうバックアップです' };
  }
  if (!obj.entries.every(isValidEntry)) return { ok: false, reason: '記録の中身がおかしいバックアップです' };
  return {
    ok: true,
    exportedAt: obj.exportedAt,
    entryCount: obj.entries.length,
    data: {
      entries: obj.entries,
      categories: obj.categories,
      methods: obj.methods,
      fixed,
      // The restored data equals the file, so it counts as "backed up, unchanged".
      settings: { ...obj.settings, lastBackupAt: obj.exportedAt, lastChangedAt: obj.exportedAt, nudgeSnoozedOn: null },
    },
  };
}

// Spec 8: at least one entry, 7+ days since the last export (or the first entry),
// something changed since that export, and not silenced with "later" today.
export function shouldNudgeBackup(entries, settings, now) {
  if (entries.length === 0) return false;
  if (settings.nudgeSnoozedOn === todayStr(now)) return false;
  const { lastBackupAt, lastChangedAt } = settings;
  if (lastBackupAt != null && !(lastChangedAt > lastBackupAt)) return false;
  const since = lastBackupAt ?? Math.min(...entries.map(e => e.createdAt));
  return now.getTime() - since >= BACKUP_INTERVAL_DAYS * DAY_MS;
}
