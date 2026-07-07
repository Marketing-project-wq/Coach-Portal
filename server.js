'use strict';
/**
 * 20FIT Arena — Coach Portal backend (full concept: Coach / Head Coach / Admin)
 * Zero external dependencies (Node >= 18 built-ins only).
 *
 * Env (set in Railway):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role secret), SESSION_SECRET
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://cpvzwqptzcxnwzfzgrmt.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const TOKEN_TTL = 60 * 60 * 12;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ARENA_UNIT_ID = '6e8f44a7-23d4-4602-90d4-980c63b3acc2';

if (!SERVICE_KEY) console.warn('[WARN] SUPABASE_SERVICE_KEY not set — DB calls will fail.');
const SIGNING_SECRET = SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!SESSION_SECRET) console.warn('[WARN] SESSION_SECRET not set — using ephemeral secret.');

// ---------- crypto ----------
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(String(plain), salt, 32).toString('hex')}`;
}
function verifyPassword(plain, stored) {
  try {
    const [scheme, s, h] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(h, 'hex');
    const derived = crypto.scryptSync(String(plain), Buffer.from(s, 'hex'), expected.length);
    return crypto.timingSafeEqual(derived, expected);
  } catch (_e) { return false; }
}
function b64url(b) { return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function signToken(payload) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL };
  const p = b64url(JSON.stringify(body));
  return `${p}.${b64url(crypto.createHmac('sha256', SIGNING_SECRET).update(p).digest())}`;
}
function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  const exp = b64url(crypto.createHmac('sha256', SIGNING_SECRET).update(p).digest());
  const a = Buffer.from(sig || ''), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let pl; try { pl = JSON.parse(b64urlDec(p).toString('utf8')); } catch (_e) { return null; }
  if (!pl.exp || pl.exp < Math.floor(Date.now() / 1000)) return null;
  return pl;
}

// ---------- supabase REST ----------
const enc = encodeURIComponent;
async function sb(q, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
    ...options,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => '')}`);
  if (res.status === 204) return null;
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
function todayJakarta() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); }
function hhmm(t) { return t ? String(t).slice(0, 5) : ''; }
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtDMon(d) { const dt = new Date(d + 'T00:00:00'); return dt.getDate() + ' ' + MON[dt.getMonth()]; }
function dLabel(d) { const dt = new Date(d + 'T00:00:00'); return DOW[dt.getDay()].charAt(0) + DOW[dt.getDay()].slice(1).toLowerCase() + ' ' + dt.getDate() + ' ' + MON[dt.getMonth()]; }

// ---------- data helpers ----------
let _typeCache = null;
async function classTypes() {
  if (_typeCache) return _typeCache;
  const rows = await sb('arena_class_types?select=id,name,color');
  const m = {}; for (const r of rows || []) m[r.id] = r; _typeCache = m; return m;
}
function shortType(name) { return String(name || '').replace(/^20FIT Arena\s*/i, '').replace(/^HYROX\s*/i, 'HYROX ').trim() || 'Class'; }

// Coach photo + speciality live in the shared `arena_coaches` table
// (public storage URLs), keyed by coach name. Cached — these change rarely.
let _photoCache = null, _photoCacheAt = 0;
async function coachPhotoMap() {
  if (_photoCache && (Date.now() - _photoCacheAt) < 5 * 60 * 1000) return _photoCache;
  let rows = [];
  try { rows = await sb('arena_coaches?select=name,photo_url,speciality'); } catch (_e) { rows = []; }
  const m = {};
  for (const r of rows || []) {
    if (!r || !r.name) continue;
    const k = String(r.name).trim().toLowerCase();
    const cur = m[k] || { photo: '', spec: '' };
    // Coaches can have duplicate rows; keep the first non-empty value for each field.
    m[k] = { photo: cur.photo || r.photo_url || '', spec: cur.spec || r.speciality || '' };
  }
  _photoCache = m; _photoCacheAt = Date.now();
  return m;
}
function coachPhoto(map, name) { const v = (map && name) ? map[String(name).trim().toLowerCase()] : null; return v ? v.photo : ''; }
function coachSpec(map, name) { const v = (map && name) ? map[String(name).trim().toLowerCase()] : null; return v ? v.spec : ''; }

// External coaches: participants may review them, but they must NOT see any
// participant data/names. They only get Schedule, Monitoring and Rotation.
const EXTERNAL_COACHES = new Set(['brian', 'gilang', 'mae', 'yokae']);
function isExternalCoach(name) { return EXTERNAL_COACHES.has(String(name || '').trim().toLowerCase()); }
// True when the *logged-in* account is an external coach (never applies to HC/admin).
function isExternalSession(s) { return s.r === 'coach' && isExternalCoach(s.c); }

async function bookingCounts(ids) {
  const c = {};
  if (!ids.length) return c;
  const rows = await sb(`arena_class_bookings?select=schedule_id,status&schedule_id=in.(${ids.map(enc).join(',')})&status=in.(confirmed,pending_payment)`);
  for (const r of rows || []) {
    c[r.schedule_id] = c[r.schedule_id] || { confirmed: 0, pending: 0 };
    if (r.status === 'confirmed') c[r.schedule_id].confirmed++; else c[r.schedule_id].pending++;
  }
  return c;
}
async function startedSet(ids) {
  const s = new Set();
  if (!ids.length) return s;
  const rows = await sb(`arena_class_sessions?select=schedule_id&schedule_id=in.(${ids.map(enc).join(',')})`);
  for (const r of rows || []) s.add(r.schedule_id);
  return s;
}

// Admin Hub sometimes stores co-taught classes as combined names,
// e.g. "Cindy Lauw & Rheza" or "Elsen & Ade Midhun". Split into individual
// instructor tokens so such a class shows up for each real coach involved.
function instructorTokens(instructor) {
  return String(instructor || '')
    .split(/\s*(?:&|\+|,|\/)\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
}
// True when `coach` is (one of) the instructor(s) of a class. Exact per-token
// match (case-insensitive) so "Mae" never matches e.g. an unrelated longer name.
function instructorHasCoach(instructor, coach) {
  const c = String(coach || '').trim().toLowerCase();
  if (!c) return false;
  return instructorTokens(instructor).some((t) => t.toLowerCase() === c);
}

async function coachSchedules(coach, from, to) {
  // Broaden at the DB with ilike (so "A & Coach" is fetched too), then tighten
  // with an exact per-token match in Node to drop any substring false positives.
  let q = `arena_class_schedules?select=id,schedule_date,start_time,end_time,quota,class_type_id,instructor&instructor=ilike.*${enc(coach)}*&is_cancelled=eq.false&schedule_date=gte.${from}`;
  if (to) q += `&schedule_date=lte.${to}`;
  const rows = (await sb(q + '&order=schedule_date.asc,start_time.asc')) || [];
  return rows.filter((x) => instructorHasCoach(x.instructor, coach));
}

// normalized participant name -> { name, visits, last } across a coach's past classes (confirmed bookings)
async function coachAttendanceMap(coach, today) {
  const scheds = await coachSchedules(coach, '2000-01-01', today);
  const types = await classTypes();
  const metaById = {}; const ids = [];
  for (const x of scheds) { metaById[x.id] = { date: x.schedule_date, type: shortType((types[x.class_type_id] || {}).name) }; ids.push(x.id); }
  const map = {};
  if (!ids.length) return map;
  const rows = await sb(`arena_class_bookings?select=schedule_id,full_name&status=eq.confirmed&schedule_id=in.(${ids.map(enc).join(',')})`);
  for (const b of rows || []) {
    const nm = String(b.full_name || '').trim();
    if (!nm) continue;
    const key = nm.toLowerCase();
    const meta = metaById[b.schedule_id] || { date: '', type: '' };
    if (!map[key]) map[key] = { name: nm, visits: 0, last: '', types: {} };
    map[key].visits++;
    if (meta.type) map[key].types[meta.type] = (map[key].types[meta.type] || 0) + 1;
    if (meta.date > map[key].last) { map[key].last = meta.date; map[key].name = nm; }
  }
  return map;
}
// "HYROX Complete, HYROX Foundation" — distinct classes a participant attended, most-frequent first.
function classesLabelFor(h) { return (h && h.types) ? Object.keys(h.types).sort((a, b) => h.types[b] - h.types[a]).join(', ') : ''; }
function daysSinceISO(dateISO, today) {
  if (!dateISO) return null;
  return Math.round((new Date(today + 'T00:00:00') - new Date(dateISO + 'T00:00:00')) / 86400000);
}

// 7-day calendar strip starting at weekStartISO (a Monday), with per-day class counts.
async function coachWeek(coach, weekStartISO, today) {
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const ws = new Date(weekStartISO + 'T00:00:00');
  const we = new Date(ws); we.setDate(ws.getDate() + 6);
  const sched = await coachSchedules(coach, iso(ws), iso(we));
  const week = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(ws); dt.setDate(ws.getDate() + i);
    const ds = iso(dt);
    const cnt = sched.filter((x) => x.schedule_date === ds).length;
    week.push({ dow: DOW[dt.getDay()], day: String(dt.getDate()), date: ds, count: cnt, label: cnt ? cnt + ' kls' : '—', isToday: ds === today });
  }
  const range = ws.getMonth() === we.getMonth()
    ? `${ws.getDate()}–${we.getDate()} ${MON[we.getMonth()]}`
    : `${ws.getDate()} ${MON[ws.getMonth()]} – ${we.getDate()} ${MON[we.getMonth()]}`;
  return { week, range, start: iso(ws) };
}

// Build class-card objects (used by the dashboard list and the date-range filter).
function cardsFrom(sched, counts, started, types, today) {
  return sched.map((x) => {
    const c = counts[x.id] || { confirmed: 0, pending: 0 };
    const t = types[x.class_type_id] || {};
    const isToday = x.schedule_date === today;
    const isStarted = started.has(x.id);
    const upcoming = x.schedule_date >= today; // today or later
    return { schedule_id: x.id, time: hhmm(x.start_time), end: '– ' + hhmm(x.end_time), type: shortType(t.name),
      peserta: c.confirmed + c.pending, cap: x.quota || 0, started: isStarted,
      accent: isStarted ? '#D6FF3D' : (isToday ? '#4DD4F2' : '#888F9C'),
      status: isStarted ? 'In Progress' : (isToday ? 'Upcoming' : 'Scheduled'),
      // Show the start button for any upcoming class (today or later) that isn't started yet,
      // so a coach always finds it when they open the class — not only on the exact day.
      canAbsen: upcoming && !isStarted, dateLabel: dLabel(x.schedule_date) };
  });
}

// ---------- HTTP ----------
function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'X-Content-Type-Options': 'nosniff', ...headers,
  });
  res.end(payload);
}
function readBody(req, limit = 1e6) {
  return new Promise((resolve) => {
    let d = '', big = false;
    req.on('data', (c) => { d += c; if (d.length > limit) { big = true; req.destroy(); } });
    req.on('end', () => { if (big) return resolve(null); try { resolve(d ? JSON.parse(d) : {}); } catch (_e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}
function auth(req) {
  const h = req.headers['authorization'] || '';
  return verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/review') p = '/review.html';
  const fp = path.normalize(path.join(PUBLIC_DIR, p));
  if (!fp.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  // HTML/JS must never be cached (by browser or CDN) so a new deploy shows immediately;
  // other assets use content-versioned URLs, so they can cache for a while.
  const cacheFor = (ext) => (ext === '.html' || ext === '.js') ? 'no-store, no-cache, must-revalidate, max-age=0' : 'public, max-age=3600';
  fs.readFile(fp, (err, data) => {
    if (err) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => e2 ? send(res, 404, 'Not found') : (res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }), res.end(d2)));
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cacheFor(ext) });
    res.end(data);
  });
}
function genPw() { const c = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.randomBytes(8); for (let i = 0; i < 8; i++) s += c[b[i] % c.length]; return 'arena-' + s; }

// ---------- routes ----------
const routes = [];
function route(method, pattern, handler) { routes.push({ method, pattern, handler }); }
function match(pattern, url) {
  const pk = pattern.split('/'), uk = url.split('/');
  if (pk.length !== uk.length) return null;
  const params = {};
  for (let i = 0; i < pk.length; i++) {
    if (pk[i].startsWith(':')) params[pk[i].slice(1)] = decodeURIComponent(uk[i]);
    else if (pk[i] !== uk[i]) return null;
  }
  return params;
}

// ===== AUTH =====
route('POST', '/api/auth/login', async (req, res) => {
  const body = await readBody(req);
  if (!body || !body.username || !body.password) return send(res, 400, { error: 'Username & password are required.' });
  const uname = String(body.username).toLowerCase().trim();
  const rows = await sb(`arena_coach_users?select=*&username=eq.${enc(uname)}&limit=1`);
  const u = rows && rows[0];
  if (!u || !u.is_active || !verifyPassword(body.password, u.password_hash)) return send(res, 401, { error: 'Incorrect username or password.' });
  sb(`arena_coach_users?id=eq.${enc(u.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_login: new Date().toISOString() }) }).catch(() => {});
  const token = signToken({ u: u.username, c: u.coach_name, d: u.display_name || u.coach_name, r: u.role || 'coach' });
  return send(res, 200, { token, coach: { coach_name: u.coach_name, display_name: u.display_name || u.coach_name, role: u.role || 'coach', external: (u.role || 'coach') === 'coach' && isExternalCoach(u.coach_name) } });
});
route('GET', '/api/coach/me', async (req, res, s) => { const pm = await coachPhotoMap(); return send(res, 200, { coach_name: s.c, display_name: s.d, role: s.r, photo: coachPhoto(pm, s.c), external: isExternalSession(s) }); });

// ===== COACH: dashboard =====
route('GET', '/api/coach/dashboard', async (req, res, s, q) => {
  const today = q.date || todayJakarta();
  const types = await classTypes();
  // month range
  const d0 = new Date(today + 'T00:00:00');
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate()}`;
  // week (Mon..Sun containing today)
  const dow = (d0.getDay() + 6) % 7; // 0=Mon
  const weekStart = new Date(d0); weekStart.setDate(d0.getDate() - dow);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const monthSched = await coachSchedules(s.c, monthStart, monthEnd);
  const ids = monthSched.map((x) => x.id);
  const counts = await bookingCounts(ids);

  // month totals
  const pastOrToday = monthSched.filter((x) => x.schedule_date <= today);
  const monthClasses = pastOrToday.length;
  const monthPeserta = pastOrToday.reduce((a, x) => a + ((counts[x.id] || {}).confirmed || 0), 0);

  // upcoming classes (today onward) — so participants are always reachable
  const upcomingSched = (await coachSchedules(s.c, today, null)).slice(0, 8);
  const upIds = upcomingSched.map((x) => x.id);
  const upCounts = await bookingCounts(upIds);
  const upStarted = await startedSet(upIds);
  const todayList = cardsFrom(upcomingSched, upCounts, upStarted, types, today);
  const todayCount = upcomingSched.filter((x) => x.schedule_date === today).length;
  const todayLabel = `${DOW_FULL[d0.getDay()]}, ${d0.getDate()} ${MON_FULL[d0.getMonth()]} ${d0.getFullYear()} · ` + (todayCount > 0 ? `${todayCount} classes today` : `${todayList.length} upcoming classes`);

  // week strip (navigable)
  const wk = await coachWeek(s.c, iso(weekStart), today);
  const week = wk.week;
  // recent (past classes)
  const recent = monthSched.filter((x) => x.schedule_date < today).slice(-3).reverse().map((x) => {
    const t = types[x.class_type_id] || {};
    return { type: shortType(t.name), date: fmtDMon(x.schedule_date), time: hhmm(x.start_time), peserta: (counts[x.id] || {}).confirmed || 0 };
  });
  return send(res, 200, { today: todayList, week, recent, month: { classes: monthClasses, peserta: monthPeserta }, todayLabel, weekRange: wk.range, weekStart: wk.start });
});

// Navigable weekly calendar (browse forward to December, etc.)
route('GET', '/api/coach/week', async (req, res, s, q) => {
  const today = todayJakarta();
  let start = q.start;
  if (!start) {
    const d0 = new Date(today + 'T00:00:00'); const dow = (d0.getDay() + 6) % 7;
    const ws = new Date(d0); ws.setDate(d0.getDate() - dow);
    start = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
  }
  const wk = await coachWeek(s.c, start, today);
  return send(res, 200, { week: wk.week, range: wk.range, start: wk.start });
});

// Classes within a chosen date range (the "dari–sampai" filter on the schedule list).
route('GET', '/api/coach/classes', async (req, res, s, q) => {
  const today = todayJakarta();
  const from = q.from || today;
  const to = q.to || null;
  const types = await classTypes();
  const sched = (await coachSchedules(s.c, from, to)).slice(0, 80);
  const ids = sched.map((x) => x.id);
  const [counts, started, venues] = await Promise.all([bookingCounts(ids), startedSet(ids), coachVenueCards(s.c, from, to, today)]);
  return send(res, 200, { classes: cardsFrom(sched, counts, started, types, today), venues, from, to });
});

// Per-month class count for the coach across the current year (monitoring bar chart).
route('GET', '/api/coach/monthly', async (req, res, s) => {
  const today = todayJakarta();
  const year = today.slice(0, 4);
  const curMon = parseInt(today.slice(5, 7), 10) - 1;
  const sched = await coachSchedules(s.c, year + '-01-01', year + '-12-31');
  const counts = new Array(12).fill(0);
  const peserta = new Array(12).fill(0);
  const byId = await bookingCounts(sched.map((x) => x.id));
  for (const x of sched) {
    const mi = parseInt(x.schedule_date.slice(5, 7), 10) - 1;
    counts[mi]++;
    peserta[mi] += (byId[x.id] || {}).confirmed || 0;
  }
  // Monitoring starts from July (index 6) — consistent with the leaderboard's "since July" rule.
  const SINCE_MI = 6;
  const months = counts.map((c, i) => ({ month: MON[i], count: c, peserta: peserta[i], isCurrent: i === curMon })).slice(SINCE_MI);
  const yearPeserta = peserta.slice(SINCE_MI).reduce((a, b) => a + b, 0);
  return send(res, 200, { months, year, monthPeserta: peserta[curMon], monthClasses: counts[curMon], yearPeserta });
});

// ===== COACH: monthly teaching calendar (which dates the coach teaches) =====
route('GET', '/api/coach/calendar', async (req, res, s, q) => {
  const today = todayJakarta();
  const ym = (q.ym && /^\d{4}-\d{2}$/.test(q.ym)) ? q.ym : today.slice(0, 7);
  const year = parseInt(ym.slice(0, 4), 10); const month = parseInt(ym.slice(5, 7), 10);
  const lastDay = new Date(year, month, 0).getDate();
  const mEnd = `${ym}-${String(lastDay).padStart(2, '0')}`;
  const sched = await coachSchedules(s.c, `${ym}-01`, mEnd);
  const cnt = {}; for (const x of sched) cnt[x.schedule_date] = (cnt[x.schedule_date] || 0) + 1;
  // Fold assigned venue bookings into the same day markers so venue-only days still highlight & are clickable.
  const venues = await coachAssignedBookings(s.c, `${ym}-01`, mEnd, 'booking_date');
  for (const v of venues) cnt[v.booking_date] = (cnt[v.booking_date] || 0) + 1;
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first offset
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ blank: true });
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`;
    const c = cnt[ds] || 0;
    cells.push({ blank: false, day: d, date: ds, count: c, teach: c > 0, isToday: ds === today });
  }
  const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return send(res, 200, {
    ym, monthLabel: `${MON_FULL[month - 1]} ${year}`, cells,
    prevYm: `${pm.y}-${String(pm.m).padStart(2, '0')}`, nextYm: `${nm.y}-${String(nm.m).padStart(2, '0')}`,
  });
});

// ===== VENUE BOOKING — sourced from the Admin Hub `arena_bookings` table =====
// Coaches that can be assigned (all coaches + head coaches, external included; excludes admin).
async function assignableCoaches() {
  const users = await sb('arena_coach_users?select=coach_name,role,is_active&role=neq.admin&is_active=eq.true&order=role.desc,coach_name.asc');
  return (users || []).map((u) => ({ name: u.coach_name, role: u.role === 'hc' ? 'Head Coach' : 'Coach', external: isExternalCoach(u.coach_name) }));
}
// Per-hour list price(s) of venue packages that bundle a Personal Trainer.
// arena_bookings has no package_id, so a "with PT" booking is recognised either
// by its package tag in notes OR — for manually-entered/corporate bookings that
// lack that tag — by its list price matching a PT package's per-hour rate.
let _ptRatesCache = null;
async function ptPackageRates() {
  if (_ptRatesCache) return _ptRatesCache;
  const rows = (await sb('arena_booking_packages?select=price_per_hour,includes_pt&includes_pt=eq.true')) || [];
  const set = new Set();
  for (const r of rows) { const v = Math.round(Number(r.price_per_hour) || 0); if (v > 0) set.add(v); }
  _ptRatesCache = set; return set;
}
// Booking duration in hours from "HH:MM(:SS)" start/end times.
function venueHours(b) {
  const t = (v) => { const p = String(v || '').split(':'); return p.length >= 2 ? (Number(p[0]) || 0) + (Number(p[1]) || 0) / 60 : 0; };
  const d = t(b.end_time) - t(b.start_time);
  return d > 0 ? d : 0;
}
// A booking is "arena + coach" when its package includes a Personal Trainer (PT).
function venueNeedsCoach(b, ptRates) {
  const n = String(b.notes || '');
  if (/PACKAGE:[^\]]*\bPT\b/i.test(n) || /with personal trainer/i.test(n)) return true;
  const hrs = venueHours(b);
  if (hrs > 0 && ptRates && ptRates.size) {
    const list = Number(b.price_before_disc) || Number(b.price) || 0;
    if (list > 0 && ptRates.has(Math.round(list / hrs))) return true;
  }
  return false;
}
// booking_id -> assignment row.
async function venueAssignments() {
  const rows = (await sb('arena_venue_assignments?select=booking_id,coach_name,assigned_by')) || [];
  const map = {}; for (const r of rows) map[r.booking_id] = r; return map;
}
// Shape an arena_bookings row for the venue list.
function venueBookingRow(b, assignMap, ptRates) {
  const a = assignMap[b.id];
  return { id: b.id, code: b.booking_code || '', customer: b.full_name || '(no name)',
    date: b.booking_date, dateLabel: b.booking_date ? fmtDMon(b.booking_date) : '', dayLabel: b.booking_date ? dLabel(b.booking_date) : '',
    time: hhmm(b.start_time), end: hhmm(b.end_time), needsCoach: venueNeedsCoach(b, ptRates), coach: a ? a.coach_name : '', status: b.status || '' };
}
// arena_bookings ids assigned to a coach (upcoming range) — used by the schedule + calendar.
async function coachAssignedBookings(coach, from, to, cols) {
  const asg = (await sb(`arena_venue_assignments?select=booking_id&coach_name=eq.${enc(coach)}`)) || [];
  if (!asg.length) return [];
  const ids = asg.map((a) => a.booking_id);
  let q = `arena_bookings?select=${cols}&id=in.(${ids.map(enc).join(',')})&status=neq.cancelled&booking_date=gte.${from}`;
  if (to) q += `&booking_date=lte.${to}`;
  return (await sb(q + '&order=booking_date.asc,start_time.asc')) || [];
}
// Venue bookings assigned to a coach within a date range, shaped like schedule cards.
async function coachVenueCards(coach, from, to, today) {
  const asg = (await sb(`arena_venue_assignments?select=booking_id,started_at&coach_name=eq.${enc(coach)}`)) || [];
  if (!asg.length) return [];
  const startedMap = {}; for (const a of asg) startedMap[a.booking_id] = a.started_at;
  const ids = asg.map((a) => a.booking_id);
  let q = `arena_bookings?select=id,full_name,booking_date,start_time,end_time&id=in.(${ids.map(enc).join(',')})&status=neq.cancelled&booking_date=gte.${from}`;
  if (to) q += `&booking_date=lte.${to}`;
  const rows = (await sb(q + '&order=booking_date.asc,start_time.asc')) || [];
  return rows.map((b) => { const started = !!startedMap[b.id]; return { id: b.id, time: hhmm(b.start_time), end: b.end_time ? '– ' + hhmm(b.end_time) : '', customer: b.full_name || 'Arena booking', arena: 'Arena 20FIT', phone: '', notes: '', dateLabel: dLabel(b.booking_date), isToday: b.booking_date === today, started, canAbsen: b.booking_date >= today && !started }; });
}

// List venue bookings — HC/admin see all upcoming from Admin Hub; a coach sees only bookings assigned to them.
route('GET', '/api/venue/bookings', async (req, res, s) => {
  const isHC = requireHC(s);
  const today = todayJakarta();
  const [assignMap, ptRates] = await Promise.all([venueAssignments(), ptPackageRates()]);
  if (isHC) {
    const rows = (await sb(`arena_bookings?select=id,booking_code,full_name,booking_date,start_time,end_time,status,notes,price,price_before_disc&status=neq.cancelled&booking_date=gte.${today}&order=booking_date.asc,start_time.asc&limit=200`)) || [];
    return send(res, 200, { bookings: rows.map((b) => venueBookingRow(b, assignMap, ptRates)), coaches: await assignableCoaches(), isHC: true });
  }
  const mine = Object.keys(assignMap).filter((id) => assignMap[id].coach_name === s.c);
  if (!mine.length) return send(res, 200, { bookings: [], coaches: [], isHC: false });
  const rows = (await sb(`arena_bookings?select=id,booking_code,full_name,booking_date,start_time,end_time,status,notes,price,price_before_disc&id=in.(${mine.map(enc).join(',')})&status=neq.cancelled&order=booking_date.asc,start_time.asc`)) || [];
  return send(res, 200, { bookings: rows.map((b) => venueBookingRow(b, assignMap, ptRates)), coaches: [], isHC: false });
});
// Assign / reassign the responsible coach for an arena+coach booking (HC/admin only).
route('POST', '/api/venue/bookings/:id/assign', async (req, res, s, q, params) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  const body = await readBody(req);
  if (!body || !body.coach_name) return send(res, 400, { error: 'Please select a coach.' });
  await sb('arena_venue_assignments', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ booking_id: params.id, coach_name: String(body.coach_name).trim(), assigned_by: s.d || s.c, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true });
});
// Remove the coach assignment (HC/admin only) — never touches the Admin Hub booking itself.
route('POST', '/api/venue/bookings/:id/unassign', async (req, res, s, q, params) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  await sb(`arena_venue_assignments?booking_id=eq.${enc(params.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return send(res, 200, { ok: true });
});
// The assigned coach starts (absen) their Arena + Coach session — GPS-checked like a class.
route('POST', '/api/venue/bookings/:id/start', async (req, res, s, q, params) => {
  const asg = await sb(`arena_venue_assignments?select=coach_name&booking_id=eq.${enc(params.id)}&limit=1`);
  const a = asg && asg[0];
  if (!a) return send(res, 404, { error: 'This booking has not been assigned to a coach.' });
  if (a.coach_name !== s.c) return send(res, 403, { error: 'This is not your booking.' });
  const body = (await readBody(req)) || {};
  const loc = await arenaLocation();
  if (loc) {
    if (body.lat == null || body.lng == null) return send(res, 403, { error: 'Enable location access on your phone to start the class.', needLocation: true });
    const dist = haversineM(Number(body.lat), Number(body.lng), loc.lat, loc.lng);
    if (dist > loc.radius_m) return send(res, 403, { error: `You must be at the arena to start the class (you are ~${Math.round(dist)} m away from the arena).`, tooFar: true });
  }
  await sb(`arena_venue_assignments?booking_id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ started_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true, started: true });
});

// ===== ARENA SETTINGS: GPS location lock for absen =====
// Returns the configured arena point, or null when the location lock is off.
async function arenaLocation() {
  const rows = await sb('arena_settings?select=arena_lat,arena_lng,radius_m&id=eq.1&limit=1');
  const r = rows && rows[0];
  if (!r || r.arena_lat == null || r.arena_lng == null) return null;
  return { lat: Number(r.arena_lat), lng: Number(r.arena_lng), radius_m: Number(r.radius_m) || 150 };
}
// Great-circle distance in metres.
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
route('GET', '/api/settings/arena-location', async (req, res, s) => {
  const loc = await arenaLocation();
  return send(res, 200, { set: !!loc, lat: loc ? loc.lat : null, lng: loc ? loc.lng : null, radius_m: loc ? loc.radius_m : 150 });
});
route('POST', '/api/settings/arena-location', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const body = (await readBody(req)) || {};
  if (body.clear) {
    await sb('arena_settings?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ arena_lat: null, arena_lng: null, updated_by: s.d || s.c, updated_at: new Date().toISOString() }) });
    return send(res, 200, { ok: true });
  }
  if (body.lat == null || body.lng == null) return send(res, 400, { error: 'Location is required.' });
  const radius = Math.max(20, Math.min(2000, parseInt(body.radius_m, 10) || 150));
  await sb('arena_settings?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ arena_lat: Number(body.lat), arena_lng: Number(body.lng), radius_m: radius, updated_by: s.d || s.c, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true });
});

// ===== MENU KELAS — shared class-program reference (patokan) for coaches =====
route('GET', '/api/coach/menu', async (req, res, s) => {
  const rows = (await sb('arena_class_menus?select=*&order=created_at.desc&limit=200')) || [];
  const canManage = requireHC(s);
  return send(res, 200, { menus: rows.map((m) => ({ id: m.id, title: m.title, category: m.category || '', content: m.content || '', by: m.created_by || '', mine: m.created_by === s.d || m.created_by === s.c })), canManage });
});
route('POST', '/api/coach/menu', async (req, res, s) => {
  const body = await readBody(req);
  if (!body || !body.title || !body.content) return send(res, 400, { error: 'Menu name & content are required.' });
  await sb('arena_class_menus', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ title: String(body.title).trim().slice(0, 160), category: body.category ? String(body.category).trim().slice(0, 80) : null, content: String(body.content).trim().slice(0, 4000), created_by: s.d || s.c }) });
  return send(res, 200, { ok: true });
});
route('POST', '/api/coach/menu/:id/delete', async (req, res, s, q, params) => {
  // The author or a Head Coach / Admin may remove a menu entry.
  const rows = await sb(`arena_class_menus?select=created_by&id=eq.${enc(params.id)}&limit=1`);
  const m = rows && rows[0];
  if (!m) return send(res, 404, { error: 'Menu not found.' });
  const mine = m.created_by === s.d || m.created_by === s.c;
  if (!mine && !requireHC(s)) return send(res, 403, { error: 'Only the author or a Head Coach can delete this.' });
  await sb(`arena_class_menus?id=eq.${enc(params.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return send(res, 200, { ok: true });
});
route('POST', '/api/coach/menu/:id/update', async (req, res, s, q, params) => {
  // The author or a Head Coach / Admin may edit a menu entry.
  const rows = await sb(`arena_class_menus?select=created_by&id=eq.${enc(params.id)}&limit=1`);
  const m = rows && rows[0];
  if (!m) return send(res, 404, { error: 'Menu not found.' });
  const mine = m.created_by === s.d || m.created_by === s.c;
  if (!mine && !requireHC(s)) return send(res, 403, { error: 'Only the author or a Head Coach can edit this.' });
  const body = await readBody(req);
  if (!body || !body.title || !body.content) return send(res, 400, { error: 'Menu name & content are required.' });
  await sb(`arena_class_menus?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ title: String(body.title).trim().slice(0, 160), category: body.category ? String(body.category).trim().slice(0, 80) : null, content: String(body.content).trim().slice(0, 4000) }) });
  return send(res, 200, { ok: true });
});

// ===== COACH: participants — how many times each attended + recency of last visit =====
route('GET', '/api/coach/members', async (req, res, s) => {
  if (isExternalSession(s)) return send(res, 403, { error: 'Not available for external coaches.' });
  const today = todayJakarta();
  const map = await coachAttendanceMap(s.c, today);
  const members = Object.keys(map).map((k) => {
    const m = map[k];
    return { name: m.name, visits: m.visits, lastVisit: m.last ? fmtDMon(m.last) : '-', daysSince: daysSinceISO(m.last, today), classesLabel: classesLabelFor(m) };
  }).sort((a, b) => b.visits - a.visits || ((a.daysSince == null ? 1e9 : a.daysSince) - (b.daysSince == null ? 1e9 : b.daysSince)));
  const active30 = members.filter((m) => m.daysSince != null && m.daysSince <= 30).length;
  return send(res, 200, { members, total: members.length, active30 });
});

// ===== PUBLIC review (no login) — participants review the coach's class they attended =====
async function bookingByCode(code) {
  const rows = await sb(`arena_class_bookings?select=booking_code,schedule_id,full_name,status&booking_code=eq.${enc(code)}&limit=1`);
  return rows && rows[0];
}
// Normalise an Indonesian phone number to a consistent "08..." digit string.
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8')) d = '0' + d;
  return d;
}
async function reviewed(code) {
  return ((await sb(`arena_class_reviews?select=id&booking_code=eq.${enc(code)}&limit=1`)) || []).length > 0;
}
// Resolve a participant's booking to review from a phone number: the most recent
// class they attended (already happened) that hasn't been reviewed yet.
async function bookingByPhone(phone, today) {
  const norm = normPhone(phone);
  if (norm.length < 8) return { error: 'Invalid phone number.' };
  const last4 = norm.slice(-4);
  const cands = (await sb(`arena_class_bookings?select=booking_code,schedule_id,full_name,phone&status=eq.confirmed&phone=like.*${last4}*&limit=500`)) || [];
  const matches = cands.filter((x) => normPhone(x.phone) === norm);
  if (!matches.length) return { error: 'No booking found for this phone number.' };
  const sids = Array.from(new Set(matches.map((m) => m.schedule_id).filter(Boolean)));
  const scheds = sids.length ? (await sb(`arena_class_schedules?select=id,schedule_date,start_time&id=in.(${sids.map(enc).join(',')})`)) || [] : [];
  const metaById = {}; for (const s of scheds) metaById[s.id] = s;
  const occurred = matches
    .map((m) => ({ m, s: metaById[m.schedule_id] }))
    .filter((x) => x.s && x.s.schedule_date && x.s.schedule_date <= today)
    .sort((a, b) => {
      if (a.s.schedule_date !== b.s.schedule_date) return a.s.schedule_date < b.s.schedule_date ? 1 : -1;
      return (a.s.start_time || '') < (b.s.start_time || '') ? 1 : -1;
    });
  if (!occurred.length) return { error: 'No completed classes for this phone number yet. Reviews can be submitted after a class is finished.' };
  for (const o of occurred) { if (!(await reviewed(o.m.booking_code))) return { booking: o.m }; }
  return { allReviewed: true, booking: occurred[0].m };
}
route('POST', '/api/public/lookup', async (req, res) => {
  const body = await readBody(req);
  const q = body && String(body.q || body.booking_code || '').trim();
  if (!q) return send(res, 400, { error: 'Phone number or booking code is required.' });
  let b, code, forceAlready = false;
  if (/[A-Za-z]/.test(q)) { // looks like a booking code (e.g. CL-...)
    code = q.toUpperCase();
    b = await bookingByCode(code);
    if (!b || !b.schedule_id) return send(res, 404, { error: 'Class booking code not found.' });
  } else { // phone number
    const r = await bookingByPhone(q, todayJakarta());
    if (r.error) return send(res, 404, { error: r.error });
    b = r.booking; code = r.booking.booking_code; forceAlready = !!r.allReviewed;
  }
  const scs = await sb(`arena_class_schedules?select=instructor,class_type_id,schedule_date&id=eq.${enc(b.schedule_id)}&limit=1`);
  const sc = scs && scs[0]; const types = await classTypes();
  const already = forceAlready || (await reviewed(code));
  const pm = await coachPhotoMap();
  return send(res, 200, { found: true, booking_code: code, coach: sc ? sc.instructor : '', coach_photo: coachPhoto(pm, sc ? sc.instructor : ''), class_label: sc ? shortType((types[sc.class_type_id] || {}).name) : 'Class', date: sc ? sc.schedule_date : '', name: b.full_name || '', already });
});
// Per-category star ratings a participant gives a coach (each 1-5). "Other" is free text.
const REVIEW_CATS = [
  { key: 'clear_instructions', label: 'Clear Instructions' },
  { key: 'technique_correction', label: 'Technique Correction' },
  { key: 'member_support', label: 'Member Support' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'class_management', label: 'Class Management' },
];
const REVIEW_CAT_KEYS = REVIEW_CATS.map((c) => c.key);
route('POST', '/api/public/review', async (req, res) => {
  const body = await readBody(req);
  const code = body && String(body.booking_code || '').trim().toUpperCase();
  const rating = body && parseInt(body.rating, 10);
  if (!code || !(rating >= 1 && rating <= 5)) return send(res, 400, { error: 'Booking code & rating (1-5) are required.' });
  const b = await bookingByCode(code);
  if (!b || !b.schedule_id) return send(res, 404, { error: 'Class booking code not found.' });
  const dup = ((await sb(`arena_class_reviews?select=id&booking_code=eq.${enc(code)}&limit=1`)) || []).length > 0;
  if (dup) return send(res, 409, { error: 'This booking code has already submitted a review.' });
  const scs = await sb(`arena_class_schedules?select=instructor,class_type_id&id=eq.${enc(b.schedule_id)}&limit=1`);
  const sc = scs && scs[0]; const types = await classTypes();
  const ratings = {};
  const inRatings = (body && body.ratings) || {};
  for (const k of REVIEW_CAT_KEYS) { const v = parseInt(inRatings[k], 10); if (v >= 1 && v <= 5) ratings[k] = v; }
  await sb('arena_class_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ schedule_id: b.schedule_id, coach_name: sc ? sc.instructor : null, class_label: sc ? shortType((types[sc.class_type_id] || {}).name) : null, reviewer_name: (String(body.name || b.full_name || '').slice(0, 80)) || null, booking_code: code, rating, comment: (String(body.comment || '').slice(0, 600)) || null, ratings }) });
  return send(res, 200, { ok: true });
});

// Reviews for the portal (coach sees own; head coach/admin see all)
route('GET', '/api/coach/reviews', async (req, res, s) => {
  // External coaches can be reviewed, but only Admin/HC may see those reviews.
  if (isExternalSession(s)) return send(res, 403, { error: 'Reviews can only be viewed by Admin & Head Coach.' });
  const isHC = s.r === 'hc' || s.r === 'admin';
  let q = 'arena_class_reviews?select=coach_name,class_label,reviewer_name,rating,comment,ratings,created_at&order=created_at.desc&limit=100';
  // Match co-taught classes too (coach_name may be stored as "A & Coach").
  if (!isHC) q += `&coach_name=ilike.*${enc(s.c)}*`;
  let rows = (await sb(q)) || [];
  if (!isHC) rows = rows.filter((x) => instructorHasCoach(x.coach_name, s.c));
  const avg = rows.length ? rows.reduce((a, x) => a + x.rating, 0) / rows.length : 0;
  // per-category averages across all shown reviews
  const catSum = {}; const catCnt = {};
  for (const x of rows) { const r = x.ratings || {}; for (const c of REVIEW_CATS) { const v = parseInt(r[c.key], 10); if (v >= 1 && v <= 5) { catSum[c.key] = (catSum[c.key] || 0) + v; catCnt[c.key] = (catCnt[c.key] || 0) + 1; } } }
  const categories = REVIEW_CATS.filter((c) => catCnt[c.key]).map((c) => ({ label: c.label, avg: (Math.round((catSum[c.key] / catCnt[c.key]) * 10) / 10).toFixed(1) }));
  const reviews = rows.map((x) => ({ coach: x.coach_name || '', cls: x.class_label || 'Class', name: x.reviewer_name || 'Anonymous', rating: x.rating, stars: '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating), comment: x.comment || '', tags: [], date: fmtDMon(String(x.created_at).slice(0, 10)) }));
  return send(res, 200, { reviews, avg: Math.round(avg * 10) / 10, count: rows.length, categories });
});

// Exact row count via PostgREST Content-Range (no rows fetched) — avoids the 1000-row cap.
async function sbCount(q) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) return 0;
  const m = (res.headers.get('content-range') || '').match(/\/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}
// Coach leaderboard — ranked by number of participants who booked the coach's classes.
// Counts only classes from this date onward (the leaderboard "starts" here).
const LEADERBOARD_SINCE = '2026-07-01';
route('GET', '/api/coach/leaderboard', async (req, res, s) => {
  if (isExternalSession(s)) return send(res, 403, { error: 'Not available for external coaches.' });
  const scheds = (await sb(`arena_class_schedules?select=id,instructor&is_cancelled=eq.false&schedule_date=gte.${LEADERBOARD_SINCE}`)) || [];
  // Canonical coach names — used to keep the board to real coaches and to split
  // co-taught classes ("A & Coach") between the coaches actually on the roster.
  const roster = (await sb('arena_coach_users?select=coach_name&role=neq.admin')) || [];
  const canon = new Map(roster.map((u) => [String(u.coach_name).toLowerCase(), u.coach_name]));
  const byCoach = {};
  for (const sc of scheds) {
    for (const tok of instructorTokens(sc.instructor)) {
      const nm = canon.get(tok.toLowerCase());
      if (!nm) continue; // skip non-roster co-instructors (e.g. guest trainers)
      if (!byCoach[nm]) byCoach[nm] = { ids: [], classes: 0 };
      byCoach[nm].ids.push(sc.id); byCoach[nm].classes++;
    }
  }
  const results = [];
  for (const nm of Object.keys(byCoach)) {
    const ids = byCoach[nm].ids;
    let peserta = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      peserta += await sbCount(`arena_class_bookings?select=id&status=eq.confirmed&schedule_id=in.(${chunk.map(enc).join(',')})`);
    }
    results.push({ name: nm, peserta, classes: byCoach[nm].classes });
  }
  const pm = await coachPhotoMap();
  const board = results.sort((a, b) => b.peserta - a.peserta || b.classes - a.classes)
    .map((x, i) => Object.assign({ rank: i + 1, isMe: x.name === s.c, photo: coachPhoto(pm, x.name) }, x));
  return send(res, 200, { board, me: s.c });
});

// ===== COACH: class detail + participants =====
route('GET', '/api/coach/class/:id', async (req, res, s, q, params) => {
  if (isExternalSession(s)) return send(res, 403, { error: 'Not available for external coaches.' });
  const rows = await sb(`arena_class_schedules?select=id,schedule_date,start_time,end_time,quota,class_type_id,instructor&id=eq.${enc(params.id)}&limit=1`);
  const sc = rows && rows[0];
  if (!sc) return send(res, 404, { error: 'Schedule not found.' });
  if (s.r === 'coach' && !instructorHasCoach(sc.instructor, s.c)) return send(res, 403, { error: 'This is not your class.' });
  const types = await classTypes();
  const t = types[sc.class_type_id] || {};
  // Note: participant contact (phone/email) is intentionally NOT selected/returned —
  // coaches and head coaches must not see customer contact details.
  const bookings = await sb(`arena_class_bookings?select=id,booking_code,full_name,status,created_at&schedule_id=eq.${enc(params.id)}&order=created_at.asc`);
  const att = await sb(`arena_class_attendance?select=booking_id,status&schedule_id=eq.${enc(params.id)}`);
  const attMap = {}; for (const a of att || []) attMap[a.booking_id] = a.status;
  const started = (await sb(`arena_class_sessions?select=schedule_id&schedule_id=eq.${enc(params.id)}&limit=1`) || []).length > 0;
  const today = todayJakarta();
  // For co-taught classes use the logged-in coach's own history; HC/admin keep the class instructor.
  const histCoach = s.r === 'coach' ? s.c : sc.instructor;
  const attHist = await coachAttendanceMap(histCoach, today); // visit history for this class's coach
  const participants = (bookings || []).filter((b) => b.status !== 'cancelled').map((b) => {
    const h = attHist[String(b.full_name || '').trim().toLowerCase()] || null;
    return {
      booking_id: b.id, booking: b.booking_code, name: b.full_name || '(no name)',
      bookingStatus: b.status, attendance: attMap[b.id] || null,
      status: attMap[b.id] === 'checked_in' ? 'Checked-in' : attMap[b.id] === 'no_show' ? 'No-show' : 'Confirmed',
      visits: h ? h.visits : 0, lastVisit: h && h.last ? fmtDMon(h.last) : '', daysSince: h ? daysSinceISO(h.last, today) : null,
      classesLabel: classesLabelFor(h),
    };
  });
  return send(res, 200, { schedule: { schedule_id: sc.id, date: sc.schedule_date, time: hhmm(sc.start_time), end: hhmm(sc.end_time), type: shortType(t.name), quota: sc.quota }, started, participants });
});
route('POST', '/api/coach/class/:id/start', async (req, res, s, q, params) => {
  const body = (await readBody(req)) || {};
  // GPS lock: if an arena location is configured, the coach must be within its radius.
  const loc = await arenaLocation();
  if (loc) {
    if (body.lat == null || body.lng == null) return send(res, 403, { error: 'Enable location access on your phone to start the class.', needLocation: true });
    const dist = haversineM(Number(body.lat), Number(body.lng), loc.lat, loc.lng);
    if (dist > loc.radius_m) return send(res, 403, { error: `You must be at the arena to start the class (you are ~${Math.round(dist)} m away from the arena).`, tooFar: true });
  }
  await sb('arena_class_sessions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ schedule_id: params.id, coach_name: s.c, status: 'ongoing' }) });
  return send(res, 200, { ok: true, started: true });
});
route('POST', '/api/coach/class/:id/attend', async (req, res, s, q, params) => {
  const body = await readBody(req);
  if (!body || !body.booking_id || !['checked_in', 'no_show'].includes(body.status)) return send(res, 400, { error: 'Invalid attendance data.' });
  await sb('arena_class_attendance', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ schedule_id: params.id, booking_id: body.booking_id, status: body.status, marked_by: s.c }) });
  return send(res, 200, { ok: true });
});

// ===== COACH: substitution =====
route('GET', '/api/coach/subs/options', async (req, res, s, q) => {
  const coaches = await sb(`arena_coach_users?select=coach_name,role,is_active&is_active=eq.true&order=coach_name.asc`);
  const pm = await coachPhotoMap();
  const opts = (coaches || []).filter((c) => c.coach_name !== s.c && c.role !== 'admin').map((c) => ({ name: c.coach_name, role: c.role, spec: coachSpec(pm, c.coach_name), disabled: false, photo: coachPhoto(pm, c.coach_name) }));
  return send(res, 200, { options: opts });
});
route('POST', '/api/coach/subs', async (req, res, s) => {
  const body = await readBody(req);
  if (!body || !body.to_coach) return send(res, 400, { error: 'Please select a rotation coach.' });
  await sb('arena_coach_substitutions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ schedule_id: body.schedule_id || null, from_coach: s.c, to_coach: body.to_coach, class_label: body.class_label || null, time_label: body.time_label || null, reason: body.reason || null, status: 'pending' }) });
  return send(res, 200, { ok: true });
});

// Rotation requests directed at / raised by this coach; the ROTATION COACH (to_coach) decides.
route('GET', '/api/coach/rotations', async (req, res, s) => {
  const rows = await sb(`arena_coach_substitutions?select=*&or=(from_coach.eq.${enc(s.c)},to_coach.eq.${enc(s.c)})&order=created_at.desc&limit=60`);
  const incoming = (rows || []).filter((r) => r.to_coach === s.c && r.status === 'pending').map((r) => ({ id: r.id, from: r.from_coach, to: r.to_coach, cls: r.class_label || 'Class', time: r.time_label || '', reason: r.reason || '-' }));
  const outgoing = (rows || []).filter((r) => r.from_coach === s.c).map((r) => ({ id: r.id, from: r.from_coach, to: r.to_coach, cls: r.class_label || 'Class', time: r.time_label || fmtDMon(String(r.created_at).slice(0, 10)), status: r.status }));
  return send(res, 200, { incoming, outgoing });
});
route('POST', '/api/coach/rotations/:id/decide', async (req, res, s, q, params) => {
  const body = await readBody(req);
  const status = body && body.action === 'approve' ? 'approved' : 'rejected';
  const rows = await sb(`arena_coach_substitutions?select=to_coach,schedule_id&id=eq.${enc(params.id)}&limit=1`);
  const r = rows && rows[0];
  if (!r) return send(res, 404, { error: 'Rotation request not found.' });
  if (r.to_coach !== s.c) return send(res, 403, { error: 'Only the rotation coach can approve/reject this.' });
  await sb(`arena_coach_substitutions?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, decided_by: s.c, decided_at: new Date().toISOString() }) });
  // On approval, transfer the class to the new coach — the schedule's instructor is
  // what every dashboard (and the shared Admin Hub) reads, so this is the real handover.
  if (status === 'approved' && r.schedule_id) {
    await sb(`arena_class_schedules?id=eq.${enc(r.schedule_id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ instructor: r.to_coach, updated_at: new Date().toISOString() }) });
  }
  return send(res, 200, { ok: true, status });
});

// ===== COACH: appreciation emails =====
route('GET', '/api/coach/emails', async (req, res, s) => {
  const rows = await sb(`arena_appreciation_emails?select=class_label,recipients,status,sent_at&sent_by=eq.${enc(s.c)}&order=sent_at.desc&limit=30`);
  const log = (rows || []).map((e) => ({ class: e.class_label || 'Class', date: fmtDMon(String(e.sent_at).slice(0, 10)), recipients: e.recipients, status: e.status === 'failed' ? 'Failed' : 'Sent' }));
  return send(res, 200, { log });
});

// ===== COACH: manual per-participant feedback (coach writes it; Admin Hub emails it) =====
// Recent finished classes the coach can write feedback for (last 30 days).
route('GET', '/api/coach/feedback/classes', async (req, res, s) => {
  const today = todayJakarta();
  const d0 = new Date(today + 'T00:00:00'); d0.setDate(d0.getDate() - 30);
  const from = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
  const types = await classTypes();
  const sched = (await coachSchedules(s.c, from, today)).slice(-60).reverse();
  const classes = sched.map((x) => ({ id: x.id, label: shortType((types[x.class_type_id] || {}).name) + ' · ' + hhmm(x.start_time) + ' · ' + fmtDMon(x.schedule_date) }));
  return send(res, 200, { classes });
});
// Participants of one of the coach's classes (name only — no contact details).
route('GET', '/api/coach/feedback/participants', async (req, res, s, q) => {
  const id = q.id || '';
  const rows = await sb(`arena_class_schedules?select=id,class_type_id,instructor&id=eq.${enc(id)}&limit=1`);
  const sc = rows && rows[0];
  if (!sc) return send(res, 404, { error: 'Class not found.' });
  if (s.r === 'coach' && !instructorHasCoach(sc.instructor, s.c)) return send(res, 403, { error: 'This is not your class.' });
  const types = await classTypes();
  const bookings = await sb(`arena_class_bookings?select=id,full_name,status&schedule_id=eq.${enc(id)}&status=eq.confirmed&order=full_name.asc`);
  const participants = (bookings || []).map((b) => ({ booking_id: b.id, name: b.full_name || 'Participant' }));
  return send(res, 200, { classLabel: shortType((types[sc.class_type_id] || {}).name), participants });
});
// Save feedback the coach wrote for each participant (status 'pending' → Admin Hub emails it).
route('POST', '/api/coach/feedback', async (req, res, s) => {
  const body = await readBody(req);
  const schedule_id = body && body.schedule_id;
  const items = (body && Array.isArray(body.items)) ? body.items : [];
  if (!schedule_id || !items.length) return send(res, 400, { error: 'Select a class & write at least one feedback.' });
  const rows = await sb(`arena_class_schedules?select=instructor&id=eq.${enc(schedule_id)}&limit=1`);
  const sc = rows && rows[0];
  if (!sc) return send(res, 404, { error: 'Class not found.' });
  if (s.r === 'coach' && !instructorHasCoach(sc.instructor, s.c)) return send(res, 403, { error: 'This is not your class.' });
  const payload = items
    .filter((it) => it && it.booking_id && String(it.message || '').trim())
    .map((it) => ({ schedule_id, booking_id: it.booking_id, coach: s.c, participant_name: String(it.name || '').slice(0, 120) || null, message: String(it.message).trim().slice(0, 1000), status: 'pending' }));
  if (!payload.length) return send(res, 400, { error: 'Write at least one feedback.' });
  await sb('arena_coach_feedback', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
  return send(res, 200, { saved: payload.length });
});
route('GET', '/api/templates', async (req, res) => {
  const rows = await sb('arena_email_templates?select=id,body&is_active=eq.true&order=created_at.asc');
  return send(res, 200, { templates: (rows || []).map((t, i) => ({ id: String(i + 1).padStart(2, '0'), rowId: t.id, text: t.body })) });
});

// ===== HEAD COACH ===== (role hc or admin)
function requireHC(s) { return s.r === 'hc' || s.r === 'admin'; }
route('GET', '/api/hc/today', async (req, res, s, q) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  const today = q.date || todayJakarta();
  const types = await classTypes();
  const rows = await sb(`arena_class_schedules?select=id,start_time,instructor,class_type_id&schedule_date=eq.${today}&is_cancelled=eq.false&order=start_time.asc`);
  const ids = (rows || []).map((r) => r.id);
  const started = await startedSet(ids);
  const list = (rows || []).map((r) => {
    const t = types[r.class_type_id] || {};
    const on = started.has(r.id);
    return { time: hhmm(r.start_time), coach: r.instructor, type: shortType(t.name), status: on ? 'Teaching' : 'Upcoming', kind: on ? 'live' : 'idle' };
  });
  return send(res, 200, { today: list, date: today });
});
route('GET', '/api/hc/schedule', async (req, res, s, q) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  const day = q.date || todayJakarta();
  const types = await classTypes();
  const rows = await sb(`arena_class_schedules?select=id,start_time,instructor,class_type_id,quota&schedule_date=eq.${day}&is_cancelled=eq.false`);
  const ids = (rows || []).map((r) => r.id);
  const counts = await bookingCounts(ids);
  const coachNames = Array.from(new Set((rows || []).map((r) => r.instructor).filter(Boolean))).slice(0, 8);
  const times = Array.from(new Set((rows || []).map((r) => hhmm(r.start_time)))).sort();
  const grid = {};
  for (const tm of times) { grid[tm] = coachNames.map(() => null); }
  for (const r of rows || []) {
    const tm = hhmm(r.start_time); const ci = coachNames.indexOf(r.instructor);
    if (ci >= 0 && grid[tm]) { const t = types[r.class_type_id] || {}; grid[tm][ci] = { type: shortType(t.name), peserta: (counts[r.id] || {}).confirmed + (counts[r.id] || {}).pending || 0 }; }
  }
  const dl = new Date(day + 'T00:00:00');
  const dateLabel = `${DOW_FULL[dl.getDay()]} ${dl.getDate()} ${MON[dl.getMonth()]}`;
  const DOW_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateLabelEn = `${DOW_EN[dl.getDay()]} · ${dl.getDate()} ${MON[dl.getMonth()]} ${dl.getFullYear()}`;
  const pm = await coachPhotoMap();
  const list = (rows || []).slice()
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')) || String(a.instructor || '').localeCompare(String(b.instructor || '')))
    .map((r) => { const t = types[r.class_type_id] || {}; const cc = counts[r.id] || {}; return { time: hhmm(r.start_time), coach: r.instructor || '—', type: shortType(t.name), pax: (cc.confirmed || 0) + (cc.pending || 0), photo: coachPhoto(pm, r.instructor) }; });
  return send(res, 200, { coaches: coachNames, times, grid, list, date: day, dateLabel, dateLabelEn });
});
route('GET', '/api/hc/subs', async (req, res, s) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  const rows = await sb('arena_coach_substitutions?select=*&order=created_at.desc&limit=50');
  const pending = (rows || []).filter((r) => r.status === 'pending').map((r) => ({ id: r.id, from: r.from_coach, to: r.to_coach, cls: r.class_label || '', time: r.time_label || '', reason: r.reason || '' }));
  const history = (rows || []).filter((r) => r.status !== 'pending').slice(0, 10).map((r) => ({ from: r.from_coach, to: r.to_coach, cls: r.class_label || '', time: r.time_label || fmtDMon(String(r.created_at).slice(0, 10)), status: r.status === 'approved' ? 'Approved' : (r.status === 'rejected' ? 'Ditolak' : 'Cancelled') }));
  return send(res, 200, { pending, history });
});
// Head Coach only VIEWS rotation activity (notification) — approving is done by the rotation coach.
route('GET', '/api/hc/coaches', async (req, res, s, q) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  const today = todayJakarta();
  const d0 = new Date(today + 'T00:00:00');
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-01`;
  const users = await sb('arena_coach_users?select=username,coach_name,role,is_active&order=coach_name.asc');
  const scheds = await sb(`arena_class_schedules?select=id,instructor,schedule_date&is_cancelled=eq.false&schedule_date=gte.${monthStart}&schedule_date=lte.${today}`);
  const byCoach = {};
  for (const sc of scheds || []) {
    // Co-taught classes ("A & Coach") count for each named coach.
    for (const nm of instructorTokens(sc.instructor)) {
      byCoach[nm] = byCoach[nm] || { classes: 0, ids: [] };
      byCoach[nm].classes++; byCoach[nm].ids.push(sc.id);
    }
  }
  const allIds = (scheds || []).map((x) => x.id);
  const [counts, started] = await Promise.all([bookingCounts(allIds), startedSet(allIds)]);
  const subs = await sb('arena_coach_substitutions?select=from_coach,status');
  const subCount = {}; for (const su of subs || []) subCount[su.from_coach] = (subCount[su.from_coach] || 0) + 1;
  const pm = await coachPhotoMap();
  const list = (users || []).filter((u) => u.role !== 'admin').map((u) => {
    const b = byCoach[u.coach_name] || { classes: 0, ids: [] };
    const peserta = b.ids.reduce((a, id) => a + ((counts[id] || {}).confirmed || 0), 0);
    // Attendance = classes actually checked-in (Start Class) / total scheduled classes this month.
    const attended = b.ids.filter((id) => started.has(id)).length;
    const punctual = b.classes ? Math.round((attended / b.classes) * 100) : 0;
    return { id: u.username, name: u.coach_name, role: u.role === 'hc' ? 'Head Coach' : 'Coach', classes: b.classes, peserta, attended, punctual, subs: subCount[u.coach_name] || 0, status: u.is_active ? 'Active' : 'Inactive', photo: coachPhoto(pm, u.coach_name) };
  });
  return send(res, 200, { coaches: list });
});
route('GET', '/api/hc/coach/:name/stats', async (req, res, s, q, params) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Head Coach access required.' });
  const today = todayJakarta();
  const d0 = new Date(today + 'T00:00:00');
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-01`;
  const types = await classTypes();
  const rows0 = await sb(`arena_class_schedules?select=id,schedule_date,start_time,class_type_id,instructor&instructor=ilike.*${enc(params.name)}*&is_cancelled=eq.false&schedule_date=gte.${monthStart}&schedule_date=lte.${today}&order=schedule_date.asc`);
  const rows = (rows0 || []).filter((r) => instructorHasCoach(r.instructor, params.name));
  const counts = await bookingCounts((rows || []).map((r) => r.id));
  const stats = (rows || []).map((r) => ({ date: fmtDMon(r.schedule_date), day: DOW_FULL[new Date(r.schedule_date + 'T00:00:00').getDay()], time: hhmm(r.start_time), type: shortType((types[r.class_type_id] || {}).name), peserta: (counts[r.id] || {}).confirmed || 0 }));
  const monthLabel = `${MON_FULL[d0.getMonth()]} ${d0.getFullYear()}`;
  return send(res, 200, { stats, monthLabel });
});

// ===== ADMIN =====
function requireAdmin(s) { return s.r === 'admin'; }
route('GET', '/api/admin/coaches', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const rows = await sb('arena_coach_users?select=id,username,coach_name,display_name,role,email,phone,is_active,password_plain&order=role.desc,coach_name.asc');
  const pm = await coachPhotoMap();
  return send(res, 200, { coaches: (rows || []).map((u) => ({ id: u.id, username: u.username, name: u.coach_name, role: u.role === 'hc' ? 'Head Coach' : u.role === 'admin' ? 'Admin' : 'Coach', email: u.email || '', phone: u.phone || '', status: u.is_active ? 'Active' : 'Inactive', photo: coachPhoto(pm, u.coach_name), password: u.password_plain || '' })) });
});
route('POST', '/api/admin/coaches', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const body = await readBody(req);
  if (!body || !body.name) return send(res, 400, { error: 'Name is required.' });
  const username = (body.username || String(body.name).replace(/^coach\s*/i, '').trim().split(/\s+/)[0]).toLowerCase();
  const pw = body.password || genPw();
  await sb('arena_coach_users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ username, password_hash: hashPassword(pw), password_plain: pw, coach_name: body.name.replace(/^coach\s*/i, '').trim(), display_name: body.name.trim(), role: body.role || 'coach', email: body.email || (username + '@20fit.id'), phone: body.phone || null }) });
  return send(res, 200, { ok: true, username, password: pw });
});
route('POST', '/api/admin/coaches/:id/reset', async (req, res, s, q, params) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const body = await readBody(req);
  const pw = (body && body.password) || genPw();
  await sb(`arena_coach_users?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hashPassword(pw), password_plain: pw, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true, password: pw });
});
route('POST', '/api/admin/coaches/:id/toggle', async (req, res, s, q, params) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const rows = await sb(`arena_coach_users?select=is_active&id=eq.${enc(params.id)}&limit=1`);
  const cur = rows && rows[0] ? rows[0].is_active : true;
  await sb(`arena_coach_users?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_active: !cur, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true, is_active: !cur });
});
route('POST', '/api/admin/coaches/:id/role', async (req, res, s, q, params) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const body = await readBody(req);
  if (!body || !['coach', 'hc', 'admin'].includes(body.role)) return send(res, 400, { error: 'Invalid role.' });
  await sb(`arena_coach_users?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ role: body.role, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true });
});
route('POST', '/api/admin/templates', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Admin access required.' });
  const body = await readBody(req);
  if (!body || !body.body) return send(res, 400, { error: 'Template text is required.' });
  await sb('arena_email_templates', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ body: body.body }) });
  return send(res, 200, { ok: true });
});

// ===== change password (any logged-in) =====
route('POST', '/api/coach/change-password', async (req, res, s) => {
  const body = await readBody(req);
  if (!body || !body.current_password || !body.new_password) return send(res, 400, { error: 'Current & new password are required.' });
  if (String(body.new_password).length < 6) return send(res, 400, { error: 'New password must be at least 6 characters.' });
  const rows = await sb(`arena_coach_users?select=*&username=eq.${enc(s.u)}&limit=1`);
  const u = rows && rows[0];
  if (!u || !verifyPassword(body.current_password, u.password_hash)) return send(res, 401, { error: 'Current password is incorrect.' });
  await sb(`arena_coach_users?id=eq.${enc(u.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hashPassword(body.new_password), updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true });
});

// ---------- server ----------
const PUBLIC_ROUTES = new Set(['POST /api/auth/login', 'POST /api/public/lookup', 'POST /api/public/review']);
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url === '/healthz') return send(res, 200, { ok: true });

    if (url.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const params = match(r.pattern, url);
        if (!params) continue;
        const key = `${r.method} ${r.pattern}`;
        let session = null;
        if (!PUBLIC_ROUTES.has(key)) {
          session = auth(req);
          if (!session) return send(res, 401, { error: 'Invalid session. Please log in again.' });
        }
        return await r.handler(req, res, session, query, params);
      }
      return send(res, 404, { error: 'Endpoint not found.' });
    }
    return serveStatic(req, res);
  } catch (err) {
    console.error('[ERROR]', err && err.message ? err.message : err);
    return send(res, 500, { error: 'A server error occurred.' });
  }
});
server.listen(PORT, () => console.log(`Coach Portal server on :${PORT}`));
