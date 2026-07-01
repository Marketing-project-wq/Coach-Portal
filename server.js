'use strict';
/**
 * 20FIT Arena — Coach Portal backend
 *
 * Zero external dependencies (Node >= 18 built-ins only): http, crypto, fs, path, fetch.
 * Reads the existing Supabase Arena tables (schedules / bookings / class types) and
 * authenticates coaches against the arena_coach_users table.
 *
 * Required environment variables (set these in Railway):
 *   SUPABASE_URL          e.g. https://cpvzwqptzcxnwzfzgrmt.supabase.co
 *   SUPABASE_SERVICE_KEY  the Supabase "service_role" secret key (server-side only!)
 *   SESSION_SECRET        any long random string used to sign login tokens
 * Optional:
 *   PORT                  provided automatically by Railway
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://cpvzwqptzcxnwzfzgrmt.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!SERVICE_KEY) {
  console.warn('[WARN] SUPABASE_SERVICE_KEY is not set — database calls will fail until you set it in Railway.');
}
if (!SESSION_SECRET) {
  console.warn('[WARN] SESSION_SECRET is not set — using a random per-boot secret (logins reset on every restart). Set it in Railway.');
}
const SIGNING_SECRET = SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// ---------------------------------------------------------------------------
// Password hashing (scrypt) — format: scrypt$<saltHex>$<hashHex>
// ---------------------------------------------------------------------------
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(plain), salt, 32);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(plain, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = crypto.scryptSync(String(plain), salt, expected.length);
    return crypto.timingSafeEqual(derived, expected);
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session tokens — compact HMAC-signed token: <payloadB64url>.<sigB64url>
// ---------------------------------------------------------------------------
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}
function signToken(payload) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const p = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', SIGNING_SECRET).update(p).digest());
  return `${p}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SIGNING_SECRET).update(p).digest());
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(p).toString('utf8')); } catch (_e) { return null; }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// Supabase REST helper (PostgREST) using the service key
// ---------------------------------------------------------------------------
async function sb(pathAndQuery, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const enc = encodeURIComponent;

function todayJakarta() {
  // Arena runs on Asia/Jakarta (UTC+7); anchor "today" to that zone.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------
async function getCoachByUsername(username) {
  const rows = await sb(`arena_coach_users?select=*&username=eq.${enc(String(username).toLowerCase())}&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function getClassTypeMap() {
  const rows = await sb('arena_class_types?select=id,name,color,duration_min');
  const map = {};
  for (const r of rows || []) map[r.id] = r;
  return map;
}

async function getCoachSchedules(coachName, fromDate, toDate) {
  let q = `arena_class_schedules?select=id,schedule_date,start_time,end_time,quota,notes,class_type_id`
    + `&instructor=eq.${enc(coachName)}&is_cancelled=eq.false&schedule_date=gte.${enc(fromDate)}`;
  if (toDate) q += `&schedule_date=lte.${enc(toDate)}`;
  q += `&order=schedule_date.asc,start_time.asc`;
  const schedules = await sb(q);
  if (!schedules || schedules.length === 0) return [];

  const [typeMap, counts] = await Promise.all([
    getClassTypeMap(),
    getBookingCounts(schedules.map((s) => s.id)),
  ]);

  return schedules.map((s) => {
    const t = typeMap[s.class_type_id] || {};
    const c = counts[s.id] || { confirmed: 0, pending: 0 };
    return {
      id: s.id,
      schedule_date: s.schedule_date,
      start_time: s.start_time,
      end_time: s.end_time,
      notes: s.notes,
      quota: s.quota,
      class_name: t.name || 'Kelas',
      class_color: t.color || '#D6FF3D',
      duration_min: t.duration_min || null,
      confirmed_count: c.confirmed,
      pending_count: c.pending,
      booked_total: c.confirmed + c.pending,
    };
  });
}

async function getBookingCounts(scheduleIds) {
  const counts = {};
  if (!scheduleIds.length) return counts;
  const list = scheduleIds.map((id) => enc(id)).join(',');
  const rows = await sb(
    `arena_class_bookings?select=schedule_id,status&schedule_id=in.(${list})&status=in.(confirmed,pending_payment)`
  );
  for (const r of rows || []) {
    if (!counts[r.schedule_id]) counts[r.schedule_id] = { confirmed: 0, pending: 0 };
    if (r.status === 'confirmed') counts[r.schedule_id].confirmed += 1;
    else if (r.status === 'pending_payment') counts[r.schedule_id].pending += 1;
  }
  return counts;
}

async function getScheduleForCoach(scheduleId, coachName) {
  const rows = await sb(
    `arena_class_schedules?select=id,schedule_date,start_time,end_time,quota,notes,class_type_id`
    + `&id=eq.${enc(scheduleId)}&instructor=eq.${enc(coachName)}&limit=1`
  );
  return rows && rows[0] ? rows[0] : null;
}

async function getParticipants(scheduleId) {
  return sb(
    `arena_class_bookings?select=booking_code,full_name,phone,email,status,customer_type,booker_type,created_at`
    + `&schedule_id=eq.${enc(scheduleId)}&order=created_at.asc`
  );
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

function readJsonBody(req, limit = 1e6) {
  return new Promise((resolve) => {
    let data = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return resolve(null);
      try { resolve(data ? JSON.parse(data) : {}); } catch (_e) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

function authCoach(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return verifyToken(token);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback to index.html
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
        if (e2) return send(res, 404, 'Not found');
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = req.url.split('?')[0];
  const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

  try {
    if (method === 'OPTIONS') return send(res, 204, '');

    if (url === '/healthz') return send(res, 200, { ok: true });

    // ----- Auth -----
    if (url === '/api/auth/login' && method === 'POST') {
      const body = await readJsonBody(req);
      if (!body || !body.username || !body.password) return send(res, 400, { error: 'Username dan password wajib diisi.' });
      const user = await getCoachByUsername(body.username);
      if (!user || !user.is_active || !verifyPassword(body.password, user.password_hash)) {
        return send(res, 401, { error: 'Username atau password salah.' });
      }
      // best-effort last_login update
      sb(`arena_coach_users?id=eq.${enc(user.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_login: new Date().toISOString() }),
      }).catch(() => {});
      const token = signToken({ u: user.username, c: user.coach_name, d: user.display_name || user.coach_name });
      return send(res, 200, { token, coach: { coach_name: user.coach_name, display_name: user.display_name || user.coach_name } });
    }

    // ----- Everything below requires auth -----
    if (url.startsWith('/api/coach/')) {
      const session = authCoach(req);
      if (!session) return send(res, 401, { error: 'Sesi tidak valid atau kedaluwarsa. Silakan login ulang.' });

      if (url === '/api/coach/me' && method === 'GET') {
        return send(res, 200, { coach_name: session.c, display_name: session.d });
      }

      if (url === '/api/coach/schedules' && method === 'GET') {
        const from = query.from || todayJakarta();
        const to = query.to || null;
        const schedules = await getCoachSchedules(session.c, from, to);
        return send(res, 200, {
          coach: { coach_name: session.c, display_name: session.d },
          from, to,
          schedules,
        });
      }

      // /api/coach/schedules/:id/participants
      const m = url.match(/^\/api\/coach\/schedules\/([^/]+)\/participants$/);
      if (m && method === 'GET') {
        const scheduleId = decodeURIComponent(m[1]);
        const schedule = await getScheduleForCoach(scheduleId, session.c);
        if (!schedule) return send(res, 404, { error: 'Jadwal tidak ditemukan atau bukan kelas Anda.' });
        const typeMap = await getClassTypeMap();
        const t = typeMap[schedule.class_type_id] || {};
        const participants = await getParticipants(scheduleId);
        return send(res, 200, {
          schedule: {
            id: schedule.id,
            schedule_date: schedule.schedule_date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            quota: schedule.quota,
            notes: schedule.notes,
            class_name: t.name || 'Kelas',
            class_color: t.color || '#D6FF3D',
          },
          participants: participants || [],
        });
      }

      if (url === '/api/coach/change-password' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.current_password || !body.new_password) {
          return send(res, 400, { error: 'Password lama dan baru wajib diisi.' });
        }
        if (String(body.new_password).length < 6) {
          return send(res, 400, { error: 'Password baru minimal 6 karakter.' });
        }
        const user = await getCoachByUsername(session.u);
        if (!user || !verifyPassword(body.current_password, user.password_hash)) {
          return send(res, 401, { error: 'Password lama salah.' });
        }
        await sb(`arena_coach_users?id=eq.${enc(user.id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ password_hash: hashPassword(body.new_password), updated_at: new Date().toISOString() }),
        });
        return send(res, 200, { ok: true });
      }

      return send(res, 404, { error: 'Endpoint tidak ditemukan.' });
    }

    if (url.startsWith('/api/')) return send(res, 404, { error: 'Endpoint tidak ditemukan.' });

    // ----- Static frontend -----
    return serveStatic(req, res);
  } catch (err) {
    console.error('[ERROR]', err && err.message ? err.message : err);
    return send(res, 500, { error: 'Terjadi kesalahan di server.' });
  }
});

server.listen(PORT, () => {
  console.log(`Coach Portal server listening on port ${PORT}`);
});
