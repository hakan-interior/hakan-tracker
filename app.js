// Hakan Production Tracker — single-page app (no build step).
import { createBackend } from './backend.js';
import { VAPID_PUBLIC_KEY } from './config.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');

const S = { db: null, me: lsGet('hakan.me'), user: null, disposeHero: null, filters: {}, chatMembers: [], openRoom: null, seenNotifs: new Set() };
let B; // backend (Supabase or local server)

const DEFAULT_SETTINGS = {
  stages: [['Take-off', 'Hasan'], ['Mozaik Design', 'Joseph'], ['Design Approval', 'Hasan'], ['Approved for G-code', 'Joseph'], ['Production', 'Brook'], ['Installation', 'Luis'], ['Completed', '']].map(([name, owner], i) => ({ n: i + 1, name, owner })),
  people: ['Hasan', 'Joseph', 'Brook', 'Luis'].map(name => ({ name, email: '' })),
  roomTypes: ['Kitchen', 'Master Closet', 'Closet', 'Master Bath', 'Bathroom', 'Laundry', 'Pantry', 'Office', 'Built-ins', 'Mudroom', 'Other'],
  materialTypes: ['Melamine', 'Plywood', 'MDF', 'Particle Board', 'Edge Banding', 'Other'],
  sheetSizes: ["4' x 8'", "4' x 10'", "5' x 10'", 'Other'],
  thicknesses: ['1/4"', '1/2"', '5/8"', '3/4"', '1"', 'Other'],
};

/* ---------------- utils ---------------- */
function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const parseDay = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const daysFromToday = iso => iso ? Math.round((parseDay(iso) - parseDay(today())) / 864e5) : null;
const fmtDate = iso => iso ? parseDay(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: parseDay(iso).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : '—';
const rel = iso => { const d = daysFromToday(iso); if (d === null) return ''; if (d === 0) return 'today'; if (d === 1) return 'tomorrow'; if (d === -1) return 'yesterday'; return d > 0 ? `in ${d} days` : `${-d} days ago`; };
const timeAgo = ts => { const m = Math.round((Date.now() - new Date(ts)) / 6e4); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const buzz = () => navigator.vibrate?.(12);
const icon = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
const I = {
  chevL: '<path d="m15 18-6-6 6-6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  layers: '<path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>', grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>',
  download: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>', upload: '<path d="M12 20V8M6 14l6-6 6 6M4 4h16"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  door: '<path d="M5 3h14v18H5zM15 12v.5"/>', box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>', activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  mail: '<path d="M3 5h18v14H3z"/><path d="m3 6 9 7 9-7"/>', phone: '<path d="M12 18h.01M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  map: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};

/* ---------------- data access ---------------- */
const set = () => S.db.settings;
const stages = () => set().stages;
const stage = n => stages().find(s => s.n === n) || { n, name: '?', owner: '' };
const stageLabel = n => `${n} ${stage(n).name}`;
const shortStage = n => ({ 1: 'Take-off', 2: 'Design', 3: 'Approval', 4: 'G-code', 5: 'Production', 6: 'Install', 7: 'Done' })[n] || stage(n).name;
const project = id => S.db.projects.find(p => p.id === id);
const roomsOf = pid => S.db.rooms.filter(r => r.projectId === pid);
const openRooms = () => S.db.rooms.filter(r => r.stage < 7);
const daysIn = r => r.stage < 7 && r.enteredStage ? -daysFromToday(r.enteredStage) : null;
const personEmail = n => set().people.find(p => p.name === n)?.email || '';
// Progress counts finished steps: every stage a room has moved past is one step
// (a room in stage 1 has 0 steps done, a completed room has all of them).
function progress(pid) {
  const rs = roomsOf(pid), last = stages().length, done = rs.filter(r => r.stage >= last).length;
  const stepsPerRoom = last - 1, stepsTotal = rs.length * stepsPerRoom;
  const stepsDone = rs.reduce((sum, r) => sum + Math.min(Math.max(r.stage - 1, 0), stepsPerRoom), 0);
  return { total: rs.length, done, stepsDone, stepsTotal, pct: stepsTotal ? Math.floor(stepsDone / stepsTotal * 100) : 0, stagesPresent: new Set(rs.filter(r => r.stage < last).map(r => r.stage)) };
}
const projectStatus = pid => { const p = progress(pid); return !p.total ? 'new' : p.done === p.total ? 'done' : 'active'; };
const sortById = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
const typeColor = m => {
  const n = (m.name + ' ' + m.colorCode).toLowerCase();
  if (/white|w980|snow/.test(n)) return '#F4F2EE';
  if (/black|u999|ebony/.test(n)) return '#2E2D2A';
  if (/walnut/.test(n)) return '#6B4F3A';
  if (/oak/.test(n)) return '#C9A77C';
  if (/gr[ae]y|stone|concrete/.test(n)) return '#A3A09A';
  return { Melamine: '#ECE8E2', Plywood: '#D9B98C', MDF: '#B89A7A', 'Particle Board': '#CDB896', 'Edge Banding': '#B1A595' }[m.type] || '#C9C3BA';
};

/* ---------------- job materials vs stock ---------------- */
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Raw material lines: [{ name, colorCode, qty }]. Each room has its own list (room.materials).
// Projects may still carry an older job-level list, or one text box ("Vicenza Oak H3157(), Classic White ()").
function estimateRows(p) {
  if (Array.isArray(p.materials)) return p.materials;
  return String(p.materialEstimate || '').split(/[,;\n]+/).map(part => {
    const words = part.replace(/\(\s*\)/g, ' ').trim().split(/\s+/).filter(Boolean);
    const code = words.length > 1 && /^[A-Z]{1,3}\d{2,5}[A-Z]?$/i.test(words.at(-1)) ? words.pop() : '';
    return { name: words.join(' '), colorCode: code, qty: '' };
  }).filter(r => r.name || r.colorCode);
}

const findStock = line =>
  (line.colorCode && S.db.materials.find(m => m.colorCode && norm(m.colorCode) === norm(line.colorCode)))
  || S.db.materials.find(m => norm(m.name) === norm(line.name)) || null;

// Material is needed until it's cut: a room's list counts until that room reaches Production;
// an older job-level list counts until every room has.
const STAGE_PRODUCTION = 5;
const needsMaterial = p => { const rs = roomsOf(p.id); return !rs.length || rs.some(r => r.stage < STAGE_PRODUCTION); };
const roomRows = r => Array.isArray(r.materials) ? r.materials.filter(l => l.name || l.colorCode) : [];
const lineKey = (stock, l) => stock ? stock.id : `${norm(l.colorCode)}|${norm(l.colorCode) ? '' : norm(l.name)}`;

// Allocates stock to jobs (soonest target date first, rooms in order) and lists what must be ordered.
function materialPlan() {
  const left = new Map(S.db.materials.map(m => [m.id, Math.max(0, +m.qty || 0)]));
  const reserved = new Map();
  const byProject = new Map(), byRoom = new Map(), orders = new Map();
  const jobs = [...S.db.projects].sort((a, b) => !a.targetDate - !b.targetDate || (a.targetDate || '').localeCompare(b.targetDate || '') || sortById(a, b));
  for (const p of jobs) {
    const sources = [
      ...roomsOf(p.id).sort(sortById).flatMap(r => roomRows(r).map(l => ({ l, room: r, active: r.stage < STAGE_PRODUCTION }))),
      ...estimateRows(p).filter(l => l.name || l.colorCode).map(l => ({ l, room: null, active: needsMaterial(p) })),
    ];
    const lines = sources.map(({ l, room, active }) => {
      const stock = findStock(l), need = Math.max(0, +l.qty || 0), key = lineKey(stock, l);
      const base = { ...l, room, stock, need, key };
      if (!active) return { ...base, covered: need, short: 0, status: 'used' };
      const have = stock ? left.get(stock.id) : 0, covered = Math.min(have, need);
      if (stock) { left.set(stock.id, have - covered); reserved.set(stock.id, (reserved.get(stock.id) || 0) + covered); }
      const short = need - covered, noAmount = !need && !(stock && +stock.qty > 0);
      const status = short > 0 || noAmount ? (stock ? 'short' : 'missing') : 'ok';
      if (status !== 'ok') {
        const o = orders.get(key) || { key, name: stock?.name || l.name, colorCode: stock?.colorCode || l.colorCode, stock, short: 0, unknown: false, jobs: [] };
        o.short += short; o.unknown ||= noAmount;
        const j = o.jobs.find(x => x.project.id === p.id);
        if (j) { j.short += short; j.noAmount ||= noAmount; } else o.jobs.push({ project: p, short, noAmount });
        orders.set(key, o);
      }
      return { ...base, covered, short, status };
    });
    byProject.set(p.id, lines);
    for (const line of lines) if (line.room) byRoom.set(line.room.id, [...(byRoom.get(line.room.id) || []), line]);
  }
  return { byProject, byRoom, orders: [...orders.values()], reserved };
}

/* ---------------- saving & sync ---------------- */
function setSync(s) { const el = $('#sync'); el.className = 'sync' + (s === 'off' ? ' off' : s === 'busy' ? ' busy' : ''); el.title = s === 'off' ? 'Offline — changes not saved' : 'Synced with team'; }

async function save(col, item) {
  const list = S.db[col], i = list.findIndex(x => x.id === item.id);
  const merged = { ...(i >= 0 ? list[i] : {}), ...item, updatedAt: new Date().toISOString() };
  if (i >= 0) list[i] = merged; else list.push(merged);
  try { await B.put(col, merged); }
  catch (e) { toast('Could not save — check connection'); throw e; }
}
async function remove(col, id) {
  S.db[col] = S.db[col].filter(x => x.id !== id);
  if (col === 'projects') S.db.rooms = S.db.rooms.filter(r => r.projectId !== id);
  try { await B.del(col, id); }
  catch (e) { toast('Could not delete — check connection'); throw e; }
}
async function saveSettings(patch) {
  Object.assign(S.db.settings, patch);
  await B.putSettings(S.db.settings).catch(() => toast('Could not save settings'));
}

// Sorts collections so a freshly loaded copy can be compared with the one on screen.
function normalize(db) {
  const out = { ...db, settings: { ...DEFAULT_SETTINGS, ...(db.settings || {}) } };
  for (const c of ['projects', 'rooms', 'materials', 'orders', 'files', 'messages', 'notifications']) out[c] = [...(db[c] || [])].sort((a, b) => a.id.localeCompare(b.id));
  out.log = [...(db.log || [])].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return out;
}
// JSON with sorted keys (the database does not keep key order).
const stableJSON = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
async function refresh() {
  try {
    const fresh = normalize(await B.load());
    if (stableJSON(fresh) === stableJSON(normalize(S.db))) return;
    S.db = fresh;
    lsSet('hakan.cache', JSON.stringify(S.db));
    const typing = view.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing) render(true);
    refreshOpenRoom();
    announceNew();
  } catch {}
}

// Pops up notifications that arrived while the app is open, and updates the bell.
function announceNew() {
  const fresh = myNotifications().filter(n => !n.read && !S.seenNotifs.has(n.id));
  fresh.forEach(n => S.seenNotifs.add(n.id));
  paintBell();
  const n = fresh[0]; if (!n) return;
  if (n.type === 'mention' && S.openRoom?.id === n.roomId && S.openRoom.tab === 'overview') { markRoomRead(n.roomId); return; }
  navigator.vibrate?.([30, 60, 30]);
  toast(`🔔 ${notifTitle(n)}`, { label: 'Open', fn: () => openNotification(n.id) });
}

/* ---------------- toast, sheet, celebrate ---------------- */
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { t.classList.remove('show'); action.fn(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2600);
}

let sheetStack = 0;
function openSheet(html, onMount) {
  closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  const sheet = $('.sheet', root), scrim = $('.scrim', root);
  requestAnimationFrame(() => { scrim.classList.add('in'); sheet.classList.add('in'); });
  scrim.onclick = () => closeSheet();
  // Drag the grab handle down to dismiss.
  let y0 = null, dy = 0;
  sheet.addEventListener('touchstart', e => { if (sheet.scrollTop <= 0 && !e.target.closest('.chat-list, textarea, .est, .tabs')) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sheet.addEventListener('touchmove', e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy > 0 && innerWidth < 760) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  sheet.addEventListener('touchend', () => { if (y0 === null) return; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 110) closeSheet(); y0 = null; });
  sheetStack++;
  onMount?.(sheet);
  document.body.style.overflow = 'hidden';
  return sheet;
}
function closeSheet(instant) {
  const root = $('#sheet-root');
  S.openRoom = null;
  if (!root.firstChild) return;
  document.body.style.overflow = '';
  if (instant) { root.innerHTML = ''; return; }
  $('.scrim', root)?.classList.remove('in');
  $('.sheet', root)?.classList.remove('in');
  const html = root.innerHTML;
  setTimeout(() => { if (root.innerHTML === html) root.innerHTML = ''; }, 320);
}

function celebrate() {
  const cols = ['#B1A595', '#292826', '#DDD6CC', '#6F6456'];
  for (let i = 0; i < 36; i++) {
    const b = document.createElement('i');
    b.className = 'burst';
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
    b.style.cssText = `left:${innerWidth / 2}px;top:${innerHeight / 2}px;background:${cols[i % 4]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 60}px;--r:${Math.random() * 720}deg`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1100);
  }
}

/* ---------------- shared components ---------------- */
function ring(pct, cls = '') {
  const r = cls === 'lg' ? 40 : 25, c = 2 * Math.PI * r, size = (r + 5) * 2;
  return `<div class="ring ${cls}"><svg viewBox="0 0 ${size} ${size}"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - pct / 100)}"/></svg><b>${pct}%</b></div>`;
}
function animateRings(root = view) { requestAnimationFrame(() => $$('.ring .fg', root).forEach(el => { el.style.strokeDashoffset = el.dataset.off; })); }

function roomCard(r, { showProject = true } = {}) {
  const p = project(r.projectId), st = stage(r.stage), d = daysIn(r), owner = st.owner;
  const due = r.dueDate && r.stage < 7 ? daysFromToday(r.dueDate) : null;
  const inst = r.installDate && r.stage < 7 ? daysFromToday(r.installDate) : null;
  return `<article class="card room tap" data-action="room" data-id="${esc(r.id)}">
    <div class="room-top">
      <span class="dot st${r.stage}" style="margin-top:7px"></span>
      <div class="grow">
        <div class="title ellipsis">${esc(r.name)}</div>
        <div class="sub ellipsis">${showProject ? `${esc(p?.client || r.projectId)} · ` : ''}${esc(r.id)}</div>
      </div>
      ${r.stage === 7 ? '<span class="badge ok">Completed</span>' : d !== null ? `<span class="badge ${d > 14 ? 'bad' : d > 7 ? 'warn' : ''}">${d}d in stage</span>` : ''}
    </div>
    <div class="steps">${stages().map(s => `<i class="${s.n < r.stage ? 'done' : s.n === r.stage ? 'cur' : ''}"></i>`).join('')}</div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      <span class="badge dark">${esc(stageLabel(r.stage))}</span>
      ${owner ? `<span class="who"><span class="mini-av">${initials(owner)}</span>${esc(owner)}</span>` : ''}
      ${due !== null ? `<span class="badge ${due < 0 ? 'bad' : due <= 3 ? 'warn' : ''}">Due ${fmtDate(r.dueDate)}</span>` : ''}
      ${inst !== null ? `<span class="badge ${inst >= 0 && inst <= 14 ? 'warn' : ''}">Install ${fmtDate(r.installDate)}</span>` : ''}
    </div>
    ${r.nextAction && r.stage < 7 ? `<div class="sub">Next: <b style="color:var(--ink);font-weight:600">${esc(r.nextAction)}</b></div>` : ''}
    ${(() => {
      const m = roomRows(r).length, f = roomFiles(r.id).length, c = canChat() ? roomMessages(r.id).length : 0;
      const unread = canChat() ? myNotifications().some(n => !n.read && n.type === 'mention' && n.roomId === r.id) : false;
      const chip = (tab, ic, label) => `<button class="room-chip" data-action="room-tab" data-id="${esc(r.id)}" data-tab="${tab}">${icon(ic)}${label}</button>`;
      return `<div class="room-chips">
        ${chip('materials', I.layers, m ? `${m} material${m > 1 ? 's' : ''}` : 'Materials')}
        ${chip('files', '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>', f ? `${f} file${f > 1 ? 's' : ''}` : 'Files')}
        ${canChat() ? chip('chat', '<path d="M4 5h16v11H9l-5 4z"/>', `${c || 'Chat'}${unread ? ' <span class="dot" style="background:var(--bad);width:7px;height:7px"></span>' : ''}`) : ''}
      </div>`;
    })()}
    ${r.stage < 7 ? `<div class="room-actions"><button class="btn sm next-btn" data-action="advance" data-id="${esc(r.id)}">${r.stage === 6 ? 'Mark completed' : `Move to ${esc(shortStage(r.stage + 1))}`} ${icon(I.arrow)}</button></div>` : ''}
  </article>`;
}

function projectCard(p, plan = materialPlan()) {
  const pr = progress(p.id), t = p.targetDate ? daysFromToday(p.targetDate) : null;
  const short = (plan.byProject.get(p.id) || []).some(l => l.status === 'short' || l.status === 'missing');
  return `<article class="card proj tap" data-href="#/project/${encodeURIComponent(p.id)}">
    <div style="min-width:0">
      <div class="id">${esc(p.id)}</div>
      <h3 class="ellipsis">${esc(p.client)}</h3>
      <div class="sub ellipsis">${esc(p.address || 'No address yet')}</div>
      <div class="meta">
        <span class="badge">${pr.total ? `${pr.done}/${pr.total} rooms done` : 'No rooms yet'}</span>
        ${t !== null && pr.done < pr.total ? `<span class="badge ${t < 0 ? 'bad' : t <= 14 ? 'warn' : ''}">Target ${fmtDate(p.targetDate)}</span>` : ''}
        ${pr.total && pr.done === pr.total ? '<span class="badge ok">Completed</span>' : ''}
        ${short ? '<span class="badge bad">Needs material</span>' : ''}
      </div>
    </div>
    ${ring(pr.pct)}
    <div class="stagebar" style="grid-column:1/-1">${stages().map(s => { const n = roomsOf(p.id).filter(r => r.stage === s.n).length; return `<i class="${n ? 'st' + s.n : ''}" title="${esc(stageLabel(s.n))}: ${n}"></i>`; }).join('')}</div>
  </article>`;
}

function empty(title, text, btn) {
  return `<div class="empty"><b>${esc(title)}</b>${esc(text)}${btn ? `<div><button class="btn" data-action="${btn.action}" ${btn.data || ''}>${icon(I.plus)}${esc(btn.label)}</button></div>` : ''}</div>`;
}

/* ---------------- views ---------------- */
function viewHome() {
  const open = openRooms(), activeProjects = S.db.projects.filter(p => projectStatus(p.id) !== 'done');
  const installs = S.db.rooms.filter(r => r.stage < 7 && r.installDate && daysFromToday(r.installDate) >= 0 && daysFromToday(r.installDate) <= 30).sort((a, b) => a.installDate.localeCompare(b.installDate));
  const installs14 = installs.filter(r => daysFromToday(r.installDate) <= 14);
  const inInstall = S.db.rooms.filter(r => r.stage === 6);
  const undated = inInstall.filter(r => !r.installDate);
  const toOrder = materialPlan().orders;
  const mine = open.filter(r => stage(r.stage).owner === S.me).sort((a, b) => (daysIn(b) ?? -1) - (daysIn(a) ?? -1));
  const attention = open.filter(r => (r.dueDate && daysFromToday(r.dueDate) < 0) || (daysIn(r) ?? 0) > 14);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return `
  <section class="hero" id="hero">
    <div class="hero-copy">
      <div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <h1>${greet}${S.me ? `,<br>${esc(S.me)}` : ''}</h1>
      <p>${mine.length ? `${mine.length} room${mine.length > 1 ? 's' : ''} waiting on you` : 'Your queue is clear'}</p>
    </div>
    <div class="hero-stats"><div><b>${open.length}</b><span>ROOMS IN WORK</span></div><div><b>${activeProjects.length}</b><span>ACTIVE JOBS</span></div></div>
    <div class="hero-hint">drag to rotate</div>
  </section>

  <div class="kpis">
    ${kpi('Active projects', activeProjects.length, I.folder, '#/projects')}
    ${kpi('Open rooms', open.length, I.door, '#/board')}
    ${kpi('In installation', inInstall.length, I.truck, '#/board?stage=6', false, installs14.length ? `${installs14.length} scheduled in 14 days` : '')}
    ${(n => kpi('Materials to order', toOrder.length, I.layers, '#/stock?f=order', toOrder.length > n, n ? `${n} already ordered` : ''))(toOrder.filter(o => orderRecord(o.key)).length)}
  </div>

  <section class="section">
    <div class="section-head"><h2>${S.me ? 'Your queue' : 'Waiting queue'}</h2><a class="link" href="#/board?mine=1">See all</a></div>
    <div class="list">${mine.slice(0, 4).map(r => roomCard(r)).join('') || empty('Nothing waiting on you', S.me ? 'Rooms land here when they reach a stage you own.' : 'Pick who you are from the menu to see your queue.')}</div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Production pipeline</h2><a class="link" href="#/board">Open board</a></div>
    <div class="card pipeline">${pipelineSVG()}</div>
  </section>

  ${attention.length ? `<section class="section">
    <div class="section-head"><h2>Needs attention</h2><span class="badge bad">${attention.length}</span></div>
    <div class="list">${attention.slice(0, 4).map(r => roomCard(r)).join('')}</div>
  </section>` : ''}

  ${toOrder.length ? `<section class="section">
    <div class="section-head"><h2>Materials to order</h2><a class="link" href="#/stock?f=order">${toOrder.length > 4 ? `All ${toOrder.length}` : 'Stock'}</a></div>
    ${orderList(toOrder.slice(0, 4))}
  </section>` : ''}

  <section class="section">
    <div class="section-head"><h2>Upcoming installs</h2><span class="small muted">next 30 days</span></div>
    ${installs.length ? `<div class="card list" style="gap:0;padding:4px 14px">${installs.map(r => `
      <button class="row tap" data-action="room" data-id="${esc(r.id)}" style="padding:12px 0;border-bottom:1px solid var(--line);text-align:left;width:100%">
        <div style="width:46px;text-align:center;flex-shrink:0"><div class="eyebrow" style="font-size:10px">${parseDay(r.installDate).toLocaleDateString(undefined, { month: 'short' })}</div><div style="font:800 22px var(--display);line-height:1">${parseDay(r.installDate).getDate()}</div></div>
        <div class="grow"><div class="title ellipsis">${esc(r.name)}</div><div class="sub ellipsis">${esc(project(r.projectId)?.client || '')} · ${rel(r.installDate)}</div></div>
        <span class="dot st${r.stage}"></span>
      </button>`).join('')}</div>` : empty('No installs scheduled', 'Add an install date to a room to see it here.')}
    ${undated.length ? `<a class="card flat row tap" href="#/board?stage=6" style="margin-top:10px;background:#F6ECDD;border-color:#EBD9BC">
      <span class="ico" style="width:34px;height:34px;border-radius:10px;background:#fff;display:grid;place-items:center;color:var(--warn)">${icon(I.clock).replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"')}</span>
      <div class="grow"><div class="title">${undated.length} room${undated.length > 1 ? 's' : ''} in installation without a date</div><div class="sub">Tap a room and set its install date to schedule it</div></div>
    </a>` : ''}
  </section>

  <section class="section">
    <div class="section-head"><h2>Projects × stages</h2><a class="link" href="#/projects">All projects</a></div>
    <div class="card matrix">${matrix()}</div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Recent activity</h2><a class="link" href="#/activity">View all</a></div>
    <div class="card">${timeline(S.db.log.slice(-5).reverse()) || '<div class="muted small">Stage changes will show up here.</div>'}</div>
  </section>`;
}
function kpi(label, n, ic, href, alert, note = '') {
  return `<a class="kpi tap ${alert ? 'alert' : ''}" href="${href}" data-tilt><span class="ico">${icon(ic)}</span><div><b data-count="${n}">0</b><span>${esc(label)}</span>${note ? `<span class="kpi-note">${esc(note)}</span>` : ''}</div></a>`;
}

function pipelineSVG() {
  const counts = stages().map(s => S.db.rooms.filter(r => r.stage === s.n).length);
  const max = Math.max(1, ...counts), W = 360, base = 150, bw = 30, gap = (W - 20 - bw * 7) / 6, dx = 12, dy = -7, H = 105;
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(Math.min(255, Math.max(0, v * f)))); return `rgb(${c.join(',')})`; };
  const colors = ['#C9BFB2', '#B1A595', '#9A8D7B', '#84786A', '#6F6456', '#514A41', '#4F7A5A'];
  return `<svg viewBox="0 0 ${W} 200" role="img" aria-label="Rooms per stage">
    <polygon points="4,${base} ${W - 6},${base} ${W - 6 + dx},${base + dy} ${4 + dx},${base + dy}" fill="#F3F0EB"/>
    ${counts.map((c, i) => {
      const x = 8 + i * (bw + gap), h = Math.max(3, c / max * H), col = colors[i];
      return `<g class="bar" data-href="#/board?stage=${i + 1}" data-h="${h}" data-x="${x}">
        <polygon class="f" fill="${col}"/><polygon class="s" fill="${shade(col, .78)}"/><polygon class="t" fill="${shade(col, 1.16)}"/>
        <text class="c" x="${x + bw / 2 + dx / 2}" text-anchor="middle" font-size="13" font-weight="700" fill="#292826">${c}</text>
        <text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle" font-size="10" font-weight="700" fill="#6F6456">${i + 1}</text>
        <text x="${x + bw / 2}" y="${base + 31}" text-anchor="middle" font-size="8.5" fill="#77716A">${esc(shortStage(i + 1))}</text>
      </g>`;
    }).join('')}
  </svg>`;
}
function animatePipeline() {
  const bars = $$('.pipeline .bar'); if (!bars.length) return;
  const base = 150, bw = 30, dx = 12, dy = -7, t0 = performance.now();
  const draw = k => bars.forEach((g, i) => {
    const x = +g.dataset.x, e = Math.min(1, Math.max(0, k - i * 0.06)), ease = 1 - Math.pow(1 - e, 3), h = +g.dataset.h * ease, y = base - h;
    $('.f', g).setAttribute('points', `${x},${y} ${x + bw},${y} ${x + bw},${base} ${x},${base}`);
    $('.s', g).setAttribute('points', `${x + bw},${y} ${x + bw + dx},${y + dy} ${x + bw + dx},${base + dy} ${x + bw},${base}`);
    $('.t', g).setAttribute('points', `${x},${y} ${x + dx},${y + dy} ${x + bw + dx},${y + dy} ${x + bw},${y}`);
    $('.c', g).setAttribute('y', y + dy - 6);
  });
  const step = now => { const k = (now - t0) / 900; draw(k); if (k < 1.4) requestAnimationFrame(step); };
  draw(0); requestAnimationFrame(step);
}

function matrix() {
  const ps = S.db.projects.filter(p => roomsOf(p.id).length).sort(sortById);
  if (!ps.length) return '<div class="muted small">Add rooms to projects to fill this grid.</div>';
  return `<table><thead><tr><th>Project</th>${stages().map(s => `<th title="${esc(stageLabel(s.n))}">${s.n}</th>`).join('')}</tr></thead><tbody>
    ${ps.map(p => `<tr><td class="nm"><a href="#/project/${encodeURIComponent(p.id)}">${esc(p.client)}</a></td>${stages().map(s => { const n = roomsOf(p.id).filter(r => r.stage === s.n).length; return `<td style="${n ? `background:var(--s${s.n});color:${s.n >= 5 ? '#fff' : 'var(--ink)'}` : 'color:var(--taupe-200)'}">${n || '·'}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table><div class="small muted" style="margin-top:8px">${stages().map(s => `${s.n} ${esc(s.name)}`).join(' · ')}</div>`;
}

function timeline(entries) {
  return entries.length ? `<div class="timeline">${entries.map(l => `
    <div class="tl"><span class="mini-av">${initials(l.by)}</span><div>
      <div class="what"><b>${esc(l.by || 'Someone')}</b> moved <b>${esc(l.room)}</b>${l.client ? ` · ${esc(l.client)}` : ''}</div>
      <div class="what small"><span class="muted">${esc(shortStage(l.from))}</span> <span class="arrow">→</span> <b>${esc(stageLabel(l.to))}</b></div>
      <div class="when">${timeAgo(l.ts)}</div>
    </div></div>`).join('')}</div>` : '';
}

function viewProjects(q) {
  const f = q.get('f') || 'all';
  const term = (S.filters.projectSearch || '').toLowerCase();
  // Open jobs first, soonest target date on top (jobs without a date after them, newest first);
  // completed jobs drop to the bottom in the same order.
  const all = [...S.db.projects].sort((a, b) =>
    (projectStatus(a.id) === 'done') - (projectStatus(b.id) === 'done')
    || !a.targetDate - !b.targetDate
    || (a.targetDate || '').localeCompare(b.targetDate || '')
    || sortById(b, a));
  const counts = { active: 0, new: 0, done: 0 };
  all.forEach(p => counts[projectStatus(p.id)]++);
  const list = all.filter(p => (f === 'all' || projectStatus(p.id) === f) && (!term || `${p.id} ${p.client} ${p.address}`.toLowerCase().includes(term)));
  return `
  <div class="page-title"><h1>Projects</h1><button class="btn sm" data-action="new-project">${icon(I.plus)}New</button></div>
  <label class="search">${icon(I.search)}<input id="psearch" type="search" placeholder="Search client, address or ID" value="${esc(S.filters.projectSearch || '')}"></label>
  <div class="chips">
    ${[['all', 'All'], ['active', 'In progress'], ['new', 'Not started'], ['done', 'Completed']].map(([k, l]) => `<a class="chip ${f === k ? 'on' : ''}" href="#/projects?f=${k}">${l}<span class="n">${k === 'all' ? all.length : counts[k]}</span></a>`).join('')}
  </div>
  <div class="list grid-2" style="margin-top:10px">${(plan => list.map(p => projectCard(p, plan)))(materialPlan()).join('') || empty('No projects here', term ? 'Try a different search.' : 'Start a new job to begin tracking it.', { action: 'new-project', label: 'New project' })}</div>`;
}

function viewProject(id) {
  const p = project(id);
  if (!p) return `<a class="back" href="#/projects">${icon(I.chevL)}Projects</a>${empty('Project not found', 'It may have been deleted.')}`;
  const pr = progress(id), rooms = roomsOf(id).sort((a, b) => a.stage - b.stage || sortById(a, b));
  const log = S.db.log.filter(l => l.projectId === id).slice(-6).reverse();
  const link = (u, label) => u ? (driveUrl(u) ? `<a href="${esc(driveUrl(u))}" target="_blank" rel="noopener">${esc(label || 'Open')}</a>` : esc(u)) : '<span class="muted">—</span>';
  return `
  <a class="back" href="#/projects">${icon(I.chevL)}Projects</a>
  <div class="detail-head">
    <div style="min-width:0;position:relative;z-index:1">
      <div class="eyebrow">${esc(p.id)}</div>
      <h1>${esc(p.client)}</h1>
      <div class="sub">${pr.total ? `${pr.stepsDone} of ${pr.stepsTotal} steps done · ${pr.done} of ${pr.total} rooms complete` : 'No rooms yet'}</div>
      ${driveUrl(p.driveLink)
        ? `<a class="docs-btn" href="${esc(driveUrl(p.driveLink))}" target="_blank" rel="noopener">${icon(I.folder)}Project Documents${icon('<path d="M7 17 17 7M9 7h8v8"/>')}</a>`
        : `<button class="docs-btn empty" data-action="add-drive-link" data-id="${esc(p.id)}">${icon(I.folder)}Project Documents<span>add link</span></button>`}
    </div>
    <div style="position:relative;z-index:1">${ring(pr.pct, 'lg')}</div>
  </div>
  <div class="sheet-actions two" style="margin-top:14px">
    <button class="btn taupe" data-action="add-rooms" data-id="${esc(id)}">${icon(I.plus)}Add rooms</button>
    <button class="btn ghost" data-action="edit-project" data-id="${esc(id)}">${icon(I.edit)}Edit job</button>
  </div>

  <section class="section">
    <div class="section-head"><h2>Rooms</h2><span class="small muted">${rooms.length} total</span></div>
    <div class="list">${rooms.map(r => roomCard(r, { showProject: false })).join('') || empty('No rooms yet', 'Add the kitchen, closets, baths… each room moves through the stages on its own.', { action: 'add-rooms', label: 'Add rooms', data: `data-id="${esc(id)}"` })}</div>
  </section>

  ${jobMaterials(p)}

  <section class="section">
    <div class="section-head"><h2>Job details</h2></div>
    <dl class="card info">
      <div><dt>Address</dt><dd>${p.address ? `<a href="https://maps.google.com/?q=${encodeURIComponent(p.address)}" target="_blank" rel="noopener">${esc(p.address)}</a>` : '<span class="muted">—</span>'}</dd></div>
      <div><dt>Target completion</dt><dd>${p.targetDate ? `${fmtDate(p.targetDate)} <span class="muted small">(${rel(p.targetDate)})</span>` : '<span class="muted">—</span>'}</dd></div>
      <div><dt>Drive folder</dt><dd>${link(p.driveLink, 'Open folder')}</dd></div>
      <div><dt>Hardware estimate</dt><dd>${esc(p.hardwareEstimate) || '<span class="muted">—</span>'}</dd></div>
      <div><dt>Notes</dt><dd>${esc(p.notes) || '<span class="muted">—</span>'}</dd></div>
    </dl>
  </section>

  ${log.length ? `<section class="section"><div class="section-head"><h2>Activity</h2></div><div class="card">${timeline(log)}</div></section>` : ''}`;
}

// The project's Google Drive folder as an openable web address ('' if it isn't a link yet).
function driveUrl(v) {
  const s = String(v || '').trim();
  if (/^https?:\/\/\S+$/i.test(s)) return s;
  if (/^(drive|docs)\.google\.com\/\S+$/i.test(s)) return 'https://' + s;
  return '';
}

const fmtQty = n => Number.isInteger(+n) ? String(+n) : (+n).toFixed(1);

// Status badge for one material line (or a group of lines) against stock.
function matStatus(l) {
  return ({
    ok: '<span class="badge ok">In stock</span>',
    used: '<span class="badge">In production</span>',
    short: l.need ? `<span class="badge bad">Order ${fmtQty(l.short)}</span>` : '<span class="badge warn">Set amount</span>',
    missing: `<span class="badge bad">${l.need ? `Order ${fmtQty(l.short)}` : 'Not in stock'}</span>`,
  })[l.status];
}

// Project page: each material totalled across the job's rooms, tap to see the room-by-room breakdown.
function jobMaterials(p) {
  const lines = materialPlan().byProject.get(p.id) || [];
  const groups = new Map();
  for (const l of lines) {
    const g = groups.get(l.key) || { name: l.stock?.name || l.name, colorCode: l.stock?.colorCode || l.colorCode, stock: l.stock, need: 0, short: 0, lines: [] };
    g.need += l.need; g.short += l.short; g.lines.push(l);
    groups.set(l.key, g);
  }
  for (const g of groups.values()) {
    const open = g.lines.filter(l => l.status !== 'used');
    g.status = !open.length ? 'used' : open.some(l => l.status === 'missing') ? 'missing' : open.some(l => l.status === 'short') ? 'short' : 'ok';
    if (g.status === 'short' && !g.short) g.need = 0; // shows "Set amount"
  }
  const total = lines.reduce((s, l) => s + l.need, 0), roomCount = new Set(lines.filter(l => l.room).map(l => l.room.id)).size;
  const shortCount = [...groups.values()].filter(g => g.status === 'short' || g.status === 'missing').length;
  return `<section class="section">
    <div class="section-head"><h2>Raw materials</h2>${shortCount ? `<a class="badge bad" href="#/stock?f=order">${shortCount} to order</a>` : lines.length ? '<span class="badge ok">All covered</span>' : ''}</div>
    ${lines.length ? `<div class="small muted" style="margin:-4px 0 10px">Job total: <b style="color:var(--ink)">${fmtQty(total)} sheets</b> from ${roomCount} room${roomCount === 1 ? '' : 's'} · tap a material to see each room</div>
    <div class="card mtable" style="padding:2px 14px">${[...groups.values()].map(g => `
      <details class="mgroup">
        <summary class="mline">
          <div style="min-width:0"><div class="nm ellipsis">${esc(g.name || g.colorCode)}</div>
            <div class="cd">${(() => { const cut = g.lines.filter(l => l.status === 'used').reduce((s, l) => s + l.need, 0); return [g.colorCode && g.name ? esc(g.colorCode) : '', g.need ? `<b>${fmtQty(g.need)}</b> total` : 'no amount', cut && g.status !== 'used' ? `${fmtQty(cut)} already cut` : '', g.status !== 'used' ? (g.stock ? `${fmtQty(g.stock.qty)} in stock` : 'not in stock') : ''].filter(Boolean).join(' · '); })()}</div></div>
          ${matStatus(g)}
        </summary>
        <div class="mrooms">${g.lines.map(l => `
          <button class="mroom" ${l.room ? `data-action="room-tab" data-id="${esc(l.room.id)}" data-tab="materials"` : `data-action="edit-project" data-id="${esc(p.id)}"`}>
            <span class="grow ellipsis">${l.room ? esc(l.room.name) : '<i>Job-level (not in a room)</i>'}</span>
            <b>${l.need ? fmtQty(l.need) : '—'}</b>${matStatus(l)}
          </button>`).join('')}</div>
      </details>`).join('')}</div>`
      : empty('No materials listed yet', 'Open a room and add its raw material estimate in the Materials tab. The job total adds up here automatically.')}
  </section>`;
}

function viewBoard(q) {
  const st = q.has('stage') ? +q.get('stage') : (S.filters.boardStage ?? 0);
  const mine = q.has('mine') ? q.get('mine') === '1' : !!S.filters.mine;
  S.filters.boardStage = st; S.filters.mine = mine;
  let rooms = S.db.rooms.filter(r => st ? r.stage === st : r.stage < 7);
  if (mine) rooms = rooms.filter(r => stage(r.stage).owner === S.me);
  rooms.sort((a, b) => a.stage - b.stage || (daysIn(b) ?? -1) - (daysIn(a) ?? -1) || sortById(a, b));
  const count = n => S.db.rooms.filter(r => (n ? r.stage === n : r.stage < 7) && (!mine || stage(r.stage).owner === S.me)).length;
  const qs = (s, m) => `#/board?stage=${s}&mine=${m ? 1 : 0}`;
  return `
  <div class="page-title"><h1>Board</h1>
    <a class="chip ${mine ? 'on' : ''}" href="${qs(st, !mine)}">${mine ? '✓ ' : ''}Only mine</a>
  </div>
  <div class="chips">
    <a class="chip ${!st ? 'on' : ''}" href="${qs(0, mine)}">All open<span class="n">${count(0)}</span></a>
    ${stages().map(s => `<a class="chip ${st === s.n ? 'on' : ''}" href="${qs(s.n, mine)}"><span class="dot st${s.n}"></span>${esc(s.name)}<span class="n">${count(s.n)}</span></a>`).join('')}
  </div>
  ${st ? `<div class="card flat row" style="margin-top:10px;background:var(--taupe-50)"><span class="mini-av" style="width:34px;height:34px">${initials(stage(st).owner || '✓')}</span><div class="grow"><div class="title">${esc(stage(st).name)}</div><div class="sub">${stage(st).owner ? `Owner: ${esc(stage(st).owner)}` : 'Finished rooms'}</div></div></div>` : ''}
  <div class="list grid-2" style="margin-top:12px">${rooms.map(r => roomCard(r)).join('') || empty('No rooms here', mine ? 'Nothing in your stages right now.' : 'Rooms will appear here as they move through production.')}</div>`;
}

function viewStock(q) {
  const f = q.get('f') || S.filters.stock || 'all';
  S.filters.stock = f;
  const term = (S.filters.stockSearch || '').toLowerCase();
  const plan = materialPlan();
  const match = s => !term || s.toLowerCase().includes(term);
  const all = [...S.db.materials].sort((a, b) => a.name.localeCompare(b.name));
  const list = all.filter(m => (f === 'all' || m.type === f) && match(`${m.name} ${m.colorCode} ${m.type} ${m.location}`));
  const orders = plan.orders.filter(o => match(`${o.name} ${o.colorCode} ${o.jobs.map(j => j.project.client).join(' ')}`));
  const total = all.reduce((s, m) => s + (+m.qty || 0), 0);
  const types = [...new Set(all.map(m => m.type).filter(Boolean))];
  return `
  <div class="page-title"><h1>Material stock</h1><button class="btn sm" data-action="new-material">${icon(I.plus)}Add</button></div>
  <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:0 0 14px">
    <div class="kpi" style="min-height:0"><div><b data-count="${total}">0</b><span>Sheets on hand</span></div></div>
    <div class="kpi" style="min-height:0"><div><b data-count="${all.length}">0</b><span>Materials</span></div></div>
    <a class="kpi tap ${plan.orders.length ? 'alert' : ''}" href="#/stock?f=order" style="min-height:0"><div><b data-count="${plan.orders.length}">0</b><span>To order</span></div></a>
  </div>
  <label class="search">${icon(I.search)}<input id="ssearch" type="search" placeholder="Search material, color code, client" value="${esc(S.filters.stockSearch || '')}"></label>
  <div class="chips">
    <a class="chip ${f === 'all' ? 'on' : ''}" href="#/stock?f=all">All<span class="n">${all.length}</span></a>
    <a class="chip ${f === 'order' ? 'on' : ''}" href="#/stock?f=order">To order<span class="n">${plan.orders.length}</span></a>
    ${types.map(t => `<a class="chip ${f === t ? 'on' : ''}" href="#/stock?f=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
  </div>
  ${f === 'all' || f === 'order' ? `<section class="section" style="margin-top:14px">
    <div class="section-head"><h2>To order for jobs</h2><span class="small muted">from raw material estimates</span></div>
    ${orders.length ? orderList(orders) : empty('Nothing to order', 'Every job’s raw material estimate is covered by what is in stock.')}
  </section>` : ''}
  ${f !== 'order' ? `<section class="section" style="margin-top:${f === 'all' ? 26 : 10}px">
    ${f === 'all' ? '<div class="section-head"><h2>In stock</h2></div>' : ''}
    <div class="list grid-2">${list.map(m => matCard(m, plan)).join('') || empty('No materials here', 'Add sheet goods to keep track of what is on the racks.', { action: 'new-material', label: 'Add material' })}</div>
  </section>` : ''}`;
}

// Materials jobs need that stock doesn't cover, with the jobs asking for them.
const orderRecord = key => (S.db.orders || []).find(x => x.id === key);

// One line under an ordered material: when it was ordered and when it should arrive.
function orderInfo(o, rec) {
  if (!rec) return '';
  const d = rec.eta ? daysFromToday(rec.eta) : null;
  const when = rec.eta
    ? (d < 0 ? `<b style="color:var(--bad)">Delivery was due ${fmtDate(rec.eta)}</b>` : `Delivery <b>${parseDay(rec.eta).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b> (${rel(rec.eta)})`)
    : '<b>Add delivery date</b>';
  return `<button class="order-info" data-action="order-date" data-key="${esc(o.key)}">
    ${icon(I.truck)}<span>Ordered ${fmtDate(rec.orderedAt.slice(0, 10))}${rec.orderedBy ? ` by ${esc(rec.orderedBy)}` : ''} · ${when}</span>
  </button>`;
}

function orderList(orders) {
  return `<div class="card mtable" style="padding:2px 14px">${orders.map(o => {
    const rec = orderRecord(o.key);
    return `
    <div class="mline">
      <div style="min-width:0"><div class="nm ellipsis">${esc(o.name || o.colorCode)}</div>
        <div class="cd">${[o.colorCode && o.name ? esc(o.colorCode) : '', o.stock ? `${fmtQty(o.stock.qty)} in stock` : 'not in stock'].filter(Boolean).join(' · ')}</div></div>
      <div style="text-align:right"><div style="font:800 20px var(--display);color:${rec ? 'var(--ok)' : 'var(--bad)'};line-height:1.1">${o.short ? fmtQty(o.short) : '?'}</div><div class="cd">${!o.short ? 'amount not set' : rec ? 'on order' : 'to order'}</div></div>
      ${orderInfo(o, rec)}
      <div class="order-jobs">
        ${o.jobs.map(j => `<a class="badge" href="#/project/${encodeURIComponent(j.project.id)}">${esc(j.project.client)}${j.short ? ` · ${fmtQty(j.short)}` : ''}</a>`).join('')}
        <span class="order-actions">
          <button class="btn sm ghost order-btn ${rec ? 'on' : ''}" data-action="toggle-ordered" data-key="${esc(o.key)}" aria-pressed="${!!rec}">${rec ? icon('<path d="m5 12 5 5L20 7"/>') + 'Ordered' : 'Mark ordered'}</button>
          <button class="btn sm ghost order-btn" data-action="received" data-key="${esc(o.key)}">${icon(I.box)}Received</button>
        </span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// Ask for the expected delivery date when someone marks a material as ordered (or changes the date).
function sheetOrdered(key) {
  const o = materialPlan().orders.find(x => x.key === key);
  if (!o) return;
  const rec = orderRecord(key);
  openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">${esc([o.name, o.colorCode].filter(Boolean).join(' · '))}</div>
      <h2>${rec ? 'Delivery date' : 'Mark as ordered'}</h2>
      <div class="sub">${o.short ? `${fmtQty(o.short)} sheets` : 'Amount not set'} for ${o.jobs.map(j => esc(j.project.client)).join(', ')}</div></div></div>
    <form class="form" id="ordered-form">
      ${field('Estimated delivery date', 'eta', rec?.eta || '', 'date', `min="${today()}"`)}
      <div class="sheet-actions two">
        <button type="button" class="btn ghost" id="no-date">${rec ? 'Cancel' : 'No date yet'}</button>
        <button class="btn" type="submit">${rec ? 'Save date' : 'Mark ordered'}</button>
      </div>
    </form>`, sheet => {
    const done = async eta => {
      await save('orders', {
        id: key, name: o.name, colorCode: o.colorCode, qty: o.short,
        orderedAt: rec?.orderedAt || new Date().toISOString(), orderedBy: rec?.orderedBy ?? S.me ?? '', eta,
      });
      buzz(); closeSheet(); render(true);
      toast(eta ? `Ordered · delivery ${fmtDate(eta)}` : 'Marked as ordered');
    };
    $('#ordered-form', sheet).onsubmit = e => { e.preventDefault(); done(formData(e.target).eta || ''); };
    $('#no-date', sheet).onclick = () => rec ? closeSheet() : done('');
    if (!rec) setTimeout(() => $('[name=eta]', sheet).focus(), 350);
  });
}

async function toggleOrdered(key) {
  const rec = orderRecord(key);
  if (!rec) return sheetOrdered(key);
  buzz();
  await remove('orders', key);
  render(true);
  toast(`${rec.name || rec.colorCode} no longer marked as ordered`, { label: 'Undo', fn: async () => { await save('orders', rec); render(true); } });
}

function matCard(m, plan = materialPlan()) {
  const layers = Math.min(14, Math.max(0, Math.round(m.qty)));
  const reserved = plan.reserved.get(m.id) || 0, order = plan.orders.find(o => o.stock?.id === m.id);
  const free = Math.max(0, (+m.qty || 0) - reserved);
  return `<article class="card mat" data-id="${esc(m.id)}">
    <button class="stack3d" data-action="edit-material" data-id="${esc(m.id)}" aria-label="Edit ${esc(m.name)}">
      <span class="shadow"></span>
      <span class="pile">${Array.from({ length: layers }, (_, i) => `<i class="ply" style="--i:${i};--c:${typeColor(m)}"></i>`).join('')}</span>
    </button>
    <div style="min-width:0">
      <button class="row" data-action="edit-material" data-id="${esc(m.id)}" style="width:100%;text-align:left">
        <div class="grow"><div class="title ellipsis">${esc(m.name)}</div>
        <div class="sub ellipsis">${[m.colorCode, m.thickness, m.size].filter(Boolean).map(esc).join(' · ')}</div></div>
        ${order ? `<span class="badge bad">Order ${order.short ? fmtQty(order.short) : ''}</span>` : reserved ? '<span class="badge warn">Reserved</span>' : '<span class="badge ok">Free</span>'}
      </button>
      <div class="lvl" title="Reserved for jobs"><i style="width:${m.qty > 0 ? Math.min(100, reserved / m.qty * 100) : 0}%"></i></div>
      <div class="qty">
        <button data-action="qty" data-id="${esc(m.id)}" data-d="-1" aria-label="Use one sheet">−</button>
        <div style="text-align:center"><b>${m.qty}</b><div class="unit">sheets</div></div>
        <button data-action="qty" data-id="${esc(m.id)}" data-d="1" aria-label="Add one sheet">+</button>
        <div class="grow small muted" style="text-align:right;line-height:1.3">${reserved ? `${fmtQty(reserved)} for jobs<br>${fmtQty(free)} free` : m.location ? esc(m.location) : ''}</div>
      </div>
    </div>
  </article>`;
}

/* ---------------- notifications ---------------- */
function notifTitle(n) {
  if (n.type === 'test') return 'Test notification';
  return n.type === 'mention'
    ? `${n.by || 'Someone'} tagged you · ${n.room}${n.client ? `, ${n.client}` : ''}`
    : `${n.room}${n.client ? ` · ${n.client}` : ''} is ready for ${stage(n.to).name}`;
}
function paintBell() {
  const n = S.db ? unreadCount() : 0, b = $('#bell-n');
  if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
}
async function openNotification(id) {
  const n = myNotifications().find(x => x.id === id); if (!n) return;
  if (!n.read) { n.read = true; paintBell(); B.update('notifications', n).catch(() => {}); render(true); }
  if (n.type === 'test') return;
  if (!S.db.rooms.some(r => r.id === n.roomId)) return toast('That room no longer exists');
  if (!location.hash.startsWith('#/project/')) location.hash = `#/project/${encodeURIComponent(n.projectId)}`;
  setTimeout(() => sheetRoom(n.roomId, n.type === 'mention' ? 'chat' : 'overview'), 60);
}

/* ---------------- phone (push) notifications ---------------- */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64ToBytes = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function deviceId(sub) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
async function swReg() {
  await navigator.serviceWorker.register('sw.js');
  return navigator.serviceWorker.ready;
}
// 'on' | 'off' | 'denied' | 'install' (iPhone: add to Home Screen first) | 'unsupported' | 'local'
async function pushState() {
  if (!B.pushAvailable || !VAPID_PUBLIC_KEY) return 'local';
  if (!pushSupported()) return isAppleMobile() && !isStandalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}
async function enablePush() {
  try {
    if (await Notification.requestPermission() !== 'granted') { toast('Notifications were not allowed'); paintPushCard(); return false; }
    const reg = await swReg();
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
    await B.savePush(await deviceId(sub), myEmail(), sub.toJSON());
    toast('Phone notifications are on ✓'); paintPushCard(); return true;
  } catch (e) {
    toast('Could not turn on notifications'); console.warn(e); paintPushCard(); return false;
  }
}
async function disablePush() {
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (sub) { await B.deletePush(await deviceId(sub)).catch(() => {}); await sub.unsubscribe(); }
  toast('Phone notifications turned off for this device'); paintPushCard();
}
// Keeps this device linked to whoever is signed in (in case the phone is shared or the login changed).
async function syncPush() {
  if (await pushState() !== 'on') return;
  const sub = await (await navigator.serviceWorker.getRegistration()).pushManager.getSubscription();
  B.savePush(await deviceId(sub), myEmail(), sub.toJSON()).catch(() => {});
}
async function sendTestPush() {
  await B.insert('notifications', { id: uid(), toEmail: myEmail(), toName: S.me || '', by: S.me || '', ts: new Date().toISOString(), read: false, type: 'test', text: 'Phone notifications are working on this device ✓' });
  toast('Test sent. Lock your phone or switch apps; it should arrive in a few seconds.');
}
async function paintPushCard() {
  const el = $('#push-card'); if (!el) return;
  const state = await pushState();
  const body = {
    on: `<div class="title">✓ Phone notifications are on</div><div class="sub">You'll get a notification on this device even when the app is closed or the screen is locked.</div>
         <div class="row" style="margin-top:12px;gap:8px"><button class="btn sm" data-action="push-test">Send a test</button><button class="btn sm ghost" data-action="push-off">Turn off</button></div>`,
    off: `<div class="title">Get notifications on this phone</div><div class="sub">See tags and stage changes even when the app is closed or the screen is locked.</div>
          <button class="btn block" data-action="push-on" style="margin-top:12px">${icon('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>')}Turn on phone notifications</button>`,
    denied: `<div class="title">Notifications are blocked</div><div class="sub">Turn them back on in your phone's settings: <b>Settings → Notifications → Hakan</b> (iPhone), or long-press the Hakan app icon → <b>App info → Notifications</b> (Android). Then come back here.</div>`,
    install: `<div class="title">First, add Hakan to your Home Screen</div><div class="sub">On iPhone, notifications only work in the Home Screen app. In Safari, tap <b>Share → Add to Home Screen</b>, open Hakan from your Home Screen, sign in, and come back to this page.</div>`,
    unsupported: `<div class="title">This browser can't show notifications</div><div class="sub">Use Chrome on Android, or Safari on iPhone (from the Home Screen app).</div>`,
    local: '',
  }[state];
  el.hidden = !body;
  el.className = `card push-card ${state}`;
  el.innerHTML = body;
}

function viewNotifications() {
  const list = myNotifications(), unread = list.filter(n => !n.read).length;
  const groups = {};
  list.forEach(n => { const d = new Date(n.ts).toDateString(); (groups[d] = groups[d] || []).push(n); });
  return `<div class="page-title"><h1>Notifications</h1>${unread ? '<button class="btn sm ghost" data-action="read-all">Mark all read</button>' : ''}</div>
  <div id="push-card" class="card push-card" hidden></div>
  <div class="chips" style="margin-bottom:6px"><span class="small muted" style="padding:6px 0">You get a notification when someone tags you in a room chat, or when a room reaches a stage you own.</span></div>
  ${Object.entries(groups).map(([d, ns]) => `<section class="section" style="margin-top:14px">
    <div class="eyebrow" style="margin-bottom:8px">${new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    <div class="card notif-list">${ns.map(n => `
      <button class="notif ${n.read ? '' : 'unread'}" data-action="open-notif" data-id="${esc(n.id)}">
        <span class="notif-ico ${n.type}">${n.type === 'mention' ? '@' : n.type === 'test' ? '✓' : icon(I.arrow)}</span>
        <span class="grow" style="min-width:0">
          <span class="title" style="display:block">${esc(notifTitle(n))}</span>
          ${n.type === 'mention' ? `<span class="sub notif-text">“${esc(n.text)}”</span>` : n.type === 'test' ? `<span class="sub">${esc(n.text)}</span>` : `<span class="sub">${esc(n.by || 'Someone')} moved it from ${esc(shortStage(n.from))} → ${esc(stage(n.to).name)}</span>`}
          <span class="when">${timeAgo(n.ts)}</span>
        </span>
        ${n.read ? '' : '<span class="dot" style="background:var(--bad)"></span>'}
      </button>`).join('')}</div>
  </section>`).join('') || empty('No notifications yet', 'When someone tags you in a room chat, or a room reaches your stage, it shows up here.')}`;
}

function viewActivity() {
  const log = [...S.db.log].reverse();
  const groups = {};
  log.forEach(l => { const d = new Date(l.ts).toDateString(); (groups[d] = groups[d] || []).push(l); });
  return `<div class="page-title"><h1>Activity</h1></div>
  ${Object.entries(groups).map(([d, ls]) => `<section class="section" style="margin-top:14px"><div class="eyebrow" style="margin-bottom:8px">${new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div><div class="card">${timeline(ls)}</div></section>`).join('') || empty('No activity yet', 'Every stage change is recorded here automatically.')}`;
}

function viewSettings() {
  const s = set();
  const listEditor = (key, label) => `<section class="section"><div class="section-head"><h2>${label}</h2></div>
    <div class="pick" data-list="${key}">${s[key].map((v, i) => `<button data-action="list-del" data-key="${key}" data-i="${i}">${esc(v)} <span class="muted">×</span></button>`).join('')}<button class="add" data-action="list-add" data-key="${key}">+ Add</button></div></section>`;
  return `<div class="page-title"><h1>Team & settings</h1></div>
  <section class="section" style="margin-top:0"><div class="section-head"><h2>Who is using this phone?</h2></div>
    <div class="people">${s.people.map(p => `<button class="${S.me === p.name ? 'on' : ''}" data-action="set-me" data-name="${esc(p.name)}"><span class="avatar">${initials(p.name)}</span>${esc(p.name)}</button>`).join('')}</div>
  </section>
  <section class="section"><div class="section-head"><h2>Team</h2><button class="link" data-action="add-person" style="font-weight:600;color:var(--taupe-700)">+ Add person</button></div>
    <div class="card list" style="gap:0;padding:2px 14px">${s.people.map((p, i) => `<button class="row" data-action="edit-person" data-i="${i}" style="padding:12px 0;border-bottom:1px solid var(--line);width:100%;text-align:left"><span class="mini-av" style="width:34px;height:34px;font-size:12px">${initials(p.name)}</span><div class="grow"><div class="title">${esc(p.name)}</div><div class="sub ellipsis">${esc(p.email || 'No email')}</div></div>${icon(I.edit).replace('<svg', '<svg width="18" height="18" fill="none" stroke="#6F6456" stroke-width="2"')}</button>`).join('')}</div>
  </section>
  <section class="section"><div class="section-head"><h2>Stage owners</h2></div>
    <div class="card form">${stages().filter(st => st.n < 7).map(st => `<label class="field"><span>${esc(stageLabel(st.n))}</span><select data-action="stage-owner" data-n="${st.n}"><option value="">—</option>${s.people.map(p => `<option ${p.name === st.owner ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`).join('')}</div>
  </section>
  <section class="section"><div class="section-head"><h2>Room chat</h2></div>
    <div class="card flat" style="background:var(--taupe-50)">
      <div class="title">Only these people can see room chats</div>
      <div class="pick" style="margin:10px 0">${S.chatMembers.map(e => `<span class="badge dark">${esc(set().people.find(p => p.email?.toLowerCase() === e)?.name || e)}</span>`).join('') || '<span class="muted small">Not set up yet</span>'}</div>
      <div class="sub">For privacy, this list can't be changed from the app. To add or remove someone, ask Claude for the one-line database update.</div>
    </div>
  </section>
  ${listEditor('roomTypes', 'Room types')}
  ${listEditor('materialTypes', 'Material types')}
  ${listEditor('sheetSizes', 'Sheet sizes')}
  ${listEditor('thicknesses', 'Thicknesses')}
  <section class="section"><div class="section-head"><h2>Data</h2></div>
    <div class="card menu">
      <button data-action="export-json">${icon(I.download)}Download full backup (.json)</button>
      <button data-action="export-csv" data-col="projects">${icon(I.download)}Projects spreadsheet (.csv)</button>
      <button data-action="export-csv" data-col="rooms">${icon(I.download)}Rooms spreadsheet (.csv)</button>
      <button data-action="export-csv" data-col="materials">${icon(I.download)}Material stock spreadsheet (.csv)</button>
      <button data-action="import-json">${icon(I.upload)}Restore from backup…</button>
    </div>
  </section>
  <section class="section"><div class="card flat" style="background:var(--taupe-50)"><div class="title">Put Hakan on your home screen</div><div class="sub" style="margin-top:4px">iPhone: tap Share → <b>Add to Home Screen</b>. Android: tap ⋮ → <b>Install app</b>. It opens full-screen like a normal app.</div></div></section>`;
}

/* ---------------- sheets ---------------- */
function field(label, name, value = '', type = 'text', extra = '') {
  if (type === 'textarea') return `<label class="field"><span>${label}</span><textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function select(label, name, value, options, allowBlank = true) {
  const opts = [...new Set([...(value && !options.includes(value) ? [value] : []), ...options])];
  return `<label class="field"><span>${label}</span><select name="${name}">${allowBlank ? '<option value="">—</option>' : ''}${opts.map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
}
const formData = form => Object.fromEntries(new FormData(form).entries());

/* ---------------- room: chat, files, notifications helpers ---------------- */
const myEmail = () => (S.user?.email || personEmail(S.me) || '').toLowerCase();
const canChat = () => !!myEmail() && S.chatMembers.includes(myEmail());
const chatPeople = () => set().people.filter(p => p.email && S.chatMembers.includes(p.email.toLowerCase()));
const roomMessages = id => (S.db.messages || []).filter(m => m.roomId === id).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
const roomFiles = id => (S.db.files || []).filter(f => f.roomId === id).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
const myNotifications = () => (S.db.notifications || []).filter(n => (n.toEmail || '').toLowerCase() === myEmail()).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
const unreadCount = () => myNotifications().filter(n => !n.read).length;
const fmtSize = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
// Allowed room files: drawings, CNC programs, photos and videos.
const FILE_KINDS = {
  pdf: 'pdf', xxl: 'xxl',
  jpg: 'image', jpeg: 'image', png: 'image', heic: 'image', heif: 'image', webp: 'image', gif: 'image',
  mp4: 'video', mov: 'video', m4v: 'video', webm: 'video', '3gp': 'video',
};
const FILE_TYPES = Object.keys(FILE_KINDS);
const fileKind = f => FILE_KINDS[(f.type || '').toLowerCase()] || 'other';
// Photos and videos picked on a phone sometimes have no extension; fall back to their type.
const fileExt = file => {
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  if (FILE_KINDS[ext]) return ext;
  const fromMime = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[file.type];
  return fromMime || ext;
};
const MAX_FILE = 50 * 1048576;

// Sends a notification to a teammate by name (skips yourself and people without an email).
async function notify(toName, data) {
  const email = personEmail(toName).toLowerCase();
  if (!email || email === myEmail()) return;
  const n = { id: uid(), toEmail: email, toName, by: S.me || '', ts: new Date().toISOString(), read: false, ...data };
  try { await B.insert('notifications', n); } catch { /* a missed notification must not block the user's action */ }
}

// Chat text with @Name tags highlighted.
function chatText(text) {
  const names = chatPeople().map(p => p.name).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  let html = esc(text).replace(/\n/g, '<br>');
  if (names.length) html = html.replace(new RegExp(`@(${names.join('|')})\\b`, 'gi'), '<b class="tag">@$1</b>');
  return html;
}
// Chat messages as rows, styled like the stage list.
function chatList(roomId) {
  const msgs = roomMessages(roomId);
  if (!msgs.length) return '<div class="row-empty">No messages yet. Tag someone with @ to ping them.</div>';
  return msgs.map(m => {
    const mine = (m.byEmail || '').toLowerCase() === myEmail(), d = new Date(m.ts);
    const when = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    return `<div class="lrow crow ${mine ? 'mine' : ''}">
      <span class="num">${initials(m.by)}</span>
      <div class="grow" style="min-width:0">
        <div class="lrow-head"><span class="nm">${mine ? 'You' : esc(m.by)}</span><span class="ow">${when}</span>${mine ? `<button class="lrow-del" data-action="delete-msg" data-id="${esc(m.id)}" aria-label="Delete message">${icon(I.trash)}</button>` : ''}</div>
        <div class="crow-text">${chatText(m.text)}</div>
      </div>
    </div>`;
  }).join('');
}
// Room files as rows, styled like the stage list. Photos show a small preview.
function fileList(roomId) {
  const files = roomFiles(roomId);
  return files.map(f => {
    const kind = fileKind(f), label = kind === 'image' ? 'IMG' : kind === 'video' ? 'VID' : (f.type || '').toUpperCase().slice(0, 4);
    return `<div class="lrow frow">
      <a class="frow-open" data-file="${esc(f.id)}" href="#" target="_blank" rel="noopener">
        <span class="num fthumb ${kind}">${kind === 'image' || kind === 'video' ? `<img data-thumb="${esc(f.id)}" alt="" hidden>` : ''}<span>${esc(label)}</span>${kind === 'video' ? '<i class="play" aria-hidden="true"></i>' : ''}</span>
        <span class="grow" style="min-width:0"><span class="nm ellipsis">${esc(f.name)}</span><span class="ow">${fmtSize(f.size || 0)} · ${esc(f.by || '')} · ${fmtDate((f.ts || '').slice(0, 10))}</span></span>
      </a>
      <button class="lrow-del lrow-edit" data-action="rename-file" data-id="${esc(f.id)}" aria-label="Rename ${esc(f.name)}">${icon(I.edit)}</button>
      <button class="lrow-del" data-action="delete-file" data-id="${esc(f.id)}" aria-label="Delete ${esc(f.name)}">${icon(I.trash)}</button>
    </div>`;
  }).join('') || '<div class="row-empty">No files yet. Add drawings (PDF), CNC programs (XXL), photos or videos.</div>';
}
function roomMaterialStatus(roomId) {
  const lines = materialPlan().byRoom.get(roomId) || [];
  return lines.length ? `<div class="card mtable" style="padding:2px 14px;margin-top:14px">${lines.map(l => `<div class="mline">
      <div style="min-width:0"><div class="nm ellipsis">${esc(l.name || l.colorCode)}</div><div class="cd">${[l.colorCode && l.name ? esc(l.colorCode) : '', l.need ? `${fmtQty(l.need)} needed` : 'no amount', l.status !== 'used' ? (l.stock ? `${fmtQty(l.stock.qty)} in stock` : 'not in stock') : ''].filter(Boolean).join(' · ')}</div></div>
      ${matStatus(l)}</div>`).join('')}</div>` : '';
}

// Updates the parts of an open room screen that teammates can change while you look at it.
function refreshOpenRoom() {
  const o = S.openRoom; if (!o) return;
  const list = $('#chat-list');
  if (list) {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = chatList(o.id);
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
  const files = $('#file-list'); // left alone while someone is typing a new file name
  if (files && !$('.rename-box', files)) { files.innerHTML = fileList(o.id); signFileLinks(files); }
  const n = (sel, v) => { const el = $(sel); if (el) el.textContent = v || ''; };
  n('#chat-n', roomMessages(o.id).length); n('#files-n', roomFiles(o.id).length); n('#tab-n-materials', roomRows(S.db.rooms.find(r => r.id === o.id) || {}).length);
}

// tab: 'overview' | 'materials'; 'files' or 'chat' open Overview scrolled to that section.
function sheetRoom(id, tab = 'overview') {
  const r = S.db.rooms.find(x => x.id === id); if (!r) return;
  const focus = ['files', 'chat'].includes(tab) ? tab : null;
  if (focus) tab = 'overview';
  const p = project(r.projectId), d = daysIn(r);
  const hist = S.db.log.filter(l => l.roomId === id).slice().reverse();
  const tabs = [['overview', 'Overview'], ['materials', 'Materials']];
  const count = { materials: roomRows(r).length };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  openSheet(`
    <div class="sheet-head"><div style="min-width:0"><div class="eyebrow">${esc(p?.client || r.projectId)} · ${esc(r.id)}</div><h2>${esc(r.name)}</h2>
      <div class="sub">${esc(stageLabel(r.stage))}${stage(r.stage).owner ? ` · ${esc(stage(r.stage).owner)}` : ''}${d !== null ? ` · ${d} days in stage` : ''}</div></div>
      <a class="icon-btn" href="#/project/${encodeURIComponent(r.projectId)}" data-action="close" aria-label="Open project">${icon(I.folder)}</a>
    </div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}${k !== 'overview' ? `<span class="n" id="tab-n-${k}">${count[k] || ''}</span>` : ''}</button>`).join('')}</div>

    <div class="pane" data-pane="overview" ${tab === 'overview' ? '' : 'hidden'}>
      ${r.stage < 7 ? `<button class="btn block taupe" data-action="advance" data-id="${esc(r.id)}" style="height:54px;font-size:16px">${r.stage === 6 ? 'Mark completed ✓' : `Move to ${esc(stageLabel(r.stage + 1))}`} ${icon(I.arrow)}</button>` : ''}

      <div id="room-files" class="room-section">
        <div class="eyebrow" style="margin:18px 0 6px">Files <span id="files-n" class="sec-n">${roomFiles(id).length || ''}</span></div>
        <label class="btn block ghost add-files">${icon(I.upload)}Add files
          <input type="file" id="file-input" multiple hidden ${isIOS ? '' : 'accept=".pdf,.xxl,image/*,video/*"'}>
        </label>
        <div class="small muted" style="margin:6px 2px 8px">PDF, XXL, photos and videos · up to 50 MB each</div>
        <div id="file-uploading" class="stepper"></div>
        <div id="file-list" class="stepper">${fileList(r.id)}</div>
        ${r.filesLink ? `<div class="small" style="margin-top:8px">Older link: ${driveUrl(r.filesLink) ? `<a href="${esc(driveUrl(r.filesLink))}" target="_blank" rel="noopener" style="color:var(--taupe-700);font-weight:600">${esc(r.filesLink)}</a>` : esc(r.filesLink)}</div>` : ''}
      </div>

      ${canChat() ? `<div id="room-chat" class="room-section">
        <div class="eyebrow" style="margin:18px 0 6px">Chat <span id="chat-n" class="sec-n">${roomMessages(id).length || ''}</span> <span class="eyebrow-note">· private to ${chatPeople().map(p => esc(p.name)).join(', ')}</span></div>
        <div id="chat-list" class="stepper chat-list">${chatList(r.id)}</div>
        <form id="chat-form" class="chat-compose">
          <div class="tag-row">${chatPeople().filter(p => p.email.toLowerCase() !== myEmail()).map(p => `<button type="button" data-tag="${esc(p.name)}">@${esc(p.name)}</button>`).join('')}</div>
          <div class="compose-row">
            <textarea name="text" rows="1" placeholder="Message… tap a name to tag" aria-label="Message"></textarea>
            <button class="send" type="submit" aria-label="Send">${icon('<path d="M4 12 20 4l-6 16-3-7z"/>')}</button>
          </div>
        </form>
      </div>` : ''}

      <div class="eyebrow" style="margin:18px 0 6px">Stage — tap to change</div>
      <div class="stepper">${stages().map(s => `<button data-action="set-stage" data-id="${esc(r.id)}" data-n="${s.n}" class="${s.n < r.stage ? 'done' : s.n === r.stage ? 'cur' : ''}"><span class="num">${s.n < r.stage ? '✓' : s.n}</span><span class="nm">${esc(s.name)}</span><span class="ow">${esc(s.owner)}</span></button>`).join('')}</div>
      <form class="form" id="room-form" style="margin-top:18px">
        <div class="eyebrow">Details</div>
        ${select('Room', 'name', r.name, set().roomTypes, false)}
        ${field('Next action', 'nextAction', r.nextAction, 'text', 'placeholder="e.g. Confirm hinge type with client"')}
        <div class="field-row">${field('Due date', 'dueDate', r.dueDate, 'date')}${field('Install date', 'installDate', r.installDate, 'date')}</div>
        ${field('Notes', 'notes', r.notes, 'textarea')}
        <div class="sheet-actions two"><button type="button" class="btn danger" data-action="delete-room" data-id="${esc(r.id)}">${icon(I.trash)}Delete</button><button class="btn" type="submit">Save</button></div>
      </form>
      ${hist.length ? `<div class="eyebrow" style="margin:22px 0 4px">History</div>${timeline(hist)}` : ''}
    </div>

    <div class="pane" data-pane="materials" ${tab === 'materials' ? '' : 'hidden'}>
      <div class="sub" style="margin-bottom:10px">Raw material estimate for this room. The project page adds up all rooms into the job total.</div>
      <form class="form" id="room-mat-form">
        ${estTable(roomRows(r))}
        <button class="btn block" type="submit">Save materials</button>
      </form>
      <div id="room-mat-status">${roomMaterialStatus(r.id)}</div>
    </div>
  `, sheet => {
    S.openRoom = { id, tab };
    const show = k => {
      S.openRoom.tab = k;
      $$('.tabs button', sheet).forEach(b => b.classList.toggle('on', b.dataset.tab === k));
      $$('.pane', sheet).forEach(p => { p.hidden = p.dataset.pane !== k; });
      if (k === 'overview') {
        const l = $('#chat-list', sheet); if (l) { l.scrollTop = l.scrollHeight; markRoomRead(id); }
        $$('a[data-signed]', sheet).forEach(a => delete a.dataset.signed); signFileLinks(sheet); // fresh file links each visit
      }
    };
    $('.tabs', sheet).onclick = e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); };
    show(tab);
    // Opened from a Files/Chat shortcut or a chat notification: bring that section into view.
    if (focus) setTimeout(() => $(`#room-${focus}`, sheet)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 380);

    $('#room-form', sheet).onsubmit = async e => {
      e.preventDefault();
      // Start from the latest copy so materials, stage or teammates' changes made since opening are kept.
      await save('rooms', { ...S.db.rooms.find(x => x.id === id), ...formData(e.target) });
      closeSheet(); toast('Room saved'); render(true);
    };

    const matForm = $('#room-mat-form', sheet);
    wireEst(matForm);
    matForm.onsubmit = async e => {
      e.preventDefault();
      await save('rooms', { ...S.db.rooms.find(x => x.id === id), materials: readEst(matForm) });
      $('#room-mat-status', sheet).innerHTML = roomMaterialStatus(id);
      refreshOpenRoom(); render(true); toast('Materials saved');
    };

    signFileLinks(sheet);
    // A link that isn't ready yet (slow connection) opens the file once its address arrives.
    $('#file-list', sheet).addEventListener('click', e => {
      const a = e.target.closest('a[data-file]');
      if (a && !a.dataset.signed) { e.preventDefault(); openFile(a.dataset.file); }
    });
    $('#file-input', sheet).onchange = async e => {
      const files = [...e.target.files]; e.target.value = '';
      for (const file of files) await uploadRoomFile(r, file, $('#file-uploading', sheet));
    };

    const chat = $('#chat-form', sheet);
    if (chat) {
      const ta = $('textarea', chat);
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };
      ta.addEventListener('input', grow);
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); chat.requestSubmit(); } });
      $('.tag-row', chat).onclick = e => {
        const b = e.target.closest('[data-tag]'); if (!b) return;
        const pos = ta.selectionStart ?? ta.value.length, before = ta.value.slice(0, pos), tag = `@${b.dataset.tag} `;
        ta.value = before + (before && !/\s$/.test(before) ? ' ' : '') + tag + ta.value.slice(pos);
        ta.focus(); grow(); buzz();
      };
      chat.onsubmit = async e => {
        e.preventDefault();
        const text = ta.value.trim(); if (!text) return;
        ta.value = ''; grow();
        await sendMessage(r, text);
      };
    }
  });
}

async function sendMessage(r, text) {
  const mentions = chatPeople().filter(p => new RegExp(`@${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)).map(p => p.name);
  const m = { id: uid(), roomId: r.id, projectId: r.projectId, by: S.me || '', byEmail: myEmail(), text, ts: new Date().toISOString(), mentions };
  S.db.messages.push(m);
  refreshOpenRoom();
  const list = $('#chat-list'); if (list) list.scrollTop = list.scrollHeight;
  try { await B.insert('messages', m); }
  catch { S.db.messages = S.db.messages.filter(x => x.id !== m.id); refreshOpenRoom(); toast('Message not sent — check connection'); return; }
  const p = project(r.projectId);
  for (const name of mentions) {
    await notify(name, { type: 'mention', roomId: r.id, projectId: r.projectId, room: r.name, client: p?.client || '', text: text.slice(0, 140) });
  }
  if (mentions.length) toast(`Pinged ${mentions.join(', ')}`);
}

// Small square preview (JPEG) made on the phone at upload: a photo shrunk down, or a video's first frame.
// Returns null if this device can't read the file (e.g. HEIC photos outside Safari); the row then shows a label.
async function makeThumb(file, kind) {
  const url = URL.createObjectURL(file);
  const timeout = ms => new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms));
  try {
    let src, w, h;
    if (kind === 'image') {
      const img = new Image();
      await Promise.race([new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; }), timeout(8000)]);
      src = img; w = img.naturalWidth; h = img.naturalHeight;
    } else {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      await Promise.race([new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = no; }), timeout(10000)]);
      v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
      await Promise.race([new Promise(ok => { v.onseeked = ok; }), timeout(5000)]);
      src = v; w = v.videoWidth; h = v.videoHeight;
    }
    if (!w || !h) return null;
    const size = 160, s = Math.min(w, h), c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size); // centre square crop
    return await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.8));
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

async function uploadRoomFile(r, file, statusEl) {
  const ext = fileExt(file);
  if (!FILE_TYPES.includes(ext)) return toast(`${file.name}: only PDF, XXL, photos and videos can be added`);
  if (file.size > MAX_FILE) return toast(`${file.name} is larger than 50 MB${FILE_KINDS[ext] === 'video' ? ' — trim the video or share it through Project Documents' : ''}`);
  const kind = FILE_KINDS[ext];
  const row = document.createElement('div');
  row.className = 'lrow frow uploading';
  row.innerHTML = `<span class="num fthumb ${kind}"><span>${kind === 'image' ? 'IMG' : kind === 'video' ? 'VID' : ext.toUpperCase()}</span></span><span class="grow ellipsis nm">${esc(file.name)}</span><span class="ow">Uploading…</span>`;
  statusEl?.appendChild(row);
  const name = file.name.includes('.') ? file.name : `${file.name || 'photo'}.${ext}`;
  const safe = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${r.projectId}/${r.id}/${uid()}-${safe}`;
  file = file.name === name ? file : new File([file], name, { type: file.type });
  try {
    await B.uploadFile(path, file);
    let thumbPath = '';
    if (kind === 'image' || kind === 'video') {
      const thumb = await makeThumb(file, kind);
      if (thumb) {
        thumbPath = `${path}.thumb.jpg`;
        await B.uploadFile(thumbPath, new File([thumb], 'thumb.jpg', { type: 'image/jpeg' })).catch(() => { thumbPath = ''; });
      }
    }
    await save('files', { id: uid(), roomId: r.id, projectId: r.projectId, name: file.name, path, thumbPath, size: file.size, type: ext, by: S.me || '', ts: new Date().toISOString() });
    toast(`${file.name} added`);
  } catch (e) {
    toast(`Could not upload ${file.name}`);
  } finally {
    row.remove(); refreshOpenRoom(); render(true);
  }
}

// File links are private, short-lived web addresses. They're prepared as soon as the list shows,
// so a tap is a normal link (phones, especially iPhone Home Screen apps, block tabs opened later).
// PDFs, photos and videos open in the browser; XXL programs download.
const opensInBrowser = f => ['pdf', 'image', 'video'].includes(fileKind(f));
async function signFileLinks(root = document) {
  for (const a of $$('a[data-file]', root)) {
    if (a.dataset.signed) continue;
    const f = (S.db.files || []).find(x => x.id === a.dataset.file); if (!f) continue;
    try {
      a.href = await B.fileUrl(f.path, opensInBrowser(f) ? undefined : f.name);
      if (!opensInBrowser(f)) a.setAttribute('download', f.name);
      a.dataset.signed = '1';
      const img = $(`img[data-thumb="${CSS.escape(f.id)}"]`, a);
      if (img && !img.src) {
        if (f.thumbPath) { // small preview saved at upload
          img.onload = () => { img.hidden = false; }; img.onerror = () => img.remove();
          img.src = await B.fileUrl(f.thumbPath);
        } else if (fileKind(f) === 'image') { // older photo: show the picture itself
          img.onload = () => { img.hidden = false; }; img.onerror = () => img.remove(); img.src = a.href;
        } else { // older video: let the browser show its first frame
          const v = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'metadata' });
          v.className = 'thumb-video'; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
          v.onloadeddata = () => v.classList.add('ready'); v.onerror = () => v.remove();
          v.src = `${a.href}#t=0.1`;
          img.replaceWith(v);
        }
      }
    } catch { /* tapping falls back to openFile */ }
  }
}
async function openFile(id) {
  const f = (S.db.files || []).find(x => x.id === id); if (!f) return;
  try { location.href = await B.fileUrl(f.path, opensInBrowser(f) ? undefined : f.name); }
  catch { toast('Could not open the file — check connection'); }
}
// Rename a file in place: the name turns into a text box (Enter or tap away saves, Esc cancels).
// Only the name people see changes; the extension is kept so the file still opens correctly.
function renameFile(btn) {
  const f = (S.db.files || []).find(x => x.id === btn.dataset.id); if (!f) return;
  const row = btn.closest('.frow'), link = $('.frow-open', row);
  const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : `.${f.type}`;
  const base = f.name.slice(0, f.name.length - ext.length) || f.name;
  const box = document.createElement('div');
  box.className = 'frow-open';
  box.innerHTML = `${$('.fthumb', link).outerHTML}<span class="grow rename-box"><input type="text" value="${esc(base)}" maxlength="120" aria-label="New file name" enterkeyhint="done"><span class="ow">${esc(ext)} is kept</span></span>
    <button type="button" class="rename-ok" aria-label="Save name">✓</button>`;
  link.replaceWith(box);
  $$('.lrow-del', row).forEach(b => { b.hidden = true; });
  const input = $('input', box);
  $('.rename-ok', box).addEventListener('pointerdown', e => e.preventDefault()); // keep the box focused so ✓ saves, not "tap away"
  $('.rename-ok', box).addEventListener('click', () => finish(true));
  input.focus(); input.select();
  let done = false;
  const finish = async keep => {
    if (done) return; done = true;
    const name = input.value.replace(/[\\/]+/g, '-').trim();
    box.classList.remove('rename-box'); $('.rename-box', box)?.classList.remove('rename-box');
    if (keep && name && name !== base) {
      await save('files', { ...f, name: name + ext });
      toast('File renamed');
    }
    refreshOpenRoom(); render(true);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

// Deletes a room's files from storage too (so they stop using space).
async function deleteRoomFiles(roomId) {
  for (const f of roomFiles(roomId)) {
    await B.deleteFile(f.path).catch(() => {});
    if (f.thumbPath) await B.deleteFile(f.thumbPath).catch(() => {});
    await remove('files', f.id).catch(() => {});
  }
}

// Marks this room's chat notifications as read once you open the chat.
function markRoomRead(roomId) {
  for (const n of myNotifications().filter(n => !n.read && n.roomId === roomId && n.type === 'mention')) {
    n.read = true; B.update('notifications', n).catch(() => {});
  }
  paintBell();
}

const estRow = r => `<div class="est-row">
  <input name="mname" list="stock-names" value="${esc(r.name)}" placeholder="Material" aria-label="Material name" autocomplete="off">
  <input name="mcode" value="${esc(r.colorCode)}" placeholder="Code" aria-label="Color code" autocomplete="off">
  <input name="mqty" type="number" inputmode="decimal" min="0" step="any" value="${esc(r.qty)}" placeholder="Qty" aria-label="Amount">
  <button type="button" class="est-del" aria-label="Remove row">×</button>
</div>`;

// Name / Color code / Amount table with an "Add row" button (at least 3 rows to start).
function estTable(rows, minRows = 3) {
  return `<div class="est">
      <div class="est-head"><span>Name</span><span>Color code</span><span>Amount</span><span></span></div>
      ${[...rows, ...Array(Math.max(0, minRows - rows.length)).fill({})].map(estRow).join('')}
    </div>
    <button type="button" class="btn ghost sm est-add" style="justify-self:start">${icon(I.plus)}Add row</button>
    <datalist id="stock-names">${S.db.materials.map(m => `<option value="${esc(m.name)}">${esc(m.colorCode)}</option>`).join('')}</datalist>`;
}
function wireEst(root) {
  const est = $('.est', root);
  $('.est-add', root).onclick = () => { est.insertAdjacentHTML('beforeend', estRow({})); $('.est-row:last-child input', est).focus(); };
  est.addEventListener('click', e => { if (e.target.closest('.est-del')) e.target.closest('.est-row').remove(); });
  // Picking a material that is already in stock fills in its color code.
  est.addEventListener('change', e => {
    if (e.target.name !== 'mname') return;
    const code = $('[name=mcode]', e.target.closest('.est-row')), m = S.db.materials.find(x => norm(x.name) === norm(e.target.value));
    if (m && !code.value) code.value = m.colorCode || '';
  });
}
const readEst = root => $$('.est-row', root)
  .map(r => ({ name: $('[name=mname]', r).value.trim(), colorCode: $('[name=mcode]', r).value.trim(), qty: $('[name=mqty]', r).value === '' ? '' : Math.max(0, +$('[name=mqty]', r).value) }))
  .filter(r => r.name || r.colorCode);

function sheetProject(id) {
  const p = id ? project(id) : null;
  const nextId = 'HK-' + String(Math.max(0, ...S.db.projects.map(x => +x.id.replace(/\D/g, '') || 0)) + 1).padStart(3, '0');
  const legacy = p ? estimateRows(p) : [];
  openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">${p ? esc(p.id) : `New job · ${nextId}`}</div><h2>${p ? 'Edit job' : 'New project'}</h2></div></div>
    <form class="form" id="proj-form">
      ${field('Client name *', 'client', p?.client, 'text', 'required autocomplete="off"')}
      ${field('Address', 'address', p?.address, 'text', 'autocomplete="street-address"')}
      ${field('Target completion', 'targetDate', p?.targetDate, 'date')}
      ${field('Drive folder link (opens with “Project Documents”)', 'driveLink', p?.driveLink, 'text', 'placeholder="https://drive.google.com/drive/folders/…" inputmode="url" autocomplete="off"')}
      ${legacy.length ? `<div class="field" id="legacy-est"><span>Older job-level material list</span>
        <div class="small muted" style="margin-bottom:4px">Raw materials now go in each room (room → Materials tab). Move these lines into the right rooms, then delete them here.</div>
        ${estTable(legacy, 0)}
      </div>` : ''}
      ${field('Hardware estimate', 'hardwareEstimate', p?.hardwareEstimate, 'textarea', 'placeholder="e.g. 42 soft-close hinges, 14 drawer slides"')}
      ${field('Notes', 'notes', p?.notes, 'textarea')}
      <div class="sheet-actions ${p ? 'two' : ''}">
        ${p ? `<button type="button" class="btn danger" data-action="delete-project" data-id="${esc(p.id)}">${icon(I.trash)}Delete</button>` : ''}
        <button class="btn" type="submit">${p ? 'Save' : 'Create & add rooms'}</button>
      </div>
    </form>`, sheet => {
    const legacyBox = $('#legacy-est', sheet);
    if (legacyBox) wireEst(legacyBox);
    $('#proj-form', sheet).onsubmit = async e => {
      e.preventDefault();
      const { mname, mcode, mqty, ...data } = formData(e.target);
      if (legacyBox) { data.materials = readEst(legacyBox); data.materialEstimate = ''; }
      const item = p ? { ...p, ...data } : { id: nextId, createdAt: new Date().toISOString(), ...data };
      await save('projects', item);
      toast(p ? 'Job saved' : `${item.client} created`);
      if (p) { closeSheet(); render(true); } else { location.hash = `#/project/${encodeURIComponent(item.id)}`; sheetAddRooms(item.id); }
    };
  });
}

function sheetAddRooms(pid) {
  const p = project(pid);
  const picked = new Set();
  openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">${esc(p.id)} · ${esc(p.client)}</div><h2>Add rooms</h2><div class="sub">Tap every room in this job. Tap twice to add two of the same.</div></div></div>
    <div class="pick" id="room-pick">${set().roomTypes.map(t => `<button type="button" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <form class="form" id="rooms-form" style="margin-top:16px">
      ${field('Other room name', 'custom', '', 'text', 'placeholder="e.g. Butler\'s pantry"')}
      <label class="field"><span>Starting stage</span><select name="stage">${stages().map(s => `<option value="${s.n}">${esc(stageLabel(s.n))}</option>`).join('')}</select></label>
      <button class="btn block" type="submit" id="rooms-go" disabled>Add rooms</button>
    </form>`, sheet => {
    const go = $('#rooms-go', sheet), counts = {};
    const upd = () => { const n = Object.values(counts).reduce((a, b) => a + b, 0) + ($('[name=custom]', sheet).value.trim() ? 1 : 0); go.disabled = !n; go.textContent = n ? `Add ${n} room${n > 1 ? 's' : ''}` : 'Add rooms'; };
    $('#room-pick', sheet).onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const t = b.dataset.t; counts[t] = ((counts[t] || 0) + 1) % 3;
      b.classList.toggle('on', counts[t] > 0);
      b.textContent = t + (counts[t] > 1 ? ` ×${counts[t]}` : '');
      if (!counts[t]) delete counts[t];
      buzz(); upd();
    };
    $('[name=custom]', sheet).oninput = upd;
    $('#rooms-form', sheet).onsubmit = async e => {
      e.preventDefault();
      const { custom, stage: stg } = formData(e.target);
      const names = Object.entries(counts).flatMap(([t, n]) => Array(n).fill(t));
      if (custom.trim()) names.push(custom.trim());
      let n = Math.max(0, ...roomsOf(pid).map(r => +r.id.split('-R')[1] || 0));
      go.disabled = true;
      for (const name of names) {
        n++;
        await save('rooms', { id: `${pid}-R${n}`, projectId: pid, name, stage: +stg, enteredStage: today(), nextAction: '', dueDate: '', installDate: '', filesLink: '', notes: '', createdAt: new Date().toISOString() });
      }
      if (custom.trim() && !set().roomTypes.includes(custom.trim())) saveSettings({ roomTypes: [...set().roomTypes, custom.trim()] });
      closeSheet(); toast(`${names.length} room${names.length > 1 ? 's' : ''} added`); render(true);
    };
  });
}

function sheetMaterial(id) {
  const m = id ? S.db.materials.find(x => x.id === id) : null, s = set();
  openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">${m ? 'Edit material' : 'Sheet goods'}</div><h2>${m ? esc(m.name) : 'Add material'}</h2></div></div>
    <form class="form" id="mat-form">
      ${field('Material *', 'name', m?.name, 'text', 'required placeholder="e.g. Vicenza Oak"')}
      <div class="field-row">${select('Type', 'type', m?.type || s.materialTypes[0], s.materialTypes)}${field('Color code', 'colorCode', m?.colorCode, 'text', 'placeholder="H3157"')}</div>
      <div class="field-row">${select('Thickness', 'thickness', m?.thickness || '3/4"', s.thicknesses)}${select('Sheet size', 'size', m?.size || s.sheetSizes[0], s.sheetSizes)}</div>
      ${field('Sheets in stock', 'qty', m?.qty ?? 0, 'number', 'inputmode="decimal" min="0" step="any"')}
      <div class="field-row">${field('Supplier', 'supplier', m?.supplier)}${field('Shop location', 'location', m?.location, 'text', 'placeholder="Rack A"')}</div>
      ${field('Notes', 'notes', m?.notes, 'textarea')}
      <div class="sheet-actions ${m ? 'two' : ''}">
        ${m ? `<button type="button" class="btn danger" data-action="delete-material" data-id="${esc(m.id)}">${icon(I.trash)}Delete</button>` : ''}
        <button class="btn" type="submit">${m ? 'Save' : 'Add to stock'}</button>
      </div>
    </form>`, sheet => {
    $('#mat-form', sheet).onsubmit = async e => {
      e.preventDefault();
      const d = formData(e.target);
      d.qty = Math.max(0, +d.qty || 0); d.updatedAt = today();
      const nid = 'M' + String(Math.max(0, ...S.db.materials.map(x => +x.id.replace(/\D/g, '') || 0)) + 1).padStart(3, '0');
      await save('materials', m ? { ...m, ...d } : { id: nid, ...d });
      closeSheet(); toast(m ? 'Material saved' : 'Added to stock'); render(true);
    };
  });
}

function sheetQuickAdd() {
  const ps = S.db.projects.filter(p => projectStatus(p.id) !== 'done').sort(sortById).reverse();
  openSheet(`
    <div class="sheet-head"><h2>What do you want to add?</h2></div>
    <div class="qa">
      <button data-action="new-project"><span class="ico">${icon(I.folder)}</span><b>New project</b><span>A new client job</span></button>
      <button data-action="pick-project"><span class="ico">${icon(I.door)}</span><b>Rooms</b><span>Add rooms to a job</span></button>
      <button data-action="new-material"><span class="ico">${icon(I.layers)}</span><b>Material</b><span>New sheet goods</span></button>
      <button data-action="go" data-href="#/stock"><span class="ico">${icon(I.box)}</span><b>Update stock</b><span>Count sheets in/out</span></button>
    </div>
    <div id="pp" hidden style="margin-top:16px"><div class="eyebrow" style="margin-bottom:8px">Pick a project</div><div class="card menu" style="padding:0 14px">${ps.map(p => `<button data-action="add-rooms" data-id="${esc(p.id)}"><span class="mini-av">${initials(p.client)}</span><span class="grow">${esc(p.client)} <span class="muted small">${esc(p.id)}</span></span></button>`).join('') || '<div class="muted small" style="padding:12px 0">No open projects yet.</div>'}</div></div>`);
}

function sheetMenu() {
  openSheet(`
    <div class="sheet-head"><div class="row"><span class="avatar" style="width:48px;height:48px;font-size:18px">${initials(S.me || '?')}</span><div><h2>${esc(S.me || 'Who are you?')}</h2><div class="sub">${esc(personEmail(S.me) || 'Hakan Interiors')}</div></div></div></div>
    <div class="menu">
      <button data-action="bell"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>Notifications${unreadCount() ? ` <span class="badge bad">${unreadCount()}</span>` : ''}</button>
      <button data-action="who">${icon(I.users)}Switch person</button>
      <button data-action="go" data-href="#/activity">${icon(I.activity)}Activity log</button>
      <button data-action="go" data-href="#/settings">${icon(I.settings)}Team & settings</button>
      <button data-action="export-json">${icon(I.download)}Download backup</button>
      ${S.user ? `<button data-action="change-password">${icon(I.settings)}Change password</button>
      <button data-action="sign-out">${icon(I.upload).replace('<svg', '<svg style="transform:rotate(90deg)"')}Sign out</button>` : ''}
    </div>`);
}

function sheetWho() {
  openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">Welcome to Hakan</div><h2>Who's using this phone?</h2><div class="sub">We use this to show your queue and sign your updates.</div></div></div>
    <div class="people">${set().people.map(p => `<button class="${S.me === p.name ? 'on' : ''}" data-action="set-me" data-name="${esc(p.name)}"><span class="avatar">${initials(p.name)}</span>${esc(p.name)}</button>`).join('')}</div>`);
}

function sheetPerson(i) {
  const p = i != null ? set().people[i] : null;
  openSheet(`
    <div class="sheet-head"><h2>${p ? 'Edit person' : 'Add person'}</h2></div>
    <form class="form" id="person-form">
      ${field('Name *', 'name', p?.name, 'text', 'required')}
      ${field('Email', 'email', p?.email, 'email', 'placeholder="name@example.com"')}
      <div class="sheet-actions ${p ? 'two' : ''}">${p ? '<button type="button" class="btn danger" id="pdel">Remove</button>' : ''}<button class="btn" type="submit">Save</button></div>
    </form>`, sheet => {
    $('#person-form', sheet).onsubmit = async e => {
      e.preventDefault();
      const d = formData(e.target), people = [...set().people];
      if (p) {
        people[i] = d;
        if (p.name !== d.name) {
          await saveSettings({ stages: stages().map(s => s.owner === p.name ? { ...s, owner: d.name } : s) });
          if (S.me === p.name) { S.me = d.name; lsSet('hakan.me', d.name); }
        }
      } else people.push(d);
      await saveSettings({ people });
      closeSheet(); render(true);
    };
    $('#pdel', sheet)?.addEventListener('click', async () => {
      if (!confirm(`Remove ${p.name} from the team?`)) return;
      await saveSettings({ people: set().people.filter((_, j) => j !== i) });
      closeSheet(); render(true);
    });
  });
}

/* ---------------- actions ---------------- */
async function setStage(id, n) {
  const r = S.db.rooms.find(x => x.id === id);
  if (!r || r.stage === n) return;
  const prev = { stage: r.stage, enteredStage: r.enteredStage };
  const p = project(r.projectId);
  const entry = { id: uid(), ts: new Date().toISOString(), roomId: r.id, projectId: r.projectId, room: r.name, client: p?.client || '', from: r.stage, to: n, by: S.me || '' };
  buzz();
  await save('rooms', { ...r, stage: n, enteredStage: today() });
  await save('log', entry);
  closeSheet(); render(true);
  if (n === 7) celebrate();
  const owner = stage(n).owner, email = personEmail(owner);
  // The new stage's owner gets a notification once the Undo window has passed.
  const notifyTimer = n < 7 && owner && owner !== S.me ? setTimeout(() => notify(owner, {
    type: 'stage', roomId: r.id, projectId: r.projectId, room: r.name, client: p?.client || '', from: prev.stage, to: n,
    text: `${r.name} is ready for ${stage(n).name}`,
  }), 5500) : null;
  toast(n === 7 ? `${r.name} completed 🎉` : `${r.name} → ${stage(n).name}${owner ? ` · ${owner}` : ''}`, {
    label: 'Undo', fn: async () => {
      clearTimeout(notifyTimer);
      await save('rooms', { ...r, ...prev });
      await remove('log', entry.id);
      render(true); toast('Change undone');
    },
  });
  if (email && owner !== S.me && n < 7) setTimeout(() => toast(`${owner} was notified in the app. Email too?`, {
    label: 'Email', fn: () => { location.href = `mailto:${email}?subject=${encodeURIComponent(`${p?.client || ''} – ${r.name} is ready for ${stage(n).name}`)}&body=${encodeURIComponent(`Hi ${owner},\n\n${r.name} (${r.id}) for ${p?.client || r.projectId} just moved to ${stageLabel(n)}.\n${r.nextAction ? `Next action: ${r.nextAction}\n` : ''}\nOpen the tracker: ${location.href.split('#')[0]}#/project/${encodeURIComponent(r.projectId)}\n\n— ${S.me || 'Hakan team'}`)}`; },
  }), 5200);
}

const qtyTimers = {};
function changeQty(id, d) {
  const m = S.db.materials.find(x => x.id === id); if (!m) return;
  m.qty = Math.max(0, (+m.qty || 0) + d); m.updatedAt = today();
  buzz();
  const card = $(`.mat[data-id="${CSS.escape(id)}"]`);
  if (card) card.outerHTML = matCard(m);
  clearTimeout(qtyTimers[id]);
  qtyTimers[id] = setTimeout(() => save('materials', m).then(() => render(true)), 700);
}

// Order arrived: add the missing sheets to stock (creating the material if it is new).
async function receiveOrder(key) {
  const o = materialPlan().orders.find(x => x.key === key);
  if (!o) return;
  let amount = o.short;
  if (!amount) {
    const v = prompt(`How many sheets of ${o.name || o.colorCode} arrived?`);
    amount = Math.max(0, +v || 0);
    if (!amount) return;
  }
  let m = o.stock && S.db.materials.find(x => x.id === o.stock.id);
  const before = m ? { ...m } : null;
  if (m) m = { ...m, qty: (+m.qty || 0) + amount, updatedAt: today() };
  else {
    const nid = 'M' + String(Math.max(0, ...S.db.materials.map(x => +x.id.replace(/\D/g, '') || 0)) + 1).padStart(3, '0');
    const t = S.db.materials.find(x => norm(x.name) === norm(o.name))?.type || '';
    m = { id: nid, name: o.name || o.colorCode, type: t, colorCode: o.colorCode, thickness: '3/4"', size: set().sheetSizes[0] || '', qty: amount, supplier: '', location: '', notes: '', updatedAt: today() };
  }
  buzz();
  const rec = orderRecord(key);
  await save('materials', m);
  if (rec) await remove('orders', key);
  render(true);
  toast(`Added ${fmtQty(amount)} sheets of ${m.name} to stock`, {
    label: 'Undo', fn: async () => {
      if (before) await save('materials', before); else await remove('materials', m.id);
      if (rec) await save('orders', rec);
      render(true); toast('Undone');
    },
  });
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function toCSV(col) {
  const rows = S.db[col].map(x => col === 'rooms' ? { ...x, client: project(x.projectId)?.client || '', stage: stageLabel(x.stage), owner: stage(x.stage).owner, daysInStage: daysIn(x) ?? '', materials: roomRows(x).map(l => `${l.name}${l.colorCode ? ` (${l.colorCode})` : ''}${l.qty !== '' ? ` x ${l.qty}` : ''}`).join('; '), files: roomFiles(x.id).map(f => f.name).join('; ') } : col === 'projects' ? (({ materialEstimate, ...p }) => ({ ...p, materials: estimateRows(x).map(l => `${l.name}${l.colorCode ? ` (${l.colorCode})` : ''}${l.qty !== '' ? ` x ${l.qty}` : ''}`).join('; '), rooms: progress(x.id).total, completed: progress(x.id).done }))(x) : (({ reorderAt, ...m }) => ({ ...m, reservedForJobs: materialPlan().reserved.get(x.id) || 0, toOrder: materialPlan().orders.find(o => o.stock?.id === x.id)?.short || 0 }))(x));
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [keys.map(q).join(','), ...rows.map(r => keys.map(k => q(r[k])).join(','))].join('\r\n');
}

const actions = {
  'quick-add': () => sheetQuickAdd(),
  'pick-project': (el) => { const pp = $('#pp'); pp.hidden = false; pp.scrollIntoView({ behavior: 'smooth' }); },
  'new-project': () => sheetProject(),
  'edit-project': el => sheetProject(el.dataset.id),
  'add-drive-link': el => {
    sheetProject(el.dataset.id);
    const input = $('.sheet [name=driveLink]');
    toast('Paste the Google Drive folder link here');
    setTimeout(() => { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); input.focus(); input.select(); }, 380);
  },
  'delete-project': async el => {
    const p = project(el.dataset.id); if (!confirm(`Delete ${p.client} and all ${roomsOf(p.id).length} of its rooms, including their files? This cannot be undone.`)) return;
    for (const r of roomsOf(p.id)) await deleteRoomFiles(r.id);
    await remove('projects', p.id); closeSheet(); location.hash = '#/projects'; toast('Project deleted');
  },
  'add-rooms': el => sheetAddRooms(el.dataset.id),
  room: el => sheetRoom(el.dataset.id),
  'room-tab': el => sheetRoom(el.dataset.id, el.dataset.tab),
  bell: () => { closeSheet(); location.hash = '#/notifications'; },
  'open-notif': el => openNotification(el.dataset.id),
  'push-on': () => enablePush(),
  'push-off': () => disablePush(),
  'push-test': () => sendTestPush().catch(() => toast('Could not send the test')),
  'read-all': () => {
    for (const n of myNotifications().filter(n => !n.read)) { n.read = true; B.update('notifications', n).catch(() => {}); }
    paintBell(); render(true); toast('All caught up');
  },
  'open-file': el => openFile(el.dataset.id),
  'rename-file': el => renameFile(el),
  'delete-file': async el => {
    const f = S.db.files.find(x => x.id === el.dataset.id); if (!f || !confirm(`Delete ${f.name}? This cannot be undone.`)) return;
    try { await B.deleteFile(f.path); } catch { /* the record is removed even if the stored copy was already gone */ }
    if (f.thumbPath) await B.deleteFile(f.thumbPath).catch(() => {});
    await remove('files', f.id); refreshOpenRoom(); render(true); toast('File deleted');
  },
  'delete-msg': async el => {
    if (!confirm('Delete this message?')) return;
    await remove('messages', el.dataset.id); refreshOpenRoom();
  },
  advance: el => { const r = S.db.rooms.find(x => x.id === el.dataset.id); if (r && r.stage < 7) setStage(r.id, r.stage + 1); },
  'set-stage': el => setStage(el.dataset.id, +el.dataset.n),
  'delete-room': async el => {
    const n = roomFiles(el.dataset.id).length;
    if (!confirm(`Delete this room${n ? ` and its ${n} file${n > 1 ? 's' : ''}` : ''}?`)) return;
    await deleteRoomFiles(el.dataset.id);
    await remove('rooms', el.dataset.id); closeSheet(); render(true); toast('Room deleted');
  },
  'new-material': () => sheetMaterial(),
  received: el => receiveOrder(el.dataset.key),
  'toggle-ordered': el => toggleOrdered(el.dataset.key),
  'order-date': el => sheetOrdered(el.dataset.key),
  'edit-material': el => sheetMaterial(el.dataset.id),
  'delete-material': async el => { if (!confirm('Delete this material?')) return; await remove('materials', el.dataset.id); closeSheet(); render(true); toast('Material deleted'); },
  qty: el => changeQty(el.dataset.id, +el.dataset.d),
  menu: () => sheetMenu(),
  who: () => sheetWho(),
  'set-me': el => { S.me = el.dataset.name; lsSet('hakan.me', S.me); paintMe(); closeSheet(); render(true); toast(`Hi ${S.me}!`); },
  go: el => { closeSheet(); location.hash = el.dataset.href; },
  close: el => { closeSheet(); if (el.getAttribute('href')) location.hash = el.getAttribute('href'); },
  'change-password': () => sheetPassword(),
  'sign-out': async () => {
    if (!confirm('Sign out of Hakan on this phone?')) return;
    await B.signOut();
    try { localStorage.removeItem('hakan.cache'); } catch {}
    location.reload();
  },
  'add-person': () => sheetPerson(),
  'edit-person': el => sheetPerson(+el.dataset.i),
  'list-add': async el => { const v = prompt('Add a new option'); if (!v?.trim()) return; await saveSettings({ [el.dataset.key]: [...set()[el.dataset.key], v.trim()] }); render(true); },
  'list-del': async el => { const k = el.dataset.key, list = set()[k]; if (!confirm(`Remove “${list[+el.dataset.i]}” from the list?`)) return; await saveSettings({ [k]: list.filter((_, i) => i !== +el.dataset.i) }); render(true); },
  'export-json': () => { closeSheet(); download(`hakan-backup-${today()}.json`, JSON.stringify(S.db, null, 2), 'application/json'); },
  'export-csv': el => download(`hakan-${el.dataset.col}-${today()}.csv`, toCSV(el.dataset.col), 'text/csv'),
  'import-json': () => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        if (!data.settings || !['projects', 'rooms', 'materials', 'log'].every(c => Array.isArray(data[c]))) throw new Error('Not a Hakan backup');
        if (!confirm('Replace ALL current data with this backup?')) return;
        toast('Restoring…');
        await B.importAll(data);
        S.db = normalize(await B.load());
        render(true); toast('Backup restored');
      } catch (e) { toast('That file could not be restored'); }
    };
    inp.click();
  },
};

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (a && a.tagName !== 'SELECT' && actions[a.dataset.action]) {
    e.preventDefault(); e.stopPropagation();
    actions[a.dataset.action](a, e);
    return;
  }
  const h = e.target.closest('[data-href]');
  if (h) { location.hash = h.dataset.href; }
});
document.addEventListener('change', e => {
  const s = e.target.closest('[data-action="stage-owner"]');
  if (s) saveSettings({ stages: stages().map(st => st.n === +s.dataset.n ? { ...st, owner: s.value } : st) }).then(() => toast('Stage owner updated'));
});
document.addEventListener('input', e => {
  if (e.target.id === 'psearch') { S.filters.projectSearch = e.target.value; debounceRender(); }
  if (e.target.id === 'ssearch') { S.filters.stockSearch = e.target.value; debounceRender(); }
});
let drT;
function debounceRender() {
  clearTimeout(drT);
  drT = setTimeout(() => {
    const id = document.activeElement?.id, pos = document.activeElement?.selectionStart;
    render(true);
    if (id) { const el = document.getElementById(id); el?.focus(); try { el?.setSelectionRange(pos, pos); } catch {} }
  }, 180);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// 3D tilt on KPI cards (pointer devices).
document.addEventListener('pointermove', e => {
  const c = e.target.closest?.('[data-tilt]');
  $$('[data-tilt].tilting').forEach(x => { if (x !== c) { x.classList.remove('tilting'); x.style.transform = ''; } });
  if (!c || e.pointerType !== 'mouse') return;
  const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
  c.classList.add('tilting');
  c.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(6px)`;
});
// Gentle tilt of the KPI cards from phone motion.
window.addEventListener('deviceorientation', e => {
  if (e.gamma == null) return;
  $$('[data-tilt]').forEach(c => { c.style.transform = `rotateY(${Math.max(-8, Math.min(8, e.gamma / 4))}deg) rotateX(${Math.max(-8, Math.min(8, (e.beta - 45) / 6))}deg)`; });
});

/* ---------------- router ---------------- */
function paintMe() { $('#me').textContent = initials(S.me || '?'); }

async function render(keepScroll) {
  if (!S.db) return;
  const [path, qs] = (location.hash.slice(2) || 'home').split('?');
  const [page, arg] = path.split('/').map(decodeURIComponent);
  const q = new URLSearchParams(qs || '');
  const y = scrollY;
  S.disposeHero?.(); S.disposeHero = null;
  const html = { home: viewHome, projects: () => viewProjects(q), project: () => viewProject(arg), board: () => viewBoard(q), stock: () => viewStock(q), activity: viewActivity, settings: viewSettings, notifications: viewNotifications }[page]?.() ?? viewHome();
  view.innerHTML = `<div>${html}</div>`;
  paintBell();
  $('#bell')?.classList.toggle('on', page === 'notifications');
  if (page === 'notifications') {
    paintPushCard();
    // Opened from a phone notification: #/notifications?open=<id>
    const openId = q.get('open');
    if (openId) {
      history.replaceState(null, '', '#/notifications');
      (async () => { if (!myNotifications().some(n => n.id === openId)) await refresh(); openNotification(openId); })();
    }
  }
  const tab = page === 'project' ? 'projects' : page;
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
  animateRings();
  animatePipeline();
  $$('[data-count]').forEach(el => countUp(el, +el.dataset.count, keepScroll));
  const hero = $('#hero');
  if (hero) import('./scene3d.js').then(m => { if (hero.isConnected) S.disposeHero = m.mountHero(hero); }).catch(() => {});
}
function countUp(el, n, instant) {
  if (instant || n === 0) { el.textContent = n; return; }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / 700); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = n; }, 900); // animations can be paused (battery saver, background tab)
}
let lastPath = '';
addEventListener('hashchange', () => {
  const p = location.hash.split('?')[0];
  render(p === lastPath);
  lastPath = p;
});

/* ---------------- login ---------------- */
const hideSplash = () => setTimeout(() => $('#splash').classList.add('hide'), 450);

function showLogin(message = '', email = lsGet('hakan.email')) {
  document.body.classList.add('locked');
  view.innerHTML = `<div class="login">
    <img src="assets/icon-192.png" alt="" class="login-mark">
    <div class="eyebrow">Hakan Interiors</div>
    <h1>Production tracker</h1>
    <p class="muted">Sign in with the email and password you were given.</p>
    <form class="form" id="login-form">
      ${field('Email', 'email', email, 'email', 'required autocomplete="username" inputmode="email"')}
      ${field('Password', 'password', '', 'password', 'required autocomplete="current-password"')}
      <div class="login-error" role="alert">${esc(message)}</div>
      <button class="btn block" type="submit" style="height:54px">Sign in</button>
    </form>
    <p class="small muted" style="margin-top:18px">Forgot your password? Ask the account owner to reset it.</p>
  </div>`;
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    const { email, password } = formData(e.target), btn = $('button[type=submit]', e.target);
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      S.user = await B.signIn(email.trim(), password);
      lsSet('hakan.email', email.trim());
      await start();
    } catch (err) {
      showLogin(/invalid/i.test(err.message) ? 'Wrong email or password.' : 'Could not sign in — check your connection.', email);
      $('#login-form [name=password]').focus();
    }
  };
}

function sheetPassword() {
  openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">${esc(S.user?.email || '')}</div><h2>Change password</h2></div></div>
    <form class="form" id="pw-form">
      ${field('New password', 'pw', '', 'password', 'required minlength="8" autocomplete="new-password"')}
      ${field('Repeat new password', 'pw2', '', 'password', 'required minlength="8" autocomplete="new-password"')}
      <button class="btn block" type="submit">Save new password</button>
    </form>`, sheet => {
    $('#pw-form', sheet).onsubmit = async e => {
      e.preventDefault();
      const { pw, pw2 } = formData(e.target);
      if (pw !== pw2) return toast('The two passwords don’t match');
      try { await B.changePassword(pw); closeSheet(); toast('Password changed'); }
      catch (err) { toast(err.message || 'Could not change password'); }
    };
  });
}

/* ---------------- boot ---------------- */
async function start() {
  document.body.classList.remove('locked');
  try {
    S.db = normalize(await B.load());
    lsSet('hakan.cache', JSON.stringify(S.db));
  } catch {
    const cached = lsGet('hakan.cache');
    if (cached) { S.db = normalize(JSON.parse(cached)); toast('Offline — showing last saved data'); }
    else { view.innerHTML = empty('Can’t reach the database', 'Check your connection and reload.'); hideSplash(); return; }
  }
  // Signed-in users are matched to the team list by email.
  const byEmail = S.user && set().people.find(p => p.email && p.email.toLowerCase() === S.user.email.toLowerCase());
  if (byEmail) { S.me = byEmail.name; lsSet('hakan.me', S.me); }
  S.chatMembers = await B.chatMembers().catch(() => []);
  myNotifications().forEach(n => S.seenNotifs.add(n.id)); // only notifications arriving from now on pop up
  paintMe();
  lastPath = location.hash.split('?')[0];
  render();
  hideSplash();
  const unread = unreadCount();
  if (unread) setTimeout(() => toast(`🔔 You have ${unread} unread notification${unread > 1 ? 's' : ''}`, { label: 'View', fn: () => { location.hash = '#/notifications'; } }), 1200);
  if (!S.me || !set().people.some(p => p.name === S.me)) setTimeout(sheetWho, 700);
  B.watch(refresh);
  setInterval(() => S.db && lsSet('hakan.cache', JSON.stringify(S.db)), 30000);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  syncPush().catch(() => {});
  // Offer phone notifications once per device, after the user has had a moment with the app.
  setTimeout(async () => {
    if (lsGet('hakan.pushAsked') || await pushState() !== 'off') return;
    lsSet('hakan.pushAsked', '1');
    toast('Get notifications on this phone, even when the app is closed?', { label: 'Turn on', fn: enablePush });
  }, unread ? 7000 : 2500);
}

(async function boot() {
  paintMe();
  try { B = await createBackend({ onStatus: setSync }); }
  catch { view.innerHTML = empty('Can’t connect', 'Check your internet connection and reload the app.'); hideSplash(); return; }
  if (B.needsLogin) {
    S.user = await B.user().catch(() => null);
    if (!S.user) { hideSplash(); return showLogin(); }
  }
  start();
})();
