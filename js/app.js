// Start-up: load the data, wire the tab bar, open the input screen.
import { init, subscribe } from './state.js';
import { registerViews, show, rerender } from './nav.js';
import * as input from './screens/input.js';
import * as home from './screens/home.js';
import * as calendar from './screens/calendar.js';
import * as history from './screens/history.js';
import * as settings from './screens/settings.js';

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
