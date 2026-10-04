// Home: this month's totals, the breakdown by payment method, the backup nudge and Kumabee.
import { state, updateSettings } from '../state.js';
import { todayStr, monthOf, monthTotals, methodBreakdown, formatYen, shouldNudgeBackup } from '../logic.js';
import { SCENES, homeScene, renderKuma, imageSrc } from '../kuma.js';
import { el, monthNav, setChildren } from '../ui.js';
import { exportBackup } from '../backup.js';
import { show } from '../nav.js';
import { fixedSummary } from '../fixed.js';

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
    fixedCard(ym),
    kuma);
}
