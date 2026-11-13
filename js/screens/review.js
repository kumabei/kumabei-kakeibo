// The review as a picture-story show over the whole screen (Ver.1.4.0 spec 5-1), and one card of the list
// (spec 5-3). js/review.js counts, js/review-text.js gives the words; this file only draws.
import { state, markReviewSeen } from '../state.js';
import { buildReview } from '../review.js';
import { cardContent } from '../review-text.js';
import { imageSrc } from '../kuma.js';
import { swipeAxis, flipStep } from '../swipe.js';
import { el, setChildren } from '../ui.js';

// The title, the big number or words, the top 3 and the details: shared by the show and the list.
function cardBody(c) {
  return [
    el('div', { class: 'review-title' }, c.title),
    c.big && el('div', { class: 'review-big' }, c.big),
    c.rows && el('ol', { class: 'review-rank' }, c.rows.map(r =>
      el('li', { class: `rank-${r.rank}` }, `${r.rank}位　${r.name}　${r.count}回`))),
    c.details.map(d => el('div', { class: 'review-detail' }, d)),
  ];
}

// Spec 5-3: one card of the list. Kumabee's picture only on the first (the cover).
export function reviewItem(c, withImage) {
  return el('div', { class: 'card review-item' },
    withImage && el('img', { class: 'review-item-kuma', src: imageSrc(c.image), alt: '' }),
    cardBody(c),
    el('div', { class: 'bubble' }, c.line));
}

const box = () => document.getElementById('review');
let show = null; // the show on screen: { contents, i, year, onList }
let flipped = false; // the click that ends a swipe is not a tap on a button

function close(toList) {
  const s = show;
  show = null;
  box().hidden = true;
  box().replaceChildren();
  markReviewSeen(s.year); // spec 5-4: ［×］, ［とじる］ and ［一覧で見る］ all count as seen
  if (toList) s.onList();
}

function go(n) {
  const next = show.i + n;
  if (next < 0 || next >= show.contents.length) return; // nothing before the first or after the last
  show.i = next;
  draw();
}

function draw() {
  const { contents, i } = show;
  const c = contents[i];
  const last = i === contents.length - 1;
  setChildren(box(),
    el('button', { class: 'review-close', 'aria-label': 'とじる', onclick: () => close(false) }, '×'),
    el('div', { class: 'review-page' }, `${i + 1} / ${contents.length}`),
    el('div', { class: 'review-card' },
      el('img', { class: 'review-kuma', src: imageSrc(c.image), alt: '' }),
      cardBody(c),
      el('div', { class: 'bubble' }, c.line)),
    el('div', { class: 'review-actions' }, last
      ? [el('button', { class: 'review-sub', onclick: () => close(true) }, '一覧で見る'),
        el('button', { class: 'review-next', onclick: () => close(false) }, 'とじる')]
      : [i > 0 && el('button', { class: 'review-sub', onclick: () => go(-1) }, 'もどる'),
        el('button', { class: 'review-next', onclick: () => go(1) }, 'つぎへ')]));
  box().scrollTop = 0;
}

// Swipes on the whole box (the box has touch-action: pan-y, so a sideways move is not taken by the browser).
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  const b = box();
  let start = null; // { x, y, axis }
  b.addEventListener('pointerdown', e => {
    start = { x: e.clientX, y: e.clientY, axis: null };
    flipped = false;
  });
  b.addEventListener('pointermove', e => {
    if (start) start.axis ??= swipeAxis(e.clientX - start.x, e.clientY - start.y);
  });
  b.addEventListener('pointerup', e => {
    const s = start;
    start = null;
    if (!s || !show) return;
    const n = flipStep(e.clientX - s.x, s.axis);
    if (n === 0) return;
    flipped = true;
    go(n);
  });
  b.addEventListener('pointercancel', () => { start = null; });
  b.addEventListener('click', e => {
    if (!flipped) return;
    flipped = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

// Spec 5-1: opens the show of `year` at its first card. onList runs after ［一覧で見る］ has closed it.
export function playReview(year, today, onList) {
  const review = buildReview(state.entries, state.categories, state.fixed, year, today);
  if (!review) return;
  wire();
  show = { contents: review.cards.map(cardContent), i: 0, year, onList };
  draw();
  box().hidden = false;
}
