// Hand-made SVG charts (Ver.1.2.0 spec 4-1, 5-1). The shape math is in pure functions (tested with
// node --test); donutChart and barChart only turn their results into SVG elements.
import { formatYen } from './logic.js';
import { hexToRgb } from './stats.js';

export const LABEL_MIN_SHARE = 0.08; // spec 4-1: names only on slices of 8% or more (raw share)
export const SIZE = 220; // donut viewBox (square)
const C = SIZE / 2;
export const R_OUT = 104;
export const R_IN = 62;
export const R_MID = (R_OUT + R_IN) / 2;
export const LABEL_FONT = 12;
export const CENTER_FONTS = [24, 20, 16, 13]; // tried in order; the first that fits the hole is used
const CENTER_WIDTH = R_IN * 2 * 0.9; // a little room inside the hole
export const TEXT_DARK = '#4a3a3a'; // var(--text)
export const TEXT_LIGHT = '#ffffff';

export const BAR_W = 360; // bar chart viewBox
export const BAR_H = 150;
export const BAR_AREA = 116; // the tallest bar
const BAR_TOP = 6;
export const MIN_BAR = 2; // a month with any amount gets at least this, so it does not vanish

// ---- pure ----

// Rows ({ amount, share, … }, largest first) → the same rows with start/end in degrees, 0 = 12 o'clock, clockwise.
export function pieSlices(rows) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  let acc = 0;
  return rows.map(r => {
    const start = (acc / total) * 360;
    acc += r.amount;
    return { ...r, start, end: (acc / total) * 360 };
  });
}

// Spec 4-1: estimated without drawing. Full-width char = 1 × font size, half-width (ASCII) = 0.6 ×.
export function textWidth(text, fontSize) {
  return [...text].reduce((w, ch) => w + (/[\x20-\x7e]/.test(ch) ? 0.6 : 1) * fontSize, 0);
}

export function arcLength(slice) {
  return ((slice.end - slice.start) * Math.PI / 180) * R_MID;
}

export function showLabel(slice) {
  return slice.share >= LABEL_MIN_SHARE && textWidth(slice.name, LABEL_FONT) <= arcLength(slice);
}

export function polar(deg, r) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

// Where a slice's name goes: the middle of the slice on the middle of the ring; 12 o'clock for a full ring.
export function labelPoint(slice, full) {
  return polar(full ? 0 : (slice.start + slice.end) / 2, R_MID);
}

const f = n => Math.round(n * 100) / 100;

// One donut slice as an SVG path.
export function segmentPath(start, end) {
  const large = end - start > 180 ? 1 : 0;
  const [x1, y1] = polar(start, R_OUT);
  const [x2, y2] = polar(end, R_OUT);
  const [x3, y3] = polar(end, R_IN);
  const [x4, y4] = polar(start, R_IN);
  return `M${f(x1)} ${f(y1)}A${R_OUT} ${R_OUT} 0 ${large} 1 ${f(x2)} ${f(y2)}`
    + `L${f(x3)} ${f(y3)}A${R_IN} ${R_IN} 0 ${large} 0 ${f(x4)} ${f(y4)}Z`;
}

export function centerFontSize(text) {
  return CENTER_FONTS.find(size => textWidth(text, size) <= CENTER_WIDTH) ?? CENTER_FONTS.at(-1);
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Spec 4-1: dark or white text, whichever stands out more on the slice color.
export function labelColor(bg) {
  const l = luminance(bg);
  return contrast(l, luminance(TEXT_DARK)) >= contrast(l, luminance(TEXT_LIGHT)) ? TEXT_DARK : TEXT_LIGHT;
}

// Spec 5-1: the largest month fills BAR_AREA; any amount above 0 is at least MIN_BAR; 0 is no bar.
export function barHeights(values) {
  const max = Math.max(0, ...values);
  return values.map(v => (v > 0 ? Math.max(MIN_BAR, (v / max) * BAR_AREA) : 0));
}

// ---- SVG ----

const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

// rows: categoryBreakdown(...).rows (not empty); colors: categoryColors(...); total: the amount in the hole.
export function donutChart(rows, colors, total) {
  const full = rows.length === 1;
  const slices = pieSlices(rows);
  const shapes = full
    ? [svg('circle', { cx: C, cy: C, r: R_MID, fill: 'none', stroke: colors.get(rows[0].categoryId), 'stroke-width': R_OUT - R_IN })]
    : slices.map(s => svg('path', { d: segmentPath(s.start, s.end), fill: colors.get(s.categoryId), stroke: '#fff', 'stroke-width': 2 }));
  const labels = slices.filter(showLabel).map(s => {
    const [x, y] = labelPoint(s, full);
    const label = svg('text', {
      x: f(x), y: f(y), 'font-size': LABEL_FONT, fill: labelColor(colors.get(s.categoryId)),
      'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'donut-label',
    });
    label.textContent = s.name;
    return label;
  });
  const totalText = formatYen(total);
  const center = svg('text', {
    x: C, y: C, 'font-size': centerFontSize(totalText), fill: TEXT_DARK,
    'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'donut-total',
  });
  center.textContent = totalText;
  return svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'donut', role: 'img' }, ...shapes, ...labels, center);
}

// values: 12 monthly amounts; onPick(monthIndex 0–11). Each month is one tappable column (bar + name).
export function barChart(values, color, onPick) {
  const colW = BAR_W / 12;
  const heights = barHeights(values);
  const cols = heights.map((h, i) => {
    const hit = svg('rect', { x: f(i * colW), y: 0, width: f(colW), height: BAR_H, class: 'bar-hit' });
    const bar = h > 0
      ? svg('rect', { x: f(i * colW + colW * 0.2), y: f(BAR_TOP + BAR_AREA - h), width: f(colW * 0.6), height: f(h), rx: 3, fill: color })
      : null;
    const name = svg('text', { x: f(i * colW + colW / 2), y: BAR_H - 10, 'font-size': 11, 'text-anchor': 'middle', class: 'bar-name' });
    name.textContent = `${i + 1}月`;
    const col = svg('g', { class: 'bar-col' }, ...[hit, bar, name].filter(Boolean));
    col.addEventListener('click', () => onPick(i));
    col.addEventListener('pointerdown', () => col.classList.add('pressed'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) col.addEventListener(t, () => col.classList.remove('pressed'));
    return col;
  });
  return svg('svg', { viewBox: `0 0 ${BAR_W} ${BAR_H}`, class: 'bars', role: 'img' }, ...cols);
}
