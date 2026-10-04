// Which picture and line Kumabee shows in each scene (spec 6), and drawing it.
import { LINES } from './lines.js';
import { isMonthEdge } from './logic.js';

export const BIG_EXPENSE = 10000;

// k = Kumabee stamps, y = family stamps (see tools/make_kuma_images.py)
export const SCENES = {
  welcome: { image: 'y19', line: LINES.welcome },
  peek: { image: 'k16', line: LINES.peek },
  recorded: { image: 'k09', line: LINES.recorded },
  big: { image: 'k12', line: LINES.big },
  income: { image: 'k15', line: LINES.income },
  deleted: { image: 'k06', line: LINES.deleted },
  empty: { image: 'k10', line: LINES.empty },
  monthEnd: { image: 'k14', line: LINES.monthEnd },
  home: { image: 'k01', line: LINES.home },
  backupNudge: { image: 'k07', line: LINES.backupNudge },
  backupDone: { image: 'k02', line: LINES.backupDone },
  missing: { image: 'k08', line: LINES.missing },
  autoRecorded: { image: 'k09', line: LINES.autoRecorded }, // the line is filled in by fixed.js autoRecordLine
};

// Kumabee's picture when he asks about a fixed cost (spec 5-1, 5-2).
export const FIXED_ASK_IMAGE = 'k16';

// Keyed by the initial category ids (logic.js initialCategories), so renaming keeps the picture.
export const CATEGORY_IMAGES = {
  e01: ['y02'], // 食費
  e02: ['y22'], // 外食
  e03: ['y03', 'y04'], // おやつ
  e06: ['y01'], // 子供
  e09: ['y08'], // 車
  e10: ['y15'], // ガソリン
  e11: ['y09'], // 交通費
  e14: ['y18'], // 通信費
  e17: ['y24'], // 家具・家電
};

// Always visible, but only talks on the first record of the day, big expenses and income.
export function recordReaction(entry, isFirstToday, rand = Math.random) {
  if (entry.type === 'income') return { image: SCENES.income.image, line: SCENES.income.line };
  if (entry.amount >= BIG_EXPENSE) return { image: SCENES.big.image, line: SCENES.big.line };
  const pics = CATEGORY_IMAGES[entry.categoryId];
  const image = pics ? pics[Math.floor(rand() * pics.length)] : SCENES.recorded.image;
  return { image, line: isFirstToday ? SCENES.recorded.line : null };
}

export function homeScene(dateStr) {
  return isMonthEdge(dateStr) ? SCENES.monthEnd : SCENES.home;
}

export function imageSrc(key) {
  return `img/kuma/${key}.png`;
}

// Unique characters of everything Kumabee says ({…} marks left out), the digits and 日 that fill them, and
// `extra` (the fixed-cost names), in first-seen order. Used to build the Google Fonts `text=` subset
// so only the characters actually needed are downloaded.
export function lineChars(extra = '') {
  const text = Object.values(LINES).map(line => line.replace(/\{\w+\}/g, '')).join('') + '0123456789日' + extra;
  return [...new Set(text)].join('');
}

// Draws Kumabee into `el`. A transient speech bubble disappears after `ms` (3 seconds unless told).
export function renderKuma(el, { image, line = null, transient = false, ms = 3000 }) {
  const img = document.createElement('img');
  img.src = imageSrc(image);
  img.alt = '';
  el.replaceChildren(img);
  if (line) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = line;
    el.prepend(bubble);
    if (transient) setTimeout(() => bubble.remove(), ms);
  }
  // Bounce once. The class is removed afterwards so moving the element in the DOM does not replay it.
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
}
