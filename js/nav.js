// Switches between views. Each view module exports render(root, { entering }).
const views = {};
let current = null;

const rootOf = name => document.getElementById(`view-${name}`);

export function registerViews(map) {
  Object.assign(views, map);
}

export function show(name) {
  current = name;
  for (const n of Object.keys(views)) rootOf(n).hidden = n !== name;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo(0, 0);
  views[name].render(rootOf(name), { entering: true });
}

export function rerender() {
  if (current) views[current].render(rootOf(current), { entering: false });
}
