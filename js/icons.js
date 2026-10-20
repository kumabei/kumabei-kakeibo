// Category pictures (Ver.1.3.0 spec 6). The path data is generated into icon-paths.js by tools/make_icons.mjs.
import { ICON_PATHS } from './icon-paths.js';

// Keyed by the initial category ids (logic.js initialCategories), so renaming keeps the picture.
export const DEFAULT_ICONS = {
  e01: 'tools-kitchen-2', // 食費
  e02: 'bowl-chopsticks', // 外食
  e03: 'cookie', // おやつ
  e04: 'bottle', // 日用品
  e05: 'shirt', // 服
  e06: 'mood-kid', // 子供
  e07: 'book', // 教育費
  e08: 'glass-full', // 交際費
  e09: 'car', // 車
  e10: 'gas-station', // ガソリン
  e11: 'bus', // 交通費
  e12: 'ticket', // イベント・レジャー
  e13: 'first-aid-kit', // 医療費
  e14: 'device-mobile', // 通信費
  e15: 'bulb', // 光熱費
  e16: 'home', // 住居費
  e17: 'armchair', // 家具・家電
  e18: 'wallet', // お小遣い
  e19: 'receipt', // 固定費 (hidden)
  e20: 'dots', // 雑費
  e21: 'shield-check', // 保険
};

// What the settings offer (spec 6-2): the initial ones, then 25 more.
export const PICKER_ICONS = [
  ...Object.values(DEFAULT_ICONS),
  'cash', 'briefcase', 'gift', 'coin', 'pig-money', 'shopping-cart', 'basket', 'coffee', 'pizza', 'pill',
  'dental', 'scissors', 'paw', 'plane', 'ball-football', 'heart', 'tools', 'device-tv', 'wifi', 'droplet',
  'flame', 'building-bank', 'baby-bottle', 'bike', 'music',
];

// Drawn by the screens themselves, not offered for categories.
export const UI_ICONS = ['check', 'x', 'calendar', 'pencil', 'backspace'];

// Spec 6-1: the category's own picture if it is known, else the initial one, else … (expense) or cash (income).
// So old data and old backups need no change.
export function iconOf(category) {
  if (category?.icon && ICON_PATHS[category.icon]) return category.icon;
  return DEFAULT_ICONS[category?.id] ?? (category?.type === 'income' ? 'cash' : 'dots');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// A 1em line picture in currentColor (css .icon). Browser only.
export function iconSvg(name, cls = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICON_PATHS[name] ?? ICON_PATHS.dots;
  return svg;
}
