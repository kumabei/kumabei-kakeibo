// Home: the reports (month, year, one category's year, one category's entries; Ver.1.2.0), the payment-method
// breakdown and the month's fixed costs on the month view, the backup nudge and Kumabee.
import { state, updateSettings } from '../state.js';
import { todayStr, methodBreakdown, formatYen, shouldNudgeBackup } from '../logic.js';
import { SCENES, homeScene, renderKuma, imageSrc } from '../kuma.js';
import { el, setChildren } from '../ui.js';
import { exportBackup } from '../backup.js';
import { show } from '../nav.js';
import { fixedSummary } from '../fixed.js';
import {
  startView, switchSpan, step, setType, openCategoryYear, openEntries, back, pickMonth,
} from '../report-nav.js';
import { monthView, yearView, categoryYearView, entriesView } from './report.js';

let view = null; // js/report-nav.js; kept while the home tab is open, reset when it is entered again

const row = (label, value, cls = '') => el('div', { class: 'row ' + cls }, el('span', {}, label), el('span', {}, value));

function nudgeBanner() {
  return el('div', { class: 'nudge' },
    el('img', { src: imageSrc(SCENES.backupNudge.image), alt: '' }),
    el('div', { class: 'nudge-text' }, '📦 ' + SCENES.backupNudge.line),
    el('div', { class: 'nudge-actions' },
      el('button', { class: 'primary', onclick: () => exportBackup() }, '今する'),
      el('button', { onclick: () => updateSettings({ nudgeSnoozedOn: todayStr() }) }, 'あとで')));
}

function breakdownCard(ym) {
  const breakdown = methodBreakdown(state.entries, state.methods, ym);
  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, '支出の内訳（支払い方法別）'),
    breakdown.length
      ? breakdown.map(b => row(b.name, formatYen(b.amount)))
      : el('div', { class: 'muted' }, 'まだ支出はありません'));
}

// Fixed costs spec 6-2: the month's fixed costs under the breakdown. Nothing when there are none.
function fixedCard(ym) {
  const s = fixedSummary(state.fixed, state.entries, ym);
  if (!s) return null;
  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, `${Number(ym.slice(5))}月の固定費`),
    s.rows.map(r => el('div', { class: 'row' },
      el('span', {}, r.name),
      el('span', {}, formatYen(r.amount),
        r.done ? el('span', { class: 'fixed-done' }, ' ✓') : el('span', { class: 'fixed-plan' }, ` ${r.day}日の予定`)))),
    el('div', { class: 'fixed-foot' }, `記録済み ${formatYen(s.recorded)} ／ 全部で ${formatYen(s.total)}`));
}

// ［月｜年］
function spanSwitch(act) {
  return el('div', { class: 'seg span-seg' }, [['month', '月'], ['year', '年']].map(([k, label]) =>
    el('button', { class: k === view.kind ? 'on' : '', onclick: () => act.switchSpan(k) }, label)));
}

export function render(root, { entering = false } = {}) {
  const now = new Date();
  const today = todayStr(now);
  if (entering || !view) view = startView(today);
  // Spec 8: moving inside the home screen. Going in starts at the top; ＜戻る puts the old position back.
  // Redraws after a data change (the editor) keep the view and the scroll position as they are.
  const go = (next, scrollY = null) => {
    view = next;
    render(root);
    if (scrollY !== null) window.scrollTo(0, scrollY);
  };
  const act = {
    goMonth: ym => go({ ...view, ym }),
    step: n => go(step(view, n)),
    setType: type => go(setType(view, type)),
    switchSpan: kind => go(switchSpan(view, kind, today)),
    openCategoryYear: id => go(openCategoryYear(view, id, window.scrollY), 0),
    openEntries: (id, ym) => go(openEntries(view, id, ym, window.scrollY), 0),
    pickMonth: ym => go(pickMonth(view, ym), 0),
    back: () => { const r = back(view); go(r.view, r.scrollY); },
  };
  const kuma = el('div', { class: 'kuma kuma-home' });
  renderKuma(kuma, homeScene(today));
  const top = view.kind === 'month' || view.kind === 'year';
  const body = {
    month: () => [...monthView(view, act), breakdownCard(view.ym), fixedCard(view.ym), kuma],
    year: () => [...yearView(view, act, today), kuma],
    categoryYear: () => categoryYearView(view, act, today),
    entries: () => entriesView(view, act),
  }[view.kind]();

  setChildren(root,
    el('div', { class: 'home-head' },
      el('h1', {}, 'くまべえ家計簿'),
      el('button', { class: 'gear', 'aria-label': '設定', onclick: () => show('settings') }, '⚙️')),
    shouldNudgeBackup(state.entries, state.settings, now) ? nudgeBanner() : null,
    top ? spanSwitch(act) : null,
    body);
}
