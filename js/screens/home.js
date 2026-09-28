// Home: this month's totals, the breakdown by payment method, the backup nudge and Kumabee.
import { state, updateSettings } from '../state.js';
import { todayStr, monthOf, monthTotals, methodBreakdown, formatYen, shouldNudgeBackup } from '../logic.js';
import { SCENES, homeScene, renderKuma, imageSrc } from '../kuma.js';
import { el, monthNav, setChildren } from '../ui.js';
import { exportBackup } from '../backup.js';
import { show } from '../nav.js';

let ym = null;

const row = (label, value, cls = '') => el('div', { class: 'row ' + cls }, el('span', {}, label), el('span', {}, value));

function nudgeBanner() {
  return el('div', { class: 'nudge' },
    el('img', { src: imageSrc(SCENES.backupNudge.image), alt: '' }),
    el('div', { class: 'nudge-text' }, '📦 ' + SCENES.backupNudge.line),
    el('div', { class: 'nudge-actions' },
      el('button', { class: 'primary', onclick: () => exportBackup() }, '今する'),
      el('button', { onclick: () => updateSettings({ nudgeSnoozedOn: todayStr() }) }, 'あとで')));
}

export function render(root, { entering = false } = {}) {
  const now = new Date();
  if (entering || !ym) ym = monthOf(todayStr(now));
  const t = monthTotals(state.entries, ym);
  const breakdown = methodBreakdown(state.entries, state.methods, ym);
  const kuma = el('div', { class: 'kuma kuma-home' });
  renderKuma(kuma, homeScene(todayStr(now)));

  setChildren(root,
    el('div', { class: 'home-head' },
      el('h1', {}, 'くまべえ家計簿'),
      el('button', { class: 'gear', 'aria-label': '設定', onclick: () => show('settings') }, '⚙️')),
    shouldNudgeBackup(state.entries, state.settings, now) ? nudgeBanner() : null,
    monthNav(ym, next => { ym = next; render(root); }),
    el('div', { class: 'card totals' },
      row('支出', formatYen(t.expense)),
      row('収入', formatYen(t.income)),
      row('差額', formatYen(t.diff), t.diff < 0 ? 'minus' : '')),
    el('div', { class: 'card' },
      el('div', { class: 'card-title' }, '支出の内訳（支払い方法別）'),
      breakdown.length
        ? breakdown.map(b => row(b.name, formatYen(b.amount)))
        : el('div', { class: 'muted' }, 'まだ支出はありません')),
    kuma);
}
