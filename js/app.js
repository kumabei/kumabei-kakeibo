// Start-up: load the data, wire the tab bar, open the input screen.
import { init, subscribe } from './state.js';
import { registerViews, show, rerender } from './nav.js';
import { lineChars } from './kuma.js';
import * as input from './screens/input.js';
import * as home from './screens/home.js';
import * as calendar from './screens/calendar.js';
import * as history from './screens/history.js';
import * as settings from './screens/settings.js';

// Load Zen Maru Gothic Bold for just the characters Kumabee actually says, so it stays small
// and stays in sync with js/lines.js.
document.head.append(Object.assign(document.createElement('link'), {
  rel: 'stylesheet',
  href: `https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700&display=swap&text=${encodeURIComponent(lineChars())}`,
}));

registerViews({ input, home, calendar, history, settings });
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.view)));
subscribe(rerender);

try {
  await init();
  show('input');
} catch (e) {
  document.getElementById('view-input').textContent = 'データを読み込めませんでした：' + e.message;
  throw e;
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rerender(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
