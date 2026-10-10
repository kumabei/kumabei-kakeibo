// The four report views of the home screen (Ver.1.2.0 spec 4–7). Each returns the nodes to draw; home.js
// keeps the view (js/report-nav.js) and passes `act`, the callbacks that move it.
import { state } from '../state.js';
import { formatYen, formatMonthLabel } from '../logic.js';
import {
  periodTotals, categoryBreakdown, formatShare, savingsRate, formatRate, monthlySeries, categoryEntries,
  averageMonths, monthlyAverage, categoryColors, categoryName,
} from '../stats.js';
import { donutChart, barChart } from '../chart.js';
import { el, monthNav, entryRow } from '../ui.js';
import { openEditor } from './input.js';

const TYPE_LABEL = { expense: '支出', income: '収入' };
const row = (label, value, cls = '') => el('div', { class: 'row ' + cls }, el('span', {}, label), el('span', {}, value));
const pad2 = n => String(n).padStart(2, '0');
const BAR_COLOR = '#e8718d'; // var(--accent); an SVG fill attribute cannot use a CSS variable

// ［支出｜収入］ (the same look as the input screen's switch)
function typeSwitch(view, act) {
  return el('div', { class: 'seg report-seg' }, ['expense', 'income'].map(t =>
    el('button', { class: t === view.type ? 'on' : '', onclick: () => { if (t !== view.type) act.setType(t); } }, TYPE_LABEL[t])));
}

function backHead(title, sub, act) {
  return el('div', { class: 'report-head' },
    el('button', { class: 'link', onclick: act.back }, '‹ もどる'),
    el('b', { class: 'report-title' }, title),
    el('span', { class: 'report-sub' }, sub));
}

// Spec 4-1, 4-2: the donut and the list of categories under it (a month or a year).
function breakdownCard(view, period, onRow) {
  const { total, rows } = categoryBreakdown(state.entries, state.categories, period, view.type);
  if (rows.length === 0) return el('div', { class: 'card' }, el('div', { class: 'muted' }, `まだ${TYPE_LABEL[view.type]}はありません`));
  const colors = categoryColors(state.categories);
  return el('div', { class: 'card' },
    el('div', { class: 'donut-wrap' }, donutChart(rows, colors, total)),
    rows.map(r => el('button', { class: 'cat-row', onclick: () => onRow(r.categoryId) },
      el('span', { class: 'dot', style: `background:${colors.get(r.categoryId)}` }),
      el('span', { class: 'cat-row-name' }, r.name),
      el('span', { class: 'cat-row-amount' }, formatYen(r.amount)),
      el('span', { class: 'cat-row-share' }, formatShare(r.share)),
      el('span', { class: 'chevron' }, '›'))));
}

function totalsCard(t, extra = []) {
  return el('div', { class: 'card totals' },
    row('支出', formatYen(t.expense)),
    row('収入', formatYen(t.income)),
    row('差額', formatYen(t.diff), t.diff < 0 ? 'minus' : ''),
    extra);
}

// Spec 4: month nav, totals, ［支出｜収入］, donut and categories. home.js adds the rest of the home screen.
export function monthView(view, act) {
  return [
    monthNav(view.ym, act.goMonth),
    totalsCard(periodTotals(state.entries, view.ym)),
    typeSwitch(view, act),
    breakdownCard(view, view.ym, id => act.openEntries(id, view.ym)),
  ];
}

function yearNav(year, act) {
  return el('div', { class: 'month-nav' },
    el('button', { class: 'nav-btn', 'aria-label': '前の年', onclick: () => act.step(-1) }, '‹'),
    el('span', { class: 'month-label' }, `${year}年`),
    el('button', { class: 'nav-btn', 'aria-label': '次の年', onclick: () => act.step(1) }, '›'));
}

// Spec 5: year nav, totals with the savings rate, ［支出｜収入］, donut and categories, the 12 months.
export function yearView(view, act, today) {
  const t = periodTotals(state.entries, String(view.year));
  const rate = savingsRate(t);
  const [y, m, d] = today.split('-').map(Number);
  const totals = totalsCard(t, row('貯蓄率', formatRate(rate), rate !== null && rate < 0 ? 'minus' : ''));
  if (view.year === y) totals.prepend(el('div', { class: 'as-of' }, `${m}月${d}日まで`));
  const series = monthlySeries(state.entries, state.categories, view.year, view.type);
  return [
    yearNav(view.year, act),
    totals,
    typeSwitch(view, act),
    breakdownCard(view, String(view.year), id => act.openCategoryYear(id)),
    el('div', { class: 'card' },
      el('div', { class: 'card-title' }, `月ごとの${TYPE_LABEL[view.type]}`),
      barChart(series, BAR_COLOR, i => act.pickMonth(`${view.year}-${pad2(i + 1)}`))),
  ];
}

// Spec 6: one category over the year.
export function categoryYearView(view, act, today) {
  const series = monthlySeries(state.entries, state.categories, view.year, view.type, view.categoryId);
  const total = series.reduce((s, v) => s + v, 0);
  const months = averageMonths(state.entries, view.year, today);
  const avg = monthlyAverage(total, months);
  const color = categoryColors(state.categories).get(view.categoryId);
  const open = i => act.openEntries(view.categoryId, `${view.year}-${pad2(i + 1)}`);
  return [
    backHead(`${categoryName(view.categoryId, state.categories)}（${TYPE_LABEL[view.type]}）`, `${view.year}年`, act),
    el('div', { class: 'card totals' },
      row('1年の合計', formatYen(total)),
      el('div', { class: 'row avg-row' }, el('span', {}, 'ひと月の平均'),
        avg === null ? el('span', {}, '—')
          : el('span', {}, formatYen(avg), el('span', { class: 'avg-note' }, `（${months}か月で割った額）`)))),
    el('div', { class: 'card' }, barChart(series, color, open)),
    el('div', { class: 'card' }, series.map((v, i) =>
      el('button', { class: 'cat-row', onclick: () => open(i) },
        el('span', { class: 'cat-row-name' }, `${i + 1}月`),
        el('span', { class: 'cat-row-amount' }, formatYen(v)),
        el('span', { class: 'chevron' }, '›')))),
  ];
}

// Spec 7: the entries of one category in one month. Tapping one opens the editor; the list stays.
export function entriesView(view, act) {
  const list = categoryEntries(state.entries, state.categories, view.ym, view.type, view.categoryId);
  return [
    backHead(categoryName(view.categoryId, state.categories), formatMonthLabel(view.ym), act),
    ...(list.length
      ? list.map(e => entryRow(e, state, () => openEditor(e), { showDate: true }))
      : [el('div', { class: 'muted report-empty' }, 'この月の記録はありません')]),
  ];
}
