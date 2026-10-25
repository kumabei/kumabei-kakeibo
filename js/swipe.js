// Swipe a row to the left to show a red 削除 button behind it (Ver.1.3.1), like the iPhone's own lists.
// One row is open at a time; a touch anywhere else closes it. The page still scrolls up and down.

export const DELETE_W = 88; // the width of the 削除 button (px)
const OVER = 24; // how far the row may be pulled past the button
const START = 10; // how far the finger moves before the swipe or the scroll takes over

// Which way the finger is going: null until it has moved START px, then 'x' or 'y'. A tie goes to the scroll.
export function swipeAxis(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < START) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

// Where the row is drawn while the finger is down: left of its place only.
export function swipeOffset(dx, wasOpen) {
  return Math.min(0, Math.max(-DELETE_W - OVER, (wasOpen ? -DELETE_W : 0) + dx));
}

// Whether the row stays open when the finger lifts: past half the button.
export function swipeOpens(dx, wasOpen) {
  return swipeOffset(dx, wasOpen) < -DELETE_W / 2;
}

let openWrap = null;

function setOpen(wrap, open) {
  wrap.classList.toggle('open', open);
  wrap.querySelector('.swipe-del').tabIndex = open ? 0 : -1;
  wrap.lastElementChild.style.transform = open ? `translateX(${-DELETE_W}px)` : '';
  if (open) openWrap = wrap;
  else if (openWrap === wrap) openWrap = null;
}

function closeOpen() {
  if (openWrap?.isConnected) setOpen(openWrap, false);
  openWrap = null;
}

let listening = false;
let eatClick = false; // the tap that closed an open row does not also open another row
function listenOnce() {
  if (listening) return;
  listening = true;
  // Capture: runs before the touched row's own handlers, so touching another row closes the open one first.
  document.addEventListener('pointerdown', e => {
    eatClick = false;
    if (!openWrap || openWrap.contains(e.target)) return;
    closeOpen();
    eatClick = Boolean(e.target.closest('.swipe'));
  }, true);
  document.addEventListener('click', e => {
    if (!eatClick) return;
    eatClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

// Wraps row (a button) so it can be swiped. onDelete runs when 削除 is tapped; it resolves to false when
// nothing was deleted (the row then closes). A tap on an open row closes it instead of opening it.
export function swipeable(row, onDelete) {
  listenOnce();
  const del = document.createElement('button');
  del.className = 'swipe-del';
  del.textContent = '削除';
  del.tabIndex = -1;
  const wrap = document.createElement('div');
  wrap.className = 'swipe';
  wrap.append(del, row);

  del.addEventListener('click', async () => {
    if (await onDelete() === false && wrap.isConnected) setOpen(wrap, false);
  });

  let start = null; // { x, y, wasOpen, axis }
  let swiped = false; // the click that follows a swipe is not a tap
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, wasOpen: wrap.classList.contains('open'), axis: null };
    swiped = false;
  });
  row.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    start.axis ??= swipeAxis(dx, e.clientY - start.y);
    if (start.axis !== 'x') return;
    if (!swiped) {
      swiped = true;
      row.setPointerCapture(e.pointerId);
      wrap.classList.add('moving');
    }
    row.style.transform = `translateX(${swipeOffset(dx, start.wasOpen)}px)`;
  });
  const end = e => {
    if (!start) return;
    if (start.axis === 'x') {
      wrap.classList.remove('moving');
      setOpen(wrap, e.type === 'pointerup' ? swipeOpens(e.clientX - start.x, start.wasOpen) : start.wasOpen);
    }
    start = null;
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
  // Capture, so the row's own onclick (the editor) does not run after a swipe or on an open row.
  row.addEventListener('click', e => {
    if (!swiped && !wrap.classList.contains('open')) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (!swiped) setOpen(wrap, false);
    swiped = false;
  }, true);
  return wrap;
}
