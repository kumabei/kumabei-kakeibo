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
