// Start-up: load the data, record the fixed costs that are due, wire the tab bar, open the input screen.
import { init, subscribe, state } from './state.js';
import { registerViews, show, rerender } from './nav.js';
import { lineChars } from './kuma.js';
import { todayStr } from './logic.js';
import { checkFixed } from './screens/fixed.js';
import * as input from './screens/input.js';
import * as home from './screens/home.js';
import * as calendar from './screens/calendar.js';
import * as history from './screens/history.js';
import * as settings from './screens/settings.js';

// Zen Maru Gothic Bold for just the characters Kumabee says (js/lines.js), plus the fixed-cost names,
// which appear in his lines. Loaded again when a name brings new characters.
const fontLink = Object.assign(document.createElement('link'), { rel: 'stylesheet' });
document.head.append(fontLink);
let fontText = null;
function refreshFont() {
  const text = lineChars(state.fixed.map(f => f.name).join(''));
  if (text === fontText) return;
  fontText = text;
  fontLink.href = `https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700&display=swap&text=${encodeURIComponent(text)}`;
}
refreshFont();

// Fixed costs spec 4-1: on start, on coming back from the background, and on a screen change after the day changed.
let checkedOn = null;
function check() {
  checkedOn = todayStr();
  return checkFixed();
}

registerViews({ input, home, calendar, history, settings });
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  show(t.dataset.view);
  if (todayStr() !== checkedOn) check();
}));
subscribe(rerender);
subscribe(refreshFont);

try {
  await init();
  await check(); // before the first screen, so Kumabee's first words can be about it
  show('input');
} catch (e) {
  document.getElementById('view-input').textContent = 'データを読み込めませんでした：' + e.message;
  throw e;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  rerender();
  check();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
