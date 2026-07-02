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
const DOW = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
const DOW_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MON_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function fmtDMon(d) { const dt = new Date(d + 'T00:00:00'); return dt.getDate() + ' ' + MON[dt.getMonth()]; }
function dLabel(d) { const dt = new Date(d + 'T00:00:00'); return DOW[dt.getDay()].charAt(0) + DOW[dt.getDay()].slice(1).toLowerCase() + ' ' + dt.getDate() + ' ' + MON[dt.getMonth()]; }

// ---------- data helpers ----------
let _typeCache = null;
async function classTypes() {
  if (_typeCache) return _typeCache;
  const rows = await sb('arena_class_types?select=id,name,color');
  const m = {}; for (const r of rows || []) m[r.id] = r; _typeCache = m; return m;
}
function shortType(name) { return String(name || '').replace(/^20FIT Arena\s*/i, '').replace(/^HYROX\s*/i, 'HYROX ').trim() || 'Kelas'; }

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

async function coachSchedules(coach, from, to) {
  let q = `arena_class_schedules?select=id,schedule_date,start_time,end_time,quota,class_type_id&instructor=eq.${enc(coach)}&is_cancelled=eq.false&schedule_date=gte.${from}`;
  if (to) q += `&schedule_date=lte.${to}`;
  return (await sb(q + '&order=schedule_date.asc,start_time.asc')) || [];
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
    return { schedule_id: x.id, time: hhmm(x.start_time), end: '– ' + hhmm(x.end_time), type: shortType(t.name),
      peserta: c.confirmed + c.pending, cap: x.quota || 0, started: isStarted,
      accent: isStarted ? '#D6FF3D' : (isToday ? '#4DD4F2' : '#888F9C'),
      status: isStarted ? 'Sedang Berlangsung' : (isToday ? 'Akan Datang' : 'Terjadwal'),
      canAbsen: isToday && !isStarted, dateLabel: dLabel(x.schedule_date) };
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
  const cacheFor = (ext) => (ext === '.html' || ext === '.js') ? 'no-cache' : 'public, max-age=3600';
  fs.readFile(fp, (err, data) => {
    if (err) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => e2 ? send(res, 404, 'Not found') : (res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }), res.end(d2)));
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
  if (!body || !body.username || !body.password) return send(res, 400, { error: 'Username & password wajib diisi.' });
  const uname = String(body.username).toLowerCase().trim();
  const rows = await sb(`arena_coach_users?select=*&username=eq.${enc(uname)}&limit=1`);
  const u = rows && rows[0];
  if (!u || !u.is_active || !verifyPassword(body.password, u.password_hash)) return send(res, 401, { error: 'Username atau password salah.' });
  sb(`arena_coach_users?id=eq.${enc(u.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_login: new Date().toISOString() }) }).catch(() => {});
  const token = signToken({ u: u.username, c: u.coach_name, d: u.display_name || u.coach_name, r: u.role || 'coach' });
  return send(res, 200, { token, coach: { coach_name: u.coach_name, display_name: u.display_name || u.coach_name, role: u.role || 'coach' } });
});
route('GET', '/api/coach/me', async (req, res, s) => send(res, 200, { coach_name: s.c, display_name: s.d, role: s.r }));

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
  const todayLabel = `${DOW_FULL[d0.getDay()]}, ${d0.getDate()} ${MON_FULL[d0.getMonth()]} ${d0.getFullYear()} · ` + (todayCount > 0 ? `${todayCount} kelas hari ini` : `${todayList.length} kelas mendatang`);

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
  const [counts, started] = await Promise.all([bookingCounts(ids), startedSet(ids)]);
  return send(res, 200, { classes: cardsFrom(sched, counts, started, types, today), from, to });
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
  const months = counts.map((c, i) => ({ month: MON[i], count: c, peserta: peserta[i], isCurrent: i === curMon }));
  const yearPeserta = peserta.reduce((a, b) => a + b, 0);
  return send(res, 200, { months, year, monthPeserta: peserta[curMon], monthClasses: counts[curMon], yearPeserta });
});

// ===== PUBLIC review (no login) — participants review the coach's class they attended =====
async function bookingByCode(code) {
  const rows = await sb(`arena_class_bookings?select=schedule_id,full_name,status&booking_code=eq.${enc(code)}&limit=1`);
  return rows && rows[0];
}
route('POST', '/api/public/lookup', async (req, res) => {
  const body = await readBody(req);
  const code = body && String(body.booking_code || '').trim().toUpperCase();
  if (!code) return send(res, 400, { error: 'Kode booking wajib diisi.' });
  const b = await bookingByCode(code);
  if (!b || !b.schedule_id) return send(res, 404, { error: 'Kode booking kelas tidak ditemukan.' });
  const scs = await sb(`arena_class_schedules?select=instructor,class_type_id,schedule_date&id=eq.${enc(b.schedule_id)}&limit=1`);
  const sc = scs && scs[0]; const types = await classTypes();
  const already = ((await sb(`arena_class_reviews?select=id&booking_code=eq.${enc(code)}&limit=1`)) || []).length > 0;
  return send(res, 200, { found: true, coach: sc ? sc.instructor : '', class_label: sc ? shortType((types[sc.class_type_id] || {}).name) : 'Kelas', date: sc ? sc.schedule_date : '', name: b.full_name || '', already });
});
route('POST', '/api/public/review', async (req, res) => {
  const body = await readBody(req);
  const code = body && String(body.booking_code || '').trim().toUpperCase();
  const rating = body && parseInt(body.rating, 10);
  if (!code || !(rating >= 1 && rating <= 5)) return send(res, 400, { error: 'Kode booking & rating (1-5) wajib diisi.' });
  const b = await bookingByCode(code);
  if (!b || !b.schedule_id) return send(res, 404, { error: 'Kode booking kelas tidak ditemukan.' });
  const dup = ((await sb(`arena_class_reviews?select=id&booking_code=eq.${enc(code)}&limit=1`)) || []).length > 0;
  if (dup) return send(res, 409, { error: 'Kode booking ini sudah pernah memberi review.' });
  const scs = await sb(`arena_class_schedules?select=instructor,class_type_id&id=eq.${enc(b.schedule_id)}&limit=1`);
  const sc = scs && scs[0]; const types = await classTypes();
  await sb('arena_class_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ schedule_id: b.schedule_id, coach_name: sc ? sc.instructor : null, class_label: sc ? shortType((types[sc.class_type_id] || {}).name) : null, reviewer_name: (String(body.name || b.full_name || '').slice(0, 80)) || null, booking_code: code, rating, comment: (String(body.comment || '').slice(0, 600)) || null }) });
  return send(res, 200, { ok: true });
});

// Reviews for the portal (coach sees own; head coach/admin see all)
route('GET', '/api/coach/reviews', async (req, res, s) => {
  const isHC = s.r === 'hc' || s.r === 'admin';
  let q = 'arena_class_reviews?select=coach_name,class_label,reviewer_name,rating,comment,created_at&order=created_at.desc&limit=100';
  if (!isHC) q += `&coach_name=eq.${enc(s.c)}`;
  const rows = (await sb(q)) || [];
  const avg = rows.length ? rows.reduce((a, x) => a + x.rating, 0) / rows.length : 0;
  const reviews = rows.map((x) => ({ coach: x.coach_name || '', cls: x.class_label || 'Kelas', name: x.reviewer_name || 'Anonim', rating: x.rating, stars: '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating), comment: x.comment || '', date: fmtDMon(String(x.created_at).slice(0, 10)) }));
  return send(res, 200, { reviews, avg: Math.round(avg * 10) / 10, count: rows.length });
});

// ===== COACH: class detail + participants =====
route('GET', '/api/coach/class/:id', async (req, res, s, q, params) => {
  const rows = await sb(`arena_class_schedules?select=id,schedule_date,start_time,end_time,quota,class_type_id,instructor&id=eq.${enc(params.id)}&limit=1`);
  const sc = rows && rows[0];
  if (!sc) return send(res, 404, { error: 'Jadwal tidak ditemukan.' });
  if (s.r === 'coach' && sc.instructor !== s.c) return send(res, 403, { error: 'Bukan kelas Anda.' });
  const types = await classTypes();
  const t = types[sc.class_type_id] || {};
  // Note: participant contact (phone/email) is intentionally NOT selected/returned —
  // coaches and head coaches must not see customer contact details.
  const bookings = await sb(`arena_class_bookings?select=id,booking_code,full_name,status,created_at&schedule_id=eq.${enc(params.id)}&order=created_at.asc`);
  const att = await sb(`arena_class_attendance?select=booking_id,status&schedule_id=eq.${enc(params.id)}`);
  const attMap = {}; for (const a of att || []) attMap[a.booking_id] = a.status;
  const started = (await sb(`arena_class_sessions?select=schedule_id&schedule_id=eq.${enc(params.id)}&limit=1`) || []).length > 0;
  const participants = (bookings || []).filter((b) => b.status !== 'cancelled').map((b) => ({
    booking_id: b.id, booking: b.booking_code, name: b.full_name || '(tanpa nama)',
    bookingStatus: b.status, attendance: attMap[b.id] || null,
    status: attMap[b.id] === 'checked_in' ? 'Checked-in' : attMap[b.id] === 'no_show' ? 'No-show' : 'Confirmed',
  }));
  return send(res, 200, { schedule: { schedule_id: sc.id, date: sc.schedule_date, time: hhmm(sc.start_time), end: hhmm(sc.end_time), type: shortType(t.name), quota: sc.quota }, started, participants });
});
route('POST', '/api/coach/class/:id/start', async (req, res, s, q, params) => {
  await sb('arena_class_sessions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ schedule_id: params.id, coach_name: s.c, status: 'ongoing' }) });
  return send(res, 200, { ok: true, started: true });
});
route('POST', '/api/coach/class/:id/attend', async (req, res, s, q, params) => {
  const body = await readBody(req);
  if (!body || !body.booking_id || !['checked_in', 'no_show'].includes(body.status)) return send(res, 400, { error: 'Data absensi tidak valid.' });
  await sb('arena_class_attendance', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ schedule_id: params.id, booking_id: body.booking_id, status: body.status, marked_by: s.c }) });
  return send(res, 200, { ok: true });
});

// ===== COACH: substitution =====
route('GET', '/api/coach/subs/options', async (req, res, s, q) => {
  const coaches = await sb(`arena_coach_users?select=coach_name,role,is_active&is_active=eq.true&order=coach_name.asc`);
  const opts = (coaches || []).filter((c) => c.coach_name !== s.c && c.role !== 'admin').map((c) => ({ name: c.coach_name, avail: 'Tersedia', disabled: false }));
  return send(res, 200, { options: opts });
});
route('POST', '/api/coach/subs', async (req, res, s) => {
  const body = await readBody(req);
  if (!body || !body.to_coach) return send(res, 400, { error: 'Coach rotation wajib dipilih.' });
  await sb('arena_coach_substitutions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ schedule_id: body.schedule_id || null, from_coach: s.c, to_coach: body.to_coach, class_label: body.class_label || null, time_label: body.time_label || null, reason: body.reason || null, status: 'pending' }) });
  return send(res, 200, { ok: true });
});

// Rotation requests directed at / raised by this coach; the ROTATION COACH (to_coach) decides.
route('GET', '/api/coach/rotations', async (req, res, s) => {
  const rows = await sb(`arena_coach_substitutions?select=*&or=(from_coach.eq.${enc(s.c)},to_coach.eq.${enc(s.c)})&order=created_at.desc&limit=60`);
  const incoming = (rows || []).filter((r) => r.to_coach === s.c && r.status === 'pending').map((r) => ({ id: r.id, from: r.from_coach, to: r.to_coach, cls: r.class_label || 'Kelas', time: r.time_label || '', reason: r.reason || '-' }));
  const outgoing = (rows || []).filter((r) => r.from_coach === s.c).map((r) => ({ id: r.id, from: r.from_coach, to: r.to_coach, cls: r.class_label || 'Kelas', time: r.time_label || fmtDMon(String(r.created_at).slice(0, 10)), status: r.status }));
  return send(res, 200, { incoming, outgoing });
});
route('POST', '/api/coach/rotations/:id/decide', async (req, res, s, q, params) => {
  const body = await readBody(req);
  const status = body && body.action === 'approve' ? 'approved' : 'rejected';
  const rows = await sb(`arena_coach_substitutions?select=to_coach,schedule_id&id=eq.${enc(params.id)}&limit=1`);
  const r = rows && rows[0];
  if (!r) return send(res, 404, { error: 'Permintaan rotation tidak ditemukan.' });
  if (r.to_coach !== s.c) return send(res, 403, { error: 'Hanya coach rotation yang dapat menyetujui/menolak.' });
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
  const log = (rows || []).map((e) => ({ class: e.class_label || 'Kelas', date: fmtDMon(String(e.sent_at).slice(0, 10)), recipients: e.recipients, status: e.status === 'failed' ? 'Gagal' : 'Terkirim' }));
  return send(res, 200, { log });
});
route('GET', '/api/templates', async (req, res) => {
  const rows = await sb('arena_email_templates?select=id,body&is_active=eq.true&order=created_at.asc');
  return send(res, 200, { templates: (rows || []).map((t, i) => ({ id: String(i + 1).padStart(2, '0'), rowId: t.id, text: t.body })) });
});

// ===== HEAD COACH ===== (role hc or admin)
function requireHC(s) { return s.r === 'hc' || s.r === 'admin'; }
route('GET', '/api/hc/today', async (req, res, s, q) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Butuh akses Head Coach.' });
  const today = q.date || todayJakarta();
  const types = await classTypes();
  const rows = await sb(`arena_class_schedules?select=id,start_time,instructor,class_type_id&schedule_date=eq.${today}&is_cancelled=eq.false&order=start_time.asc`);
  const ids = (rows || []).map((r) => r.id);
  const started = await startedSet(ids);
  const list = (rows || []).map((r) => {
    const t = types[r.class_type_id] || {};
    const on = started.has(r.id);
    return { time: hhmm(r.start_time), coach: r.instructor, type: shortType(t.name), status: on ? 'Mengajar' : 'Akan Datang', kind: on ? 'live' : 'idle' };
  });
  return send(res, 200, { today: list, date: today });
});
route('GET', '/api/hc/schedule', async (req, res, s, q) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Butuh akses Head Coach.' });
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
  return send(res, 200, { coaches: coachNames, times, grid, date: day });
});
route('GET', '/api/hc/subs', async (req, res, s) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Butuh akses Head Coach.' });
  const rows = await sb('arena_coach_substitutions?select=*&order=created_at.desc&limit=50');
  const pending = (rows || []).filter((r) => r.status === 'pending').map((r) => ({ id: r.id, from: r.from_coach, to: r.to_coach, cls: r.class_label || '', time: r.time_label || '', reason: r.reason || '' }));
  const history = (rows || []).filter((r) => r.status !== 'pending').slice(0, 10).map((r) => ({ from: r.from_coach, to: r.to_coach, cls: r.class_label || '', time: r.time_label || fmtDMon(String(r.created_at).slice(0, 10)), status: r.status === 'approved' ? 'Approved' : (r.status === 'rejected' ? 'Ditolak' : 'Cancelled') }));
  return send(res, 200, { pending, history });
});
// Head Coach only VIEWS rotation activity (notification) — approving is done by the rotation coach.
route('GET', '/api/hc/coaches', async (req, res, s, q) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Butuh akses Head Coach.' });
  const today = todayJakarta();
  const d0 = new Date(today + 'T00:00:00');
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-01`;
  const users = await sb('arena_coach_users?select=username,coach_name,role,is_active&order=coach_name.asc');
  const scheds = await sb(`arena_class_schedules?select=id,instructor,schedule_date&is_cancelled=eq.false&schedule_date=gte.${monthStart}&schedule_date=lte.${today}`);
  const byCoach = {};
  for (const sc of scheds || []) { byCoach[sc.instructor] = byCoach[sc.instructor] || { classes: 0, ids: [] }; byCoach[sc.instructor].classes++; byCoach[sc.instructor].ids.push(sc.id); }
  const allIds = (scheds || []).map((x) => x.id);
  const counts = await bookingCounts(allIds);
  const subs = await sb('arena_coach_substitutions?select=from_coach,status');
  const subCount = {}; for (const su of subs || []) subCount[su.from_coach] = (subCount[su.from_coach] || 0) + 1;
  const list = (users || []).filter((u) => u.role !== 'admin').map((u) => {
    const b = byCoach[u.coach_name] || { classes: 0, ids: [] };
    const peserta = b.ids.reduce((a, id) => a + ((counts[id] || {}).confirmed || 0), 0);
    return { id: u.username, name: u.coach_name, role: u.role === 'hc' ? 'Head Coach' : 'Coach', classes: b.classes, peserta, punctual: 100, subs: subCount[u.coach_name] || 0, status: u.is_active ? 'Active' : 'Inactive' };
  });
  return send(res, 200, { coaches: list });
});
route('GET', '/api/hc/coach/:name/stats', async (req, res, s, q, params) => {
  if (!requireHC(s)) return send(res, 403, { error: 'Butuh akses Head Coach.' });
  const today = todayJakarta();
  const d0 = new Date(today + 'T00:00:00');
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-01`;
  const types = await classTypes();
  const rows = await sb(`arena_class_schedules?select=id,schedule_date,start_time,class_type_id&instructor=eq.${enc(params.name)}&is_cancelled=eq.false&schedule_date=gte.${monthStart}&schedule_date=lte.${today}&order=schedule_date.asc`);
  const counts = await bookingCounts((rows || []).map((r) => r.id));
  const stats = (rows || []).map((r) => ({ date: fmtDMon(r.schedule_date), day: DOW_FULL[new Date(r.schedule_date + 'T00:00:00').getDay()], time: hhmm(r.start_time), type: shortType((types[r.class_type_id] || {}).name), peserta: (counts[r.id] || {}).confirmed || 0 }));
  const monthLabel = `${MON_FULL[d0.getMonth()]} ${d0.getFullYear()}`;
  return send(res, 200, { stats, monthLabel });
});

// ===== ADMIN =====
function requireAdmin(s) { return s.r === 'admin'; }
route('GET', '/api/admin/coaches', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Butuh akses Admin.' });
  const rows = await sb('arena_coach_users?select=id,username,coach_name,display_name,role,email,phone,is_active&order=role.desc,coach_name.asc');
  return send(res, 200, { coaches: (rows || []).map((u) => ({ id: u.id, username: u.username, name: u.coach_name, role: u.role === 'hc' ? 'Head Coach' : u.role === 'admin' ? 'Admin' : 'Coach', email: u.email || '', phone: u.phone || '', status: u.is_active ? 'Active' : 'Inactive' })) });
});
route('POST', '/api/admin/coaches', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Butuh akses Admin.' });
  const body = await readBody(req);
  if (!body || !body.name) return send(res, 400, { error: 'Nama wajib diisi.' });
  const username = (body.username || String(body.name).replace(/^coach\s*/i, '').trim().split(/\s+/)[0]).toLowerCase();
  const pw = body.password || genPw();
  await sb('arena_coach_users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ username, password_hash: hashPassword(pw), coach_name: body.name.replace(/^coach\s*/i, '').trim(), display_name: body.name.trim(), role: body.role || 'coach', email: body.email || (username + '@20fit.id'), phone: body.phone || null }) });
  return send(res, 200, { ok: true, username, password: pw });
});
route('POST', '/api/admin/coaches/:id/reset', async (req, res, s, q, params) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Butuh akses Admin.' });
  const body = await readBody(req);
  const pw = (body && body.password) || genPw();
  await sb(`arena_coach_users?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hashPassword(pw), updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true, password: pw });
});
route('POST', '/api/admin/coaches/:id/toggle', async (req, res, s, q, params) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Butuh akses Admin.' });
  const rows = await sb(`arena_coach_users?select=is_active&id=eq.${enc(params.id)}&limit=1`);
  const cur = rows && rows[0] ? rows[0].is_active : true;
  await sb(`arena_coach_users?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_active: !cur, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true, is_active: !cur });
});
route('POST', '/api/admin/coaches/:id/role', async (req, res, s, q, params) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Butuh akses Admin.' });
  const body = await readBody(req);
  if (!body || !['coach', 'hc', 'admin'].includes(body.role)) return send(res, 400, { error: 'Role tidak valid.' });
  await sb(`arena_coach_users?id=eq.${enc(params.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ role: body.role, updated_at: new Date().toISOString() }) });
  return send(res, 200, { ok: true });
});
route('POST', '/api/admin/templates', async (req, res, s) => {
  if (!requireAdmin(s)) return send(res, 403, { error: 'Butuh akses Admin.' });
  const body = await readBody(req);
  if (!body || !body.body) return send(res, 400, { error: 'Teks template wajib diisi.' });
  await sb('arena_email_templates', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ body: body.body }) });
  return send(res, 200, { ok: true });
});

// ===== change password (any logged-in) =====
route('POST', '/api/coach/change-password', async (req, res, s) => {
  const body = await readBody(req);
  if (!body || !body.current_password || !body.new_password) return send(res, 400, { error: 'Password lama & baru wajib diisi.' });
  if (String(body.new_password).length < 6) return send(res, 400, { error: 'Password baru minimal 6 karakter.' });
  const rows = await sb(`arena_coach_users?select=*&username=eq.${enc(s.u)}&limit=1`);
  const u = rows && rows[0];
  if (!u || !verifyPassword(body.current_password, u.password_hash)) return send(res, 401, { error: 'Password lama salah.' });
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
          if (!session) return send(res, 401, { error: 'Sesi tidak valid. Silakan login ulang.' });
        }
        return await r.handler(req, res, session, query, params);
      }
      return send(res, 404, { error: 'Endpoint tidak ditemukan.' });
    }
    return serveStatic(req, res);
  } catch (err) {
    console.error('[ERROR]', err && err.message ? err.message : err);
    return send(res, 500, { error: 'Terjadi kesalahan di server.' });
  }
});
server.listen(PORT, () => console.log(`Coach Portal server on :${PORT}`));
