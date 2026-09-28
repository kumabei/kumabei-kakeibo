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
};

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

// Unique characters of everything Kumabee says, in first-seen order. Used to build the Google
// Fonts `text=` subset so only the characters actually needed are downloaded.
export function lineChars() {
  const seen = new Set();
  for (const line of Object.values(LINES)) {
    for (const ch of line) seen.add(ch);
  }
  return [...seen].join('');
}

// Draws Kumabee into `el`. A transient speech bubble disappears after 3 seconds.
export function renderKuma(el, { image, line = null, transient = false }) {
  const img = document.createElement('img');
  img.src = imageSrc(image);
  img.alt = '';
  el.replaceChildren(img);
  if (line) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = line;
    el.prepend(bubble);
    if (transient) setTimeout(() => bubble.remove(), 3000);
  }
  // Bounce once. The class is removed afterwards so moving the element in the DOM does not replay it.
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
}
