'use strict';
// Data model: { id, name, parentId|null, start (ms), end (ms|null), collapsed }
const KEY = 'multitimer.v1';
let timers = load();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(timers)); } catch {}
}
const byId = id => timers.find(t => t.id === id);
const childrenOf = id => timers.filter(t => t.parentId === id);
const isRunning = t => t.end == null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function descendants(id) {
  const out = [];
  for (const c of childrenOf(id)) out.push(c, ...descendants(c.id));
  return out;
}
function ancestors(t) {
  const out = [];
  for (let p = byId(t.parentId); p; p = byId(p.parentId)) out.push(p);
  return out;
}
const label = t => t.name || 'Untitled ' + new Date(t.start).toLocaleTimeString();

function fmt(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  const pad = n => String(n).padStart(2, '0');
  return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
}
const elapsed = t => (t.end ?? Date.now()) - t.start;

// ---- actions ----
function startTimer(parentId = null) {
  timers.push({ id: uid(), name: '', parentId, start: Date.now(), end: null, collapsed: false });
  if (parentId) byId(parentId).collapsed = false;
  commit();
}
function stopTimer(id, withChildren) {
  const now = Date.now();
  const list = [byId(id), ...(withChildren ? descendants(id) : [])];
  list.forEach(t => { if (isRunning(t)) t.end = now; });
  commit();
}
function resumeTimer(id) { byId(id).end = null; commit(); }
function moveTimer(id, parentId) {
  if (parentId && (parentId === id || descendants(id).some(d => d.id === parentId))) return;
  byId(id).parentId = parentId || null;
  if (parentId) byId(parentId).collapsed = false;
  commit();
}
function deleteTimer(id) {
  const t = byId(id);
  if (!confirm(`Delete "${label(t)}"? Its children will move up to its parent.`)) return;
  childrenOf(id).forEach(c => c.parentId = t.parentId);
  timers = timers.filter(x => x !== t);
  commit();
}
function commit() { save(); render(); }

// ---- rendering ----
// A section shows timers of one state (running/completed). A timer's displayed
// parent is its nearest ancestor in the same section; otherwise it's shown at the
// section root with a breadcrumb to its real parent.
function displayParent(t, running) {
  return ancestors(t).find(a => isRunning(a) === running)?.id ?? null;
}

function render() {
  for (const running of [true, false]) {
    const list = timers.filter(t => isRunning(t) === running);
    const ul = document.getElementById(running ? 'running' : 'completed');
    ul.replaceChildren(rootDrop(), ...buildLevel(list, null, running));
    document.getElementById(running ? 'running-count' : 'completed-count').textContent = `(${list.length})`;
    if (running) document.getElementById('empty').hidden = list.length > 0;
    else document.getElementById('clear').hidden = list.length === 0;
  }
  tick();
}

function buildLevel(list, parentId, running) {
  return list
    .filter(t => displayParent(t, running) === parentId)
    .sort((a, b) => running ? a.start - b.start : b.end - a.end)
    .map(t => buildNode(t, list, running));
}

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}
function btn(text, title, onclick, cls = 'small') {
  return el('button', { textContent: text, title, onclick, className: cls });
}

function buildNode(t, list, running) {
  const kids = buildLevel(list, t.id, running);
  const li = el('li');
  const row = el('div', { className: 'timer' + (running ? ' running' : ''), draggable: true });
  row.dataset.id = t.id;

  const toggle = btn(kids.length ? (t.collapsed ? '▸' : '▾') : '', 'Collapse/expand', () => {
    t.collapsed = !t.collapsed; commit();
  }, 'toggle');
  toggle.disabled = !kids.length;

  const name = el('input', { value: t.name, placeholder: label(t), title: 'Name this timer' });
  name.oninput = () => { t.name = name.value; save(); };
  name.onkeydown = e => { if (e.key === 'Enter') name.blur(); };
  name.ondragstart = e => e.preventDefault();

  const time = el('span', { className: 'elapsed' });
  time.dataset.id = t.id;

  const move = el('select', { title: 'Move under…' });
  move.append(el('option', { value: '', textContent: '↳ Move…', disabled: true, selected: true }),
              el('option', { value: '__root', textContent: 'Top level' }));
  const banned = new Set([t.id, t.parentId, ...descendants(t.id).map(d => d.id)]);
  timers.filter(o => !banned.has(o.id))
    .sort((a, b) => isRunning(b) - isRunning(a) || a.start - b.start)
    .forEach(o => move.append(el('option', { value: o.id, textContent: (isRunning(o) ? '● ' : '○ ') + label(o) })));
  if (!t.parentId) move.options[1].disabled = true;
  move.onchange = () => moveTimer(t.id, move.value === '__root' ? null : move.value);

  const actions = el('span', { className: 'actions' });
  if (running) {
    actions.append(btn('+ Child', 'Start a child timer', () => startTimer(t.id)));
    actions.append(btn('■ Stop', 'Stop this timer (shift-click: also stop its children)',
      e => stopTimer(t.id, e.shiftKey)));
  } else {
    actions.append(btn('↺ Resume', 'Resume (time while stopped is counted)', () => resumeTimer(t.id)));
    actions.append(btn('✕', 'Delete', () => deleteTimer(t.id), 'small danger'));
  }
  actions.append(move);

  row.append(el('span', { className: 'handle', textContent: '⠿', title: 'Drag onto another timer to nest' }),
             toggle, name, time, actions);

  const crumbs = [];
  const real = byId(t.parentId);
  if (real && displayParent(t, running) !== real.id)
    crumbs.push(`under ${label(real)} (${isRunning(real) ? 'running' : 'completed'})`);
  const when = d => new Date(d).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  crumbs.push('started ' + when(t.start) + (t.end ? ' · stopped ' + when(t.end) : ''));
  row.append(el('div', { className: 'meta', textContent: crumbs.join(' · ') }));

  dnd(row, t.id);
  li.append(row);
  if (kids.length && !t.collapsed) li.append(el('ul', {}, ...kids));
  return li;
}

// ---- drag & drop ----
let dragId = null;
function dnd(target, id) {
  if (id) {
    target.ondragstart = e => { dragId = id; e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; };
    target.ondragend = () => { dragId = null; };
  }
  target.ondragover = e => {
    if (!dragId || dragId === id || (id && descendants(dragId).some(d => d.id === id))) return;
    e.preventDefault(); e.stopPropagation(); target.classList.add('drop');
  };
  target.ondragleave = () => target.classList.remove('drop');
  target.ondrop = e => {
    e.preventDefault(); e.stopPropagation(); target.classList.remove('drop');
    if (dragId) moveTimer(dragId, id);
  };
}
function rootDrop() {
  const d = el('li', { className: 'root-drop', title: 'Drop here to move to top level' });
  dnd(d, null);
  return d;
}

function tick() {
  document.querySelectorAll('.elapsed').forEach(s => {
    const t = byId(s.dataset.id);
    if (t) s.textContent = fmt(elapsed(t));
  });
}

// ---- wiring ----
document.getElementById('start').onclick = () => startTimer();
document.getElementById('clear').onclick = () => {
  if (!confirm('Delete all completed timers?')) return;
  const done = new Set(timers.filter(t => !isRunning(t)).map(t => t.id));
  timers.forEach(t => { while (t.parentId && done.has(t.parentId)) t.parentId = byId(t.parentId).parentId; });
  timers = timers.filter(t => !done.has(t.id));
  commit();
};
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey &&
      !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) startTimer();
});
window.addEventListener('storage', e => { if (e.key === KEY) { timers = load(); render(); } });
setInterval(tick, 250);
render();
