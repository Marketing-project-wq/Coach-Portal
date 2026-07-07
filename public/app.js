'use strict';
/* Coach Portal — real-data component (extends DCLogic from sc-runtime.js).
 * Sources every screen from the backend API; falls back to sample data with ?mock=1. */
/* External coaches: participants may review them, but they cannot see participant
 * data/names. They only get Schedule, Monitoring and Rotation. */
const EXTERNAL_COACHES = ['brian', 'gilang', 'mae', 'yokae'];
function isExternalName(name) { return EXTERNAL_COACHES.indexOf(String(name || '').replace(/^coach\s*/i, '').trim().toLowerCase()) >= 0; }
class Component extends DCLogic {
  constructor() {
    super();
    this.C = { volt: '#E4002B', voltDim: 'rgba(228,0,43,.12)', green: '#1C8A4B', amber: '#C77A00', red: '#E4002B', cyan: '#0068C9', muted: '#6E6E73', muted2: '#9A9A9E', raised: 'rgba(255,255,255,.55)', border2: 'rgba(17,17,20,.15)', text: '#1D1D1F' };
    this.accountRole = 'coach';
    this.isExternal = false;
    this._t = null;
    this.state = {
      loggedIn: false, role: 'coach', screen: 'dash', token: (window.localStorage && localStorage.getItem('arena_token')) || '',
      user: { name: '', role: '', first: '', initials: '' },
      absen: false, absenClass: null, reset: null, resetId: null, resetPwd: '', selSub: '', selCoachName: '', currentClass: null,
      editMenuId: null, editMenu: { title: '', category: '', content: '' },
      toast: '',
      d: this.emptyData(),
    };
    this.MOCK = /[?&]mock=1/.test(location.search);
    this.boot();
  }
  emptyData() {
    return { today: [], todayLabel: '', jadwalLabel: 'UPCOMING', week: [], weekStart: '', weekRange: '', monthly: [], monthlyYear: '', calCells: [], calMonthLabel: '', calYm: '', calPrevYm: '', calNextYm: '', selDate: '', mPesertaBulan: 0, mKelasBulan: 0, mPesertaTahun: 0, members: [], membersTotal: 0, membersActive: 0, leaderboard: [], recent: [], month: { classes: 0, peserta: 0 }, classDetail: null, subOptions: [], emailLog: [], fbClasses: [], fbParticipants: [], fbClassLabel: '', templates: [], hcToday: [], schedule: { coaches: [], times: [], grid: {} }, subs: { pending: [], history: [] }, rotations: { incoming: [], outgoing: [] }, reviews: [], reviewAvg: 0, reviewCount: 0, reviewCats: [], coaches: [], stats: [], statMonth: '', venues: [], venueBookings: [], venueCoaches: [], venueIsHC: false, classMenus: [], menuCanManage: false, arenaLoc: { set: false, radius_m: 150 } };
  }
  boot() {
    if (this.MOCK) {
      const role = (location.search.match(/role=(\w+)/) || [])[1] || 'coach';
      this.accountRole = role;
      this.isExternal = role === 'coach' && /[?&]ext=1/.test(location.search);
      const scr = (location.search.match(/screen=(\w+)/) || [])[1];
      this.state.loggedIn = true; this.state.role = role; this.state.screen = scr || (role === 'coach' ? 'dash' : role === 'hc' ? 'schedule' : 'accounts');
      this.state.user = this.userObj({ display_name: role === 'admin' ? 'Admin 20FIT' : 'Rheza', role, photo: role === 'coach' ? 'https://cpvzwqptzcxnwzfzgrmt.supabase.co/storage/v1/object/public/coach-photos/rheza-1778032238203.png' : '' });
      this.state.d = this.mockData();
      this.state.selFbClass = 'x1';
      return;
    }
    if (this.state.token) {
      this.api('/api/coach/me').then((me) => {
        this.accountRole = me.role;
        this.isExternal = !!me.external;
        this.state.user = this.userObj(me); this.state.loggedIn = true;
        this.applyRole(me.role, true);
      }).catch(() => this.logout());
    }
  }

  // ---------- helpers ----------
  ini(name) { const p = String(name || '').replace('Coach ', '').trim().split(' '); return ((p[0] && p[0][0] || 'C') + (p[1] ? p[1][0] : (p[0] && p[0][1]) || '')).toUpperCase(); }
  avatar(id) {
    const map = { nando: ['#E4002B', '#ffffff'], rheza: ['rgba(0,104,201,.18)', '#0068C9'], elsen: ['rgba(28,138,75,.18)', '#1C8A4B'], calysta: ['rgba(199,122,0,.18)', '#C77A00'], yokae: ['rgba(228,0,43,.16)', '#E4002B'], gilang: ['rgba(0,104,201,.16)', '#0068C9'], brian: ['rgba(28,138,75,.16)', '#1C8A4B'], mae: ['rgba(228,0,43,.16)', '#E4002B'] };
    return map[String(id || '').toLowerCase()] || ['rgba(17,17,20,.06)', '#888F9C'];
  }
  statusPill(status) {
    const C = this.C;
    const m = { 'Confirmed': ['rgba(136,143,156,.14)', C.muted], 'Checked-in': ['rgba(28,138,75,.14)', C.green], 'No-show': ['rgba(228,0,43,.14)', C.red], 'Upcoming': ['rgba(136,143,156,.14)', C.muted], 'Scheduled': ['rgba(136,143,156,.14)', C.muted], 'In Progress': [C.voltDim, C.volt], 'Teaching': [C.voltDim, C.volt], 'Completed': ['rgba(28,138,75,.14)', C.green], 'Approved': ['rgba(28,138,75,.14)', C.green], 'Cancelled': ['rgba(228,0,43,.14)', C.red], 'Rejected': ['rgba(228,0,43,.14)', C.red], 'Pending': ['rgba(136,143,156,.14)', C.muted], 'Sent': ['rgba(28,138,75,.14)', C.green], 'Failed': ['rgba(228,0,43,.14)', C.red] };
    const v = m[status] || ['rgba(136,143,156,.14)', C.muted]; return { bg: v[0], col: v[1] };
  }
  navMeta(active) { return active ? { bg: '#E4002B', fg: '#ffffff', bar: '#E4002B' } : { bg: 'transparent', fg: 'var(--text)', bar: 'transparent' }; }
  recencyLabel(d) {
    let label;
    if (d == null) label = 'First time';
    else if (d <= 0) label = 'Today';
    else if (d === 1) label = 'Yesterday';
    else if (d <= 60) label = d + ' days ago';
    else label = Math.round(d / 30) + ' months ago';
    return { label, col: this.C.text }; // plain white — the day/visit text already conveys recency
  }
  userObj(me) {
    const nm = me.display_name || me.coach_name || 'User';
    const roleLabel = me.role === 'hc' ? 'Head Coach' : me.role === 'admin' ? 'Administrator' : 'Coach';
    const name = me.role === 'admin' ? 'Admin 20FIT' : (/^coach/i.test(nm) ? nm : 'Coach ' + nm);
    return { name, role: roleLabel, first: nm.replace(/^coach\s*/i, ''), initials: me.role === 'admin' ? 'AD' : this.ini(nm), photo: me.photo || '', hasPhoto: !!me.photo };
  }

  // ---------- api + nav ----------
  api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (this.state.token) headers.Authorization = 'Bearer ' + this.state.token;
    return fetch(path, Object.assign({}, opts, { headers })).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 && path.indexOf('/auth/login') < 0) { this.logout(); throw new Error('unauthorized'); }
      if (!r.ok) throw new Error(data.error || 'Terjadi kesalahan.');
      return data;
    });
  }
  setD(patch) { this.setState({ d: Object.assign({}, this.state.d, patch) }); }
  loadCalendar(ym) { if (this.MOCK) return; this.api('/api/coach/calendar' + (ym ? ('?ym=' + ym) : '')).then((r) => this.setD({ calCells: r.cells, calMonthLabel: r.monthLabel, calYm: r.ym, calPrevYm: r.prevYm, calNextYm: r.nextYm })).catch(() => {}); }
  toastMsg(msg) { this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2800); }
  go(screen) { if (window.localStorage) localStorage.setItem('arena_screen', screen); this.setState({ screen, menuOpen: false }); if (!this.MOCK) this.loadScreen(screen); }
  toggleMenu() { this.setState({ menuOpen: !this.state.menuOpen }); }
  closeMenu() { this.setState({ menuOpen: false }); }
  applyRole(role, restore) {
    const def = role === 'coach' ? 'dash' : role === 'hc' ? 'schedule' : 'accounts';
    let screen = def;
    // On first load, return to the screen the user was last on (not always the role default).
    if (restore) { const saved = (window.localStorage && localStorage.getItem('arena_screen')) || ''; if (saved && ['detail', 'stats', 'addcoach', 'subreq', 'templates'].indexOf(saved) < 0) screen = saved; }
    // External coaches may only reach Schedule, Monitoring, Rotation, Venue Booking and Menu Kelas.
    if (this.isExternal && ['dash', 'monthly', 'subreq', 'venue', 'menu'].indexOf(screen) < 0) screen = 'dash';
    if (window.localStorage) localStorage.setItem('arena_screen', screen);
    this.setState({ role, screen });
    if (!this.MOCK) this.loadScreen(screen);
  }
  setRole(role) {
    const rank = { coach: 0, hc: 1, admin: 2 };
    if (rank[role] > rank[this.accountRole]) return this.toastMsg('You do not have access to this area.');
    this.applyRole(role);
  }
  loadScreen(screen) {
    const fail = (e) => { if (e && e.message !== 'unauthorized') this.toastMsg(e.message || 'Failed to load.'); };
    if (screen === 'dash') { this.api('/api/coach/dashboard').then((d) => this.setD({ month: d.month, todayLabel: d.todayLabel })).catch(fail); this.loadCalendar(); this.showDay(this.todayISO()); this.loadRotations(); }
    else if (screen === 'monthly') this.api('/api/coach/monthly').then((r) => this.setD({ monthly: r.months, monthlyYear: r.year, mPesertaBulan: r.monthPeserta, mKelasBulan: r.monthClasses, mPesertaTahun: r.yearPeserta })).catch(fail);
    else if (screen === 'members') this.api('/api/coach/members').then((r) => this.setD({ members: r.members, membersTotal: r.total, membersActive: r.active30 })).catch(fail);
    else if (screen === 'subreq') this.api('/api/coach/subs/options').then((d) => this.setD({ subOptions: d.options })).catch(fail);
    else if (screen === 'email') { this.setState({ selFbClass: '' }); this.setD({ fbParticipants: [], fbClassLabel: '' }); this.api('/api/coach/feedback/classes').then((d) => this.setD({ fbClasses: d.classes })).catch(fail); }
    else if (screen === 'reviews') this.api('/api/coach/reviews').then((r) => this.setD({ reviews: r.reviews, reviewAvg: r.avg, reviewCount: r.count, reviewCats: r.categories })).catch(fail);
    else if (screen === 'leaderboard') this.api('/api/coach/leaderboard').then((r) => this.setD({ leaderboard: r.board })).catch(fail);
    else if (screen === 'venue') this.api('/api/venue/bookings').then((r) => this.setD({ venueBookings: r.bookings, venueCoaches: r.coaches, venueIsHC: r.isHC })).catch(fail);
    else if (screen === 'menu') this.api('/api/coach/menu').then((r) => this.setD({ classMenus: r.menus, menuCanManage: r.canManage })).catch(fail);
    else if (screen === 'settings') this.api('/api/settings/arena-location').then((r) => this.setD({ arenaLoc: r })).catch(fail);
    else if (screen === 'overview' || screen === 'monitor') { this.api('/api/hc/today').then((d) => this.setD({ hcToday: d.today })).catch(fail); this.api('/api/hc/coaches').then((d) => this.setD({ coaches: d.coaches })).catch(fail); }
    else if (screen === 'schedule') this.api('/api/hc/schedule').then((d) => this.setD({ schedule: d })).catch(fail);
    else if (screen === 'subrev') { if (this.state.role === 'coach') this.loadRotations(); else this.api('/api/hc/subs').then((d) => this.setD({ subs: d })).catch(fail); }
    else if (screen === 'reports') this.api('/api/hc/coaches').then((d) => this.setD({ coaches: d.coaches })).catch(fail);
    else if (screen === 'stats') { const nm = this.state.selCoachName; if (nm) this.api('/api/hc/coach/' + encodeURIComponent(nm) + '/stats').then((d) => this.setD({ stats: d.stats, statMonth: d.monthLabel })).catch(fail); }
    else if (screen === 'accounts') this.api('/api/admin/coaches').then((d) => this.setD({ coaches: d.coaches })).catch(fail);
    else if (screen === 'templates') this.api('/api/templates').then((d) => this.setD({ templates: d.templates })).catch(fail);
  }

  // ---------- actions ----------
  login() {
    const email = (document.getElementById('loginEmail') || {}).value || '';
    const pw = (document.getElementById('loginPassword') || {}).value || '';
    if (!email || !pw) return this.toastMsg('Email/username & password are required.');
    this.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: email.trim(), password: pw }) })
      .then((res) => {
        if (window.localStorage) localStorage.setItem('arena_token', res.token);
        this.accountRole = res.coach.role;
        this.isExternal = !!res.coach.external || (res.coach.role === 'coach' && isExternalName(res.coach.coach_name || res.coach.display_name));
        this.setState({ token: res.token, loggedIn: true, user: this.userObj(res.coach) });
        this.applyRole(res.coach.role);
      }).catch((e) => this.toastMsg(e.message || 'Login failed.'));
  }
  logout() { if (window.localStorage) localStorage.removeItem('arena_token'); this.setState({ loggedIn: false, token: '', d: this.emptyData() }); }
  openClass(id) {
    if (this.MOCK) return this.go('detail');
    this.api('/api/coach/class/' + encodeURIComponent(id)).then((d) => { this.setState({ currentClass: d, screen: 'detail' }); this.setD({ classDetail: d }); }).catch((e) => this.toastMsg(e.message));
  }
  openAbsen(cls) { this.setState({ absen: true, absenClass: cls || (this.state.d.classDetail && this.state.d.classDetail.schedule) }); }
  openVenueAbsen(v) { this.setState({ absen: true, absenClass: { venueId: v.id, type: 'Arena + Coach · ' + (v.customer || 'Arena booking'), time: v.time || '' } }); }
  confirmAbsen() {
    const cls = this.state.absenClass; const id = cls && cls.schedule_id; const venueId = cls && cls.venueId;
    if (this.MOCK || (!id && !venueId)) { this.setState({ absen: false }); return this.toastMsg('Class started · attendance recorded'); }
    const path = venueId ? ('/api/venue/bookings/' + encodeURIComponent(venueId) + '/start') : ('/api/coach/class/' + encodeURIComponent(id) + '/start');
    const start = (coords) => {
      this.api(path, { method: 'POST', body: JSON.stringify(coords || {}) })
        .then(() => { this.setState({ absen: false }); this.toastMsg('Class started · attendance recorded'); this.loadScreen('dash'); })
        .catch((e) => { this.setState({ absen: false }); this.toastMsg(e.message); });
    };
    // Attach current GPS so the server can verify the coach is at the arena (when the lock is on).
    if (navigator.geolocation) {
      this.toastMsg('Checking your location…');
      navigator.geolocation.getCurrentPosition(
        (pos) => start({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => start(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else { start(null); }
  }
  submitMenu() {
    const val = (id) => ((document.getElementById(id) || {}).value || '').trim();
    const title = val('menuTitle');
    const content = val('menuContent');
    if (!title || !content) return this.toastMsg('Menu name & content are required.');
    const payload = { title, category: val('menuCategory'), content };
    const editId = this.state.editMenuId;
    if (this.MOCK) { this.setState({ editMenuId: null, editMenu: { title: '', category: '', content: '' } }); return this.toastMsg(editId ? 'Menu updated' : 'Class menu saved'); }
    const path = editId ? '/api/coach/menu/' + encodeURIComponent(editId) + '/update' : '/api/coach/menu';
    this.api(path, { method: 'POST', body: JSON.stringify(payload) })
      .then(() => { this.setState({ editMenuId: null, editMenu: { title: '', category: '', content: '' } }); this.toastMsg(editId ? 'Menu updated' : 'Class menu saved'); this.loadScreen('menu'); })
      .catch((e) => this.toastMsg(e.message));
  }
  startEditMenu(m) {
    this.setState({ editMenuId: m.id, editMenu: { title: m.title || '', category: m.category || '', content: m.content || '' } });
    // scroll the form (top of the screen) into view after the re-render
    const sc = document.querySelector('[data-scroll]'); if (sc) sc.scrollTop = 0;
  }
  cancelEditMenu() { this.setState({ editMenuId: null, editMenu: { title: '', category: '', content: '' } }); }
  deleteMenu(id) {
    if (this.MOCK) return this.toastMsg('Menu deleted');
    this.api('/api/coach/menu/' + encodeURIComponent(id) + '/delete', { method: 'POST' })
      .then(() => { if (this.state.editMenuId === id) this.setState({ editMenuId: null, editMenu: { title: '', category: '', content: '' } }); this.toastMsg('Menu deleted'); this.loadScreen('menu'); })
      .catch((e) => this.toastMsg(e.message));
  }
  captureArenaLoc() {
    if (this.MOCK) return this.toastMsg('Arena location saved (mock)');
    if (!navigator.geolocation) return this.toastMsg('This device does not support GPS.');
    const rEl = document.getElementById('arenaRadius');
    const radius = rEl ? parseInt(rEl.value, 10) || 150 : 150;
    this.toastMsg('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => this.api('/api/settings/arena-location', { method: 'POST', body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, radius_m: radius }) })
        .then(() => { this.toastMsg('Arena location saved · check-in is now locked to this location'); this.loadScreen('settings'); })
        .catch((e) => this.toastMsg(e.message)),
      () => this.toastMsg('Failed to get location. Enable location access and try again.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
  clearArenaLoc() {
    if (this.MOCK) return this.toastMsg('Location lock disabled (mock)');
    this.api('/api/settings/arena-location', { method: 'POST', body: JSON.stringify({ clear: true }) })
      .then(() => { this.toastMsg('Location lock disabled'); this.loadScreen('settings'); })
      .catch((e) => this.toastMsg(e.message));
  }
  submitSub() {
    if (!this.state.selSub) return this.toastMsg('Select a rotation coach first.');
    const cur = this.state.currentClass && this.state.currentClass.schedule;
    const reasonEl = document.querySelector('#app textarea');
    const payload = { to_coach: this.state.selSub, schedule_id: cur ? cur.schedule_id : null, class_label: cur ? cur.type : null, time_label: cur ? cur.time : null, reason: reasonEl ? reasonEl.value : '' };
    const toName = this.state.selSub;
    if (this.MOCK) { this.toastMsg('Rotation request sent to ' + toName); return this.go('dash'); }
    this.api('/api/coach/subs', { method: 'POST', body: JSON.stringify(payload) })
      .then(() => { this.setState({ selSub: '' }); this.toastMsg('Rotation request sent to ' + toName); this.go('dash'); })
      .catch((e) => this.toastMsg(e.message));
  }
  loadRotations() { if (this.MOCK) return; this.api('/api/coach/rotations').then((d) => this.setD({ rotations: d })).catch(() => {}); }
  shiftDate(iso, days) { const dt = new Date(iso + 'T00:00:00'); dt.setDate(dt.getDate() + days); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  gotoWeek(days) {
    const cur = this.state.d.weekStart; if (!cur) return;
    const start = this.shiftDate(cur, days);
    if (this.MOCK) { this.setD({ weekStart: start, weekRange: start }); return; }
    this.api('/api/coach/week?start=' + start).then((r) => this.setD({ week: r.week, weekRange: r.range, weekStart: r.start })).catch((e) => this.toastMsg(e.message));
  }
  fmtD(iso) { const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const d = new Date(iso + 'T00:00:00'); return d.getDate() + ' ' + M[d.getMonth()]; }
  fmtDayLong(iso) { const DF = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const d = new Date(iso + 'T00:00:00'); return DF[d.getDay()] + ', ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear(); }
  applyRange() {
    const from = (document.getElementById('rangeFrom') || {}).value;
    const to = (document.getElementById('rangeTo') || {}).value;
    if (!from || !to) return this.toastMsg('Select a from & to date.');
    if (from > to) return this.toastMsg('The "from" date must be before the "to" date.');
    const label = (this.fmtD(from) + ' – ' + this.fmtD(to)).toUpperCase();
    if (this.MOCK) return this.setD({ jadwalLabel: label });
    this.api('/api/coach/classes?from=' + from + '&to=' + to).then((r) => this.setD({ today: r.classes, venues: r.venues || [], jadwalLabel: label })).catch((e) => this.toastMsg(e.message));
  }
  resetRange() { if (this.MOCK) return this.setD({ jadwalLabel: 'UPCOMING' }); this.loadScreen('dash'); }
  todayISO() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  showDay(date) {
    if (!date) return;
    const label = this.fmtD(date).toUpperCase();
    // Optimistic: move the highlight + header instantly, then load that day's cards.
    this.setD({ jadwalLabel: label, selDate: date });
    if (this.MOCK) return;
    this.api('/api/coach/classes?from=' + date + '&to=' + date).then((r) => this.setD({ today: r.classes, venues: r.venues || [] })).catch((e) => this.toastMsg(e.message));
  }
  copyReviewLink() { const link = (typeof location !== 'undefined' ? location.origin : '') + '/review'; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(link).then(() => this.toastMsg('Review link copied')).catch(() => this.toastMsg(link)); } else { this.toastMsg(link); } }
  decideRotation(id, action) {
    if (this.MOCK) { const inc = this.state.d.rotations.incoming.filter((p) => p.id !== id); this.setD({ rotations: Object.assign({}, this.state.d.rotations, { incoming: inc }) }); return this.toastMsg(action === 'approve' ? 'Rotation approved' : 'Rotation rejected'); }
    this.api('/api/coach/rotations/' + encodeURIComponent(id) + '/decide', { method: 'POST', body: JSON.stringify({ action }) })
      .then(() => { this.toastMsg(action === 'approve' ? 'Rotation approved · this is now your class' : 'Rotation rejected'); this.loadRotations(); })
      .catch((e) => this.toastMsg(e.message));
  }
  openReset(c) { this.setState({ reset: c.name, resetId: c.id, resetPwd: '' }); }
  confirmReset() {
    const el = document.querySelector('#app input[data-reset]');
    const pw = ((el ? el.value : this.state.resetPwd) || '').trim();
    if (!pw) return this.toastMsg('Type a new password first.');
    if (this.MOCK) { this.setState({ reset: null }); return this.toastMsg('Password reset · share it with the coach'); }
    this.api('/api/admin/coaches/' + encodeURIComponent(this.state.resetId) + '/reset', { method: 'POST', body: JSON.stringify({ password: pw }) })
      .then((r) => { this.setState({ reset: null }); this.toastMsg('Password reset: ' + (r.password || pw)); })
      .catch((e) => this.toastMsg(e.message));
  }
  toggleCoach(c) {
    if (this.MOCK) return this.toastMsg('Status of ' + c.name + ' updated');
    this.api('/api/admin/coaches/' + encodeURIComponent(c.id) + '/toggle', { method: 'POST' })
      .then(() => { this.toastMsg('Status of ' + c.name + ' updated'); this.loadScreen('accounts'); }).catch((e) => this.toastMsg(e.message));
  }
  submitAddCoach() {
    const byPh = (ph) => { const els = document.querySelectorAll('#app input'); for (const e of els) if ((e.placeholder || '').indexOf(ph) >= 0) return e.value; return ''; };
    const name = byPh('Dimas') || byPh('Coach');
    if (!name) return this.toastMsg('Coach name is required.');
    const pwEl = document.getElementById('newCoachPw');
    const payload = { name, email: byPh('@20fit.id'), phone: byPh('0812'), password: (pwEl && pwEl.value) || undefined };
    if (this.MOCK) { this.toastMsg('New coach added · Active'); return this.go('accounts'); }
    this.api('/api/admin/coaches', { method: 'POST', body: JSON.stringify(payload) })
      .then((r) => { this.toastMsg('Coach added · user: ' + r.username + ' · pw: ' + r.password); this.go('accounts'); })
      .catch((e) => this.toastMsg(e.message));
  }
  exportToast() { this.toastMsg('File is being prepared for download'); }
  pickFbClass(e) {
    const id = e && e.target ? e.target.value : '';
    this.setState({ selFbClass: id });
    if (!id) return this.setD({ fbParticipants: [], fbClassLabel: '' });
    if (this.MOCK) return;
    this.api('/api/coach/feedback/participants?id=' + encodeURIComponent(id))
      .then((d) => this.setD({ fbParticipants: d.participants, fbClassLabel: d.classLabel }))
      .catch((err) => this.toastMsg(err.message));
  }
  submitFeedback() {
    const id = this.state.selFbClass;
    if (!id) return this.toastMsg('Select a class first.');
    const items = (this.state.d.fbParticipants || []).map((p) => {
      const el = document.getElementById('fb-' + p.booking_id);
      return { booking_id: p.booking_id, name: p.name, message: el ? el.value.trim() : '' };
    }).filter((it) => it.message);
    if (!items.length) return this.toastMsg('Write at least one feedback first.');
    if (this.MOCK) return this.toastMsg('Feedback sent to ' + items.length + ' participants');
    this.api('/api/coach/feedback', { method: 'POST', body: JSON.stringify({ schedule_id: id, items }) })
      .then((r) => { this.toastMsg('Feedback sent to ' + r.saved + ' participants'); this.setState({ selFbClass: '' }); this.setD({ fbParticipants: [], fbClassLabel: '' }); })
      .catch((err) => this.toastMsg(err.message));
  }
  assignVenue(id, coach) {
    if (!coach) return;
    if (this.MOCK) return this.toastMsg('Assigned coach: ' + coach);
    this.api('/api/venue/bookings/' + encodeURIComponent(id) + '/assign', { method: 'POST', body: JSON.stringify({ coach_name: coach }) })
      .then(() => { this.toastMsg('Assigned coach: ' + coach); this.loadScreen('venue'); })
      .catch((e) => this.toastMsg(e.message));
  }
  unassignVenue(id) {
    if (this.MOCK) return this.toastMsg('Coach assignment removed');
    this.api('/api/venue/bookings/' + encodeURIComponent(id) + '/unassign', { method: 'POST' })
      .then(() => { this.toastMsg('Coach assignment removed'); this.loadScreen('venue'); })
      .catch((e) => this.toastMsg(e.message));
  }
  randomPw() { const el = document.getElementById('newCoachPw'); if (!el) return; const cs = 'abcdefghjkmnpqrstuvwxyz23456789'; let p = ''; for (let i = 0; i < 8; i++) p += cs[Math.floor(Math.random() * cs.length)]; el.value = p; }
  addTemplate() {
    const text = (typeof prompt === 'function') ? prompt('New feedback template text:') : '';
    if (!text || !text.trim()) return;
    if (this.MOCK) return this.toastMsg('Template added');
    this.api('/api/admin/templates', { method: 'POST', body: JSON.stringify({ body: text.trim() }) })
      .then(() => { this.toastMsg('Template added'); this.loadScreen('templates'); })
      .catch((e) => this.toastMsg(e.message));
  }
  exportCSV() {
    const st = this.state, scr = st.screen, D = st.d;
    let rows, fname;
    if (scr === 'stats') {
      fname = 'stats-' + String(st.selCoachName || 'coach').replace(/\s+/g, '-').toLowerCase();
      rows = [['Date', 'Day', 'Time', 'Type', 'Participants']].concat((D.stats || []).map((r) => [r.date, r.day, r.time, r.type, r.peserta]));
    } else {
      fname = 'coach-report';
      rows = [['Coach', 'Role', 'Classes', 'Participants', 'Status']].concat((D.coaches || []).map((c) => [c.name, c.role, c.classes, c.peserta, c.status]));
    }
    if (rows.length < 2) return this.toastMsg('No data to export.');
    const csv = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = fname + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toastMsg('CSV file downloaded');
  }

  // ---------- render ----------
  renderVals() {
    const C = this.C, st = this.state, D = st.d;
    const isHC = st.role === 'hc' || st.role === 'admin';
    const isAdmin = st.role === 'admin';
    const scr = st.screen;
    const user = st.user;

    const A = (k) => this.navMeta(scr === k);
    const nav = { dash: A('dash'), email: A('email'), reviews: A('reviews'), monthly: A('monthly'), members: A('members'), leaderboard: A('leaderboard'), venue: A('venue'), menu: A('menu'), overview: A('overview'), schedule: A('schedule'), subrev: A('subrev'), monitor: A('monitor'), reports: A('reports'), accounts: A('accounts'), templates: A('templates'), settings: A('settings'), perms: A('perms') };
    if (scr === 'detail' || scr === 'subreq') Object.assign(nav.dash, this.navMeta(true));
    if (scr === 'stats') Object.assign(nav.monitor, this.navMeta(true));
    if (scr === 'addcoach') Object.assign(nav.accounts, this.navMeta(true));

    const seg = (on) => on ? { bg: 'var(--volt)', fg: '#ffffff' } : { bg: 'transparent', fg: 'var(--muted)' };
    const rseg = { coach: seg(st.role === 'coach'), hc: seg(st.role === 'hc'), admin: seg(st.role === 'admin') };
    const canHC = this.accountRole === 'hc' || this.accountRole === 'admin';
    const canAdmin = this.accountRole === 'admin';

    const titles = { dash: ['Coach', 'Schedule'], detail: ['Coach', 'Class Detail'], subreq: ['Coach', 'Rotation Coach'], email: ['Coach', 'Feedback'], overview: ['Head Coach', 'Overview'], schedule: ['Head Coach', 'Schedule'], subrev: ['Head Coach', 'Rotation'], monitor: ['Head Coach', 'Coach Monitoring'], stats: ['Head Coach', 'Monthly Statistics'], reports: ['Head Coach', 'Coach Report'], accounts: ['Admin', 'Account'], addcoach: ['Admin', 'Add Coach'], templates: ['Admin', 'Feedback Template'], settings: ['Admin', 'Settings'], perms: ['Admin', 'Role Permissions'] };
    titles.reviews = (st.role === 'coach') ? ['Coach', 'Review'] : ['Head Coach', 'Review'];
    titles.monthly = ['Coach', 'Class Monitoring'];
    titles.members = ['Coach', 'Participants'];
    titles.leaderboard = [st.role === 'hc' ? 'Head Coach' : st.role === 'admin' ? 'Admin' : 'Coach', 'Leaderboard'];
    titles.venue = [st.role === 'hc' ? 'Head Coach' : st.role === 'admin' ? 'Admin' : 'Coach', 'Venue Booking'];
    titles.menu = [st.role === 'hc' ? 'Head Coach' : st.role === 'admin' ? 'Admin' : 'Coach', 'Class Menu'];
    let tt = titles[scr] || ['', ''];
    if (scr === 'subrev' && st.role === 'coach') tt = ['Coach', 'Rotation'];
    const s = { dash: scr === 'dash', detail: scr === 'detail', subreq: scr === 'subreq', email: scr === 'email', reviews: scr === 'reviews', monthly: scr === 'monthly', members: scr === 'members', leaderboard: scr === 'leaderboard', venue: scr === 'venue', menu: scr === 'menu', overview: scr === 'overview', schedule: scr === 'schedule', subrev: scr === 'subrev', monitor: scr === 'monitor', stats: scr === 'stats', reports: scr === 'reports', accounts: scr === 'accounts', addcoach: scr === 'addcoach', templates: scr === 'templates', settings: scr === 'settings', perms: scr === 'perms' };

    // coach today
    const coachToday = (D.today || []).map((c) => {
      const p = this.statusPill(c.status);
      return Object.assign({}, c, { statusBg: p.bg, statusCol: p.col, openClass: () => this.openClass(c.schedule_id), openAbsen: () => this.openAbsen(c) });
    });
    // week
    const week = (D.week || []).map((d) => Object.assign({}, d, { bg: d.isToday ? 'var(--volt-dim)' : 'transparent', border: d.isToday ? 'rgba(228,0,43,.3)' : 'var(--border)', numCol: d.isToday ? 'var(--volt)' : (d.label === '—' ? 'var(--muted2)' : 'var(--text)'), pick: () => this.showDay(d.date) }));
    // teaching calendar (month grid) — highlight days the coach has classes
    const calDow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const selDate = D.selDate || '';
    const calCells = (D.calCells || []).map((c) => {
      if (c.blank) return { show: false, day: '', teach: false, count: 0, bg: 'transparent', border: 'transparent', col: 'var(--muted)', countCol: 'var(--volt)', cursor: 'default', pick: null };
      const isSel = c.date === selDate;
      return { show: true, day: c.day, teach: !!c.teach, count: c.count, cursor: 'pointer', pick: () => this.showDay(c.date),
        bg: isSel ? 'var(--volt)' : (c.teach ? 'var(--volt-dim)' : 'transparent'),
        border: isSel ? 'var(--volt)' : (c.isToday ? 'var(--volt)' : (c.teach ? 'rgba(228,0,43,.3)' : 'var(--border)')),
        col: isSel ? '#ffffff' : (c.teach ? 'var(--volt)' : (c.isToday ? 'var(--text)' : 'var(--muted)')),
        countCol: isSel ? '#ffffff' : 'var(--volt)' };
    });
    // monthly monitoring bars — bar height = jumlah peserta (volume); kelas ditampilkan sebagai caption
    const monthlyRaw = D.monthly || [];
    const maxP = Math.max(1, ...monthlyRaw.map((x) => x.peserta || 0));
    const monthly = monthlyRaw.map((x) => { const p = x.peserta || 0, k = x.count || 0; return { month: x.month, h: Math.round((p / maxP) * 92), bar: x.isCurrent ? 'var(--volt)' : (p ? 'rgba(0,104,201,.7)' : 'var(--border2)'), pesertaLabel: p ? String(p) : '–', pesertaCol: p ? '#0068C9' : 'var(--muted2)', kelasLabel: k + ' classes', monthCol: x.isCurrent ? 'var(--volt)' : 'var(--text)' }; });
    // participants (attendance frequency + recency of last visit)
    const members = (D.members || []).map((m, i) => {
      const r = this.recencyLabel(m.daysSince);
      const av = this.avatar(m.name);
      return { name: m.name, initials: this.ini(m.name), visits: m.visits, lastVisit: m.lastVisit, lastLabel: r.label, lastCol: r.col, avBg: av[0], avFg: av[1], rank: i + 1, classesLabel: m.classesLabel || '', hasClasses: !!m.classesLabel };
    });
    const noMembers = members.length === 0;
    // participant reviews
    const isHCView = st.role === 'hc' || st.role === 'admin';
    const reviews = (D.reviews || []).map((rv) => Object.assign({}, rv, { coachSuffix: (isHCView && rv.coach) ? ' · Coach ' + rv.coach : '', tags: Array.isArray(rv.tags) ? rv.tags : [], hasComment: !!(rv.comment && rv.comment.length) }));
    const noReviews = reviews.length === 0;
    const reviewLink = (typeof location !== 'undefined' ? location.origin : '') + '/review';
    // coach leaderboard (ranked by number of participants who booked the coach's classes)
    const leaderboard = (D.leaderboard || []).map((l) => {
      const av = this.avatar(l.name);
      return { name: l.name, initials: this.ini(l.name), peserta: l.peserta, classes: l.classes, rank: l.rank,
        medal: l.rank === 1 ? '🥇' : l.rank === 2 ? '🥈' : l.rank === 3 ? '🥉' : String(l.rank),
        rankCol: l.rank <= 3 ? C.amber : C.muted2, avBg: av[0], avFg: av[1], photo: l.photo || '', hasPhoto: !!l.photo,
        rowBg: l.isMe ? 'var(--volt-dim)' : 'transparent', meLabel: l.isMe ? ' · You' : '' };
    });
    const noBoard = leaderboard.length === 0;
    const recentClasses = D.recent || [];
    // venue booking — sourced from Admin Hub; HC assigns a coach to the "arena + coach" ones
    const venueIsHC = !!D.venueIsHC;
    const venueCoachOpts = (D.venueCoaches || []).map((c) => ({ name: c.name, label: c.name + (c.role === 'Head Coach' ? ' · Head Coach' : '') + (c.external ? ' · external' : '') }));
    const venueBookings = (D.venueBookings || []).map((b) => {
      const assigned = !!b.coach;
      return {
        id: b.id, code: b.code || '', customer: b.customer || '(no name)', dayLabel: b.dayLabel || '',
        timeLabel: b.time ? (b.time + (b.end ? '–' + b.end : '')) : 'Time not set',
        needsCoach: b.needsCoach, coach: b.coach || '', assigned,
        typeLabel: b.needsCoach ? 'Arena + Coach' : 'Arena', typeCol: b.needsCoach ? C.volt : C.cyan,
        typeBg: b.needsCoach ? 'var(--volt-dim)' : 'rgba(0,104,201,.1)',
        assignLabel: assigned ? ('✓ ' + b.coach) : 'No coach yet', assignCol: assigned ? C.green : C.amber,
        coachOpts: venueCoachOpts.map((o) => Object.assign({}, o, { picked: o.name === b.coach })),
        reassign: (e) => this.assignVenue(b.id, e && e.target ? e.target.value : ''), unassign: () => this.unassignVenue(b.id),
      };
    });
    const noVenueBookings = venueBookings.length === 0;
    const venueUnassignedCount = venueBookings.filter((b) => b.needsCoach && !b.assigned).length;
    // venue bookings that fall on the selected schedule day (shown inside the Schedule screen)
    const scheduleVenues = (D.venues || []).map((v) => Object.assign({}, v, { customer: v.customer || 'Arena booking', timeLabel: v.time ? (v.time + (v.end ? ' ' + v.end : '')) : 'Flexible time', hasArena: !!v.arena, hasPhone: !!v.phone, hasNotes: !!v.notes, canAbsen: !!v.canAbsen, started: !!v.started, openAbsen: () => this.openVenueAbsen(v) }));
    const hasScheduleVenues = scheduleVenues.length > 0;
    // menu kelas — shared class-program reference (patokan) for coaches
    const menuCanManage = !!D.menuCanManage;
    const classMenus = (D.classMenus || []).map((m) => { const can = menuCanManage || m.mine; return { id: m.id, title: m.title, content: m.content, category: m.category || '', hasCategory: !!m.category, by: m.by || '', hasBy: !!m.by, canDelete: can, canEdit: can, isEditing: st.editMenuId === m.id, del: () => this.deleteMenu(m.id), edit: () => this.startEditMenu(m) }; });
    const noClassMenus = classMenus.length === 0;
    // arena GPS lock (settings)
    const aloc = D.arenaLoc || { set: false, radius_m: 150 };
    const arenaLocSet = !!aloc.set;
    const arenaRadius = aloc.radius_m || 150;
    const arenaLocStatus = arenaLocSet ? ('✓ Arena location active · radius ' + arenaRadius + ' m — check-in locked to this location') : '○ Not set — check-in is not location-locked';
    const arenaLocCol = arenaLocSet ? C.green : C.muted;
    // participants
    // class detail header (bound to the real class, no slot-fill count)
    const cd = (D.classDetail && D.classDetail.schedule) || {};
    const detailTime = cd.time || '';
    const detailType = cd.type || '';
    const detailDate = cd.date ? this.fmtDayLong(cd.date) : '';
    const detailTimeRange = (cd.time || '') + (cd.end ? '–' + cd.end : '');
    const ac = st.absenClass || {};
    const absenLabel = ac.type ? (ac.type + (ac.time ? ' · ' + ac.time : '')) : '';
    const participants = ((D.classDetail && D.classDetail.participants) || []).map((p, i) => { const m = this.statusPill(p.status); const r = this.recencyLabel(p.daysSince); const v = p.visits || 0; return { n: i + 1, name: p.name, booking: p.booking, status: p.status, bg: m.bg, col: m.col, visits: v, attendInfo: v > 0 ? (v + ' visits · ') : '', lastLabel: r.label, lastCol: r.col, classesLabel: p.classesLabel || '', hasClasses: !!p.classesLabel }; });
    // sub options
    const subOptions = (D.subOptions || []).map((o) => { const dis = !!o.disabled; const picked = st.selSub === o.name; const roleLabel = o.role === 'hc' ? 'Head Coach' : 'Coach'; return { name: o.name, sub: o.spec || roleLabel, disabled: dis, initials: this.ini(o.name), border: dis ? 'var(--border)' : 'var(--border2)', bg: dis ? 'rgba(228,0,43,.04)' : 'var(--panel)', cursor: dis ? 'not-allowed' : 'pointer', nameCol: dis ? 'var(--muted2)' : 'var(--text)', subCol: 'var(--muted)', avBg: dis ? 'rgba(17,17,20,.06)' : 'rgba(228,0,43,.12)', avFg: dis ? '#9A9A9E' : 'var(--volt)', radioBorder: picked ? 'var(--volt)' : (dis ? 'var(--border2)' : 'var(--muted)'), radioFill: picked ? 'var(--volt)' : 'transparent', photo: o.photo || '', hasPhoto: !!o.photo, pick: () => { if (!dis) this.setState({ selSub: o.name }); } }; });
    // email log
    const emailLog = (D.emailLog || []).map((e) => { const m = this.statusPill(e.status); return Object.assign({}, e, { bg: m.bg, col: m.col, icon: e.status === 'Failed' ? '⚠' : '✓', iconBg: e.status === 'Failed' ? 'rgba(228,0,43,.12)' : 'var(--volt-dim)' }); });
    // feedback (manual, per-participant)
    const selFbClass = st.selFbClass || '';
    const fbClasses = D.fbClasses || [];
    const fbParticipants = (D.fbParticipants || []).map((p) => ({ name: p.name, booking_id: p.booking_id, fieldId: 'fb-' + p.booking_id }));
    const hasFbParticipants = !!selFbClass && fbParticipants.length > 0;
    const fbNoParticipants = !!selFbClass && fbParticipants.length === 0;
    const fbEmpty = !selFbClass;
    // HC today all
    const todayAll = (D.hcToday || []).map((t) => { const kc = { ok: ['rgba(28,138,75,.14)', C.green, '✓ '], warn: ['rgba(199,122,0,.14)', C.amber, '⚠ '], live: [C.voltDim, C.volt, ''], idle: ['rgba(136,143,156,.1)', C.muted, ''] }[t.kind] || ['rgba(136,143,156,.1)', C.muted, '']; return Object.assign({}, t, { bg: kc[0], col: kc[1], dot: t.kind === 'live' ? '● ' : kc[2] }); });
    // rotation requests — coach (rotation coach) decides; head coach only gets notified
    const isCoachView = st.role === 'coach';
    let pendingSubs, subHistory, incomingCount;
    if (isCoachView) {
      const inc = (D.rotations && D.rotations.incoming) || [];
      pendingSubs = inc.map((p) => Object.assign({}, p, { fromIni: this.ini(p.from), toIni: this.ini(p.to), canDecide: true, notify: false, approve: () => this.decideRotation(p.id, 'approve'), cancel: () => this.decideRotation(p.id, 'reject') }));
      const outg = (D.rotations && D.rotations.outgoing) || [];
      subHistory = outg.map((h) => { const label = h.status === 'approved' ? 'Approved' : h.status === 'rejected' ? 'Rejected' : h.status === 'cancelled' ? 'Cancelled' : 'Pending'; const m = this.statusPill(label); return Object.assign({}, h, { status: label, bg: m.bg, col: m.col }); });
      incomingCount = inc.length;
    } else {
      const pend = (D.subs && D.subs.pending) || [];
      pendingSubs = pend.map((p) => Object.assign({}, p, { fromIni: this.ini(p.from), toIni: this.ini(p.to), canDecide: false, notify: true }));
      subHistory = ((D.subs && D.subs.history) || []).map((h) => { const m = this.statusPill(h.status); return Object.assign({}, h, { bg: m.bg, col: m.col }); });
      incomingCount = pend.length;
    }
    const pendingCount = pendingSubs.length; const noPending = pendingCount === 0;
    const hasIncoming = incomingCount > 0;
    const rotHeader = isCoachView ? 'AWAITING YOUR APPROVAL' : 'ROTATION NOTIFICATIONS';
    // all-coach schedule — a clean, time-sorted list of classes (one card per class)
    const scheduleDateLabel = (D.schedule && (D.schedule.dateLabelEn || D.schedule.dateLabel)) || '';
    const scheduleList = ((D.schedule && D.schedule.list) || []).map((x) => { const comp = String(x.type).includes('Complete'); return { time: x.time, coach: x.coach, type: String(x.type).replace('HYROX ', ''), pax: x.pax, initials: this.ini(x.coach), photo: x.photo || '', hasPhoto: !!x.photo, accent: comp ? C.volt : C.cyan, bg: comp ? 'rgba(228,0,43,.06)' : 'rgba(0,104,201,.06)' }; });
    const hasSchedule = scheduleList.length > 0;
    const noSchedule = !hasSchedule;
    // coaches enriched
    const roleColor = (r) => r === 'Head Coach' ? { bg: C.voltDim, col: C.volt } : { bg: 'rgba(136,143,156,.14)', col: C.muted };
    const coaches = (D.coaches || []).map((c) => {
      const av = this.avatar(c.id); const rc = roleColor(c.role);
      const cls = c.classes || 0, att = c.attended != null ? c.attended : cls;
      return Object.assign({}, c, { initials: this.ini(c.name), avBg: av[0], avFg: av[1], hasPhoto: !!c.photo, passwordShown: c.password || '—', roleCol: c.role === 'Head Coach' ? C.volt : C.muted, roleBg: rc.bg, statusCol: c.status === 'Active' ? C.green : C.red, statusBg: c.status === 'Active' ? 'rgba(28,138,75,.12)' : 'rgba(228,0,43,.12)', punctCol: c.punctual >= 93 ? C.green : (c.punctual >= 90 ? C.text : C.amber), attended: att, attPct: cls ? (c.punctual + '%') : '—', attCol: !cls ? C.muted2 : (c.punctual >= 90 ? C.green : (c.punctual >= 50 ? C.amber : C.red)), toggleLabel: c.status === 'Active' ? 'Deactivate' : 'Activate', open: () => { this.setState({ selCoachName: c.name, screen: 'stats' }); if (!this.MOCK) this.loadScreen('stats'); }, reset: () => this.openReset(c), toggle: () => this.toggleCoach(c) });
    });
    const reportRows = coaches.slice(0, 12);
    const sel = coaches.find((c) => c.name === st.selCoachName) || coaches[0] || { name: st.selCoachName || '—', initials: this.ini(st.selCoachName || 'C'), classes: 0, peserta: 0, punctual: 0, attended: 0, attPct: '—', attCol: C.muted2, subs: 0, photo: '', hasPhoto: false };
    const statRows = D.stats || [];
    const statMonth = D.statMonth || '';
    // templates
    const templates = D.templates || [];
    // permissions (static matrix)
    const Y = '✓', N = '·';
    const permRaw = [['View own class schedule & participants', 1, 1, 1], ['Check in to own classes', 1, 1, 1], ['Request rotation (own classes)', 1, 1, 1], ['View all coaches’ schedules', 0, 1, 1], ['Change teaching coach (any class)', 0, 1, 1], ['Approve / Cancel rotations', 0, 1, 1], ['View all coaches’ attendance', 0, 1, 1], ['Access & export all-coach reports', 0, 1, 1], ['Manage appreciation message templates', 0, 0, 1], ['Add accounts & set initial password', 0, 0, 1], ['Reset coach passwords', 0, 0, 1], ['Deactivate coach accounts', 0, 0, 1], ['Set user roles', 0, 0, 1]];
    const perms = permRaw.map((p) => ({ act: p[0], c: p[1] ? Y : N, cCol: p[1] ? C.volt : C.muted2, h: p[2] ? Y : N, hCol: p[2] ? C.volt : C.muted2, a: p[3] ? Y : N, aCol: p[3] ? C.volt : C.muted2 }));

    return {
      notLoggedIn: !st.loggedIn, loggedIn: st.loggedIn,
      login: () => this.login(), logout: () => this.logout(),
      isHC, isAdmin, user, nav, rseg, s, canHC, canAdmin,
      isCoachView, showCoachNav: isCoachView || isAdmin, hasIncoming, incomingCount, rotHeader,
      isExternal: this.isExternal, showReview: !this.isExternal, showLeaderboard: !this.isExternal,
      showMembers: (isCoachView || isAdmin) && !this.isExternal, canOpenClass: !this.isExternal,
      monthClasses: (D.month || {}).classes || 0, monthPeserta: (D.month || {}).peserta || 0, todayLabel: D.todayLabel || '',
      weekRange: D.weekRange || '', prevWeek: () => this.gotoWeek(-7), nextWeek: () => this.gotoWeek(7),
      jadwalLabel: D.jadwalLabel || 'UPCOMING', applyRange: () => this.applyRange(), resetRange: () => this.resetRange(),
      monthly, monthlyYear: D.monthlyYear || '',
      calDow, calCells, calMonthLabel: D.calMonthLabel || '', calPrev: () => this.loadCalendar(this.state.d.calPrevYm), calNext: () => this.loadCalendar(this.state.d.calNextYm),
      noClasses: (D.today || []).length === 0,
      mPesertaBulan: D.mPesertaBulan || 0, mKelasBulan: D.mKelasBulan || 0, mPesertaTahun: D.mPesertaTahun || 0,
      members, membersTotal: D.membersTotal || 0, membersActive: D.membersActive || 0, noMembers, hasMembers: !noMembers, goMembers: () => this.go('members'),
      leaderboard, noBoard, hasBoard: !noBoard, goLeaderboard: () => this.go('leaderboard'),
      showVenueNav: true, goVenue: () => this.go('venue'), venueIsHC, venueIsCoach: !venueIsHC, venueCoachOpts, venueBookings, noVenueBookings, hasVenueBookings: !noVenueBookings,
      venueUnassignedCount, hasVenueUnassigned: venueUnassignedCount > 0, scheduleVenues, hasScheduleVenues,
      showMenuNav: true, goMenu: () => this.go('menu'), menuCanManage, classMenus, noClassMenus, hasClassMenus: !noClassMenus, submitMenu: () => this.submitMenu(),
      isEditingMenu: !!st.editMenuId, editMenuTitle: st.editMenu.title, editMenuCategory: st.editMenu.category, editMenuContent: st.editMenu.content,
      menuFormTitle: st.editMenuId ? 'Edit Menu' : 'Add New Menu', menuSubmitLabel: st.editMenuId ? 'Update Menu' : 'Save Menu', cancelEditMenu: () => this.cancelEditMenu(),
      arenaLocSet, arenaRadius, arenaLocStatus, arenaLocCol, captureArenaLoc: () => this.captureArenaLoc(), clearArenaLoc: () => this.clearArenaLoc(),
      pageKicker: tt[0], pageTitle: tt[1],
      setRoleCoach: () => this.setRole('coach'), setRoleHC: () => this.setRole('hc'), setRoleAdmin: () => this.setRole('admin'),
      menuState: st.menuOpen ? 'open' : 'closed', toggleMenu: () => this.toggleMenu(), closeMenu: () => this.closeMenu(),
      goDash: () => this.go('dash'), goEmail: () => this.go('email'), goReviews: () => this.go('reviews'), goMonthly: () => this.go('monthly'), goOverview: () => this.go('overview'), goSchedule: () => this.go('schedule'), goSubReview: () => this.go('subrev'), goMonitor: () => this.go('monitor'), goReports: () => this.go('reports'), goAccounts: () => this.go('accounts'), goTemplates: () => this.go('templates'), goSettings: () => this.go('settings'), goPerms: () => this.go('perms'),
      reviews, reviewAvg: D.reviewAvg || 0, reviewCount: D.reviewCount || 0, reviewCats: D.reviewCats || [], hasReviewCats: (D.reviewCats || []).length > 0, noReviews, reviewLink, copyReviewLink: () => this.copyReviewLink(),
      openClass: () => this.go('detail'), goSubReq: () => this.go('subreq'),
      detailTime, detailType, detailDate, detailTimeRange, absenLabel,
      coachToday, week, recentClasses, participants, subOptions, emailLog,
      fbClasses, fbParticipants, fbClassLabel: D.fbClassLabel || '', hasFbParticipants, fbNoParticipants, fbEmpty,
      pickFbClass: (e) => this.pickFbClass(e), submitFeedback: () => this.submitFeedback(),
      todayAll, pendingSubs, pendingCount, noPending, subHistory,
      scheduleDateLabel, hasSchedule, noSchedule, scheduleList, coaches, reportRows, sel, statRows, statMonth, templates, perms,
      openAbsen: () => this.openAbsen(), showAbsen: st.absen, closeAbsen: () => this.setState({ absen: false }), confirmAbsen: () => this.confirmAbsen(),
      submitSub: () => this.submitSub(), submitAddCoach: () => this.submitAddCoach(), goAddCoach: () => this.go('addcoach'), exportToast: () => this.exportToast(),
      exportCSV: () => this.exportCSV(), randomPw: () => this.randomPw(), addTemplate: () => this.addTemplate(),
      showReset: !!st.reset, resetName: st.reset || '', resetPwd: st.resetPwd, closeReset: () => this.setState({ reset: null }), confirmReset: () => this.confirmReset(),
      stopProp: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      hasToast: !!st.toast, toast: st.toast,
    };
  }

  // ---------- mock sample data (for ?mock=1 render tests) ----------
  mockData() {
    const d = this.emptyData();
    d.today = [{ schedule_id: 'x1', time: '07:00', end: '– 08:00', type: 'HYROX Complete', peserta: 12, cap: 16, started: false, accent: '#0068C9', status: 'Upcoming', canAbsen: true, dateLabel: 'Wed 1 Jul' }, { schedule_id: 'x2', time: '17:00', end: '– 18:00', type: 'HYROX Foundation', peserta: 8, cap: 12, started: false, accent: '#888F9C', status: 'Scheduled', canAbsen: true, dateLabel: 'Thu 2 Jul' }];
    d.todayLabel = 'Wednesday, 1 July 2026 · 1 class today';
    d.weekStart = '2026-06-29'; d.weekRange = '29 Jun – 5 Jul';
    d.monthlyYear = '2026';
    // teaching calendar mock — July 2026 (July 1 is a Wednesday → offset 2)
    d.calMonthLabel = 'July 2026'; d.calYm = '2026-07'; d.calPrevYm = '2026-06'; d.calNextYm = '2026-08';
    const teachDays = { 1: 2, 2: 1, 6: 1, 7: 1, 13: 1, 14: 1, 20: 1, 21: 1 };
    const calCellsMock = [];
    for (let i = 0; i < 2; i++) calCellsMock.push({ blank: true });
    for (let day = 1; day <= 31; day++) { const cc = teachDays[day] || 0; calCellsMock.push({ blank: false, day, date: '2026-07-' + String(day).padStart(2, '0'), count: cc, teach: cc > 0, isToday: day === 2 }); }
    d.calCells = calCellsMock; d.selDate = '2026-07-02'; d.jadwalLabel = 'WED 2 JUL';
    // Monitoring starts from July (matches the server's "since July" slice)
    const mCount = [8, 0, 0, 0, 0, 0];
    const mPes = [96, 0, 0, 0, 0, 0];
    d.monthly = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mn, i) => ({ month: mn, count: mCount[i], peserta: mPes[i], isCurrent: i === 0 }));
    d.mPesertaBulan = mPes[6]; d.mKelasBulan = mCount[6]; d.mPesertaTahun = mPes.reduce((a, b) => a + b, 0);
    d.members = [
      { name: 'Jordan', visits: 8, lastVisit: '5 May', daysSince: 58, classesLabel: 'HYROX Complete' },
      { name: 'Timothy Soetedjo', visits: 6, lastVisit: '23 Jun', daysSince: 9, classesLabel: 'HYROX Complete, HYROX Foundation' },
      { name: 'Woro Liana', visits: 5, lastVisit: '30 Jun', daysSince: 2, classesLabel: 'HYROX Foundation' },
      { name: 'Fathan', visits: 5, lastVisit: '14 Jun', daysSince: 18, classesLabel: 'HYROX Complete' },
      { name: 'Ayu Fitri', visits: 5, lastVisit: '11 May', daysSince: 52, classesLabel: 'HYROX Foundation' },
      { name: 'Indah Wulansari', visits: 4, lastVisit: '1 Jul', daysSince: 1, classesLabel: 'HYROX Complete' },
    ];
    d.membersTotal = 42; d.membersActive = 28;
    d.reviewAvg = 4.6; d.reviewCount = 2;
    d.reviewCats = [{ label: 'Clear Instructions', avg: '4.8' }, { label: 'Technique Correction', avg: '4.5' }, { label: 'Member Support', avg: '4.9' }, { label: 'Professionalism', avg: '4.7' }, { label: 'Class Management', avg: '4.6' }];
    d.reviews = [{ coach: 'Rheza', cls: 'HYROX Complete', name: 'Andra Wijaya', rating: 5, stars: '★★★★★', comment: 'The coach is patient & clear, the class is fun!', tags: ['Clear instructions', 'Patient & supportive', 'Fun class'], date: '1 Jul' }, { coach: 'Rheza', cls: 'HYROX Foundation', name: 'Sari Putri', rating: 4, stars: '★★★★☆', comment: '', tags: ['On time', 'Motivating'], date: '28 Jun' }];
    const LPH = 'https://cpvzwqptzcxnwzfzgrmt.supabase.co/storage/v1/object/public/coach-photos/';
    d.leaderboard = [
      { name: 'Elsen', peserta: 11, classes: 2, rank: 1, isMe: false },
      { name: 'Brian', peserta: 7, classes: 2, rank: 2, isMe: false },
      { name: 'Gilang', peserta: 6, classes: 2, rank: 3, isMe: false },
      { name: 'Rheza', peserta: 4, classes: 2, rank: 4, isMe: true, photo: LPH + 'rheza-1778032238203.png' },
      { name: 'Mae', peserta: 3, classes: 1, rank: 5, isMe: false },
      { name: 'Calysta', peserta: 1, classes: 1, rank: 6, isMe: false, photo: LPH + 'calysta-1778032200529.png' },
    ];
    d.week = [['MON', '23', '2 cls', true], ['TUE', '24', '1 cls', false], ['WED', '25', '2 cls', false], ['THU', '26', '1 cls', false], ['FRI', '27', '2 cls', false], ['SAT', '28', '—', false], ['SUN', '29', '—', false]].map((w) => ({ dow: w[0], day: w[1], label: w[2], isToday: w[3] }));
    d.recent = [{ type: 'HYROX Complete', date: '28 Jun', time: '07:00', peserta: 14 }, { type: 'HYROX Foundation', date: '27 Jun', time: '17:00', peserta: 9 }];
    d.month = { classes: 18, peserta: 162 };
    d.classDetail = { schedule: { schedule_id: 'x1', type: 'HYROX Complete', time: '07:00', end: '08:00', date: '2026-07-11' }, participants: [{ name: 'Andra Wijaya', booking: 'CL-0001', status: 'Confirmed', visits: 7, lastVisit: '30 Jun', daysSince: 2, classesLabel: 'HYROX Complete, HYROX Foundation' }, { name: 'Sari Putri', booking: 'CL-0002', status: 'Checked-in', visits: 0, lastVisit: '', daysSince: null, classesLabel: '' }] };
    d.subOptions = [{ name: 'Calysta', role: 'coach', spec: 'HYROX Complete', disabled: false, photo: LPH + 'calysta-1778032200529.png' }, { name: 'Elsen', role: 'coach', spec: 'HYROX Foundation', disabled: false }, { name: 'Gilang', role: 'coach', spec: 'HYROX Complete', disabled: false }];
    d.emailLog = [{ class: 'HYROX Complete · 07:00', date: '01 Jun', recipients: 12, status: 'Sent' }];
    d.fbClasses = [{ id: 'x1', label: 'HYROX Complete · 07:00 · 1 Jul' }, { id: 'x2', label: 'HYROX Foundation · 17:00 · 30 Jun' }];
    d.fbClassLabel = 'HYROX Complete'; d.fbParticipants = [{ booking_id: 'b1', name: 'Andra Wijaya' }, { booking_id: 'b2', name: 'Sari Putri' }, { booking_id: 'b3', name: 'Indah Wulansari' }];
    d.templates = [{ id: '01', text: 'Today’s class is done! Sore muscles mean you’re getting stronger.' }];
    d.hcToday = [{ time: '07:00', coach: 'Elsen', type: 'HYROX Complete', status: 'Teaching', kind: 'live' }, { time: '07:00', coach: 'Rheza', type: 'HYROX Foundation', status: 'Upcoming', kind: 'idle' }];
    d.schedule = { dateLabel: 'Wednesday 1 Jul', dateLabelEn: 'Friday · 3 Jul 2026', list: [
      { time: '07:00', coach: 'Elsen', type: 'HYROX Complete', pax: 12, photo: '' },
      { time: '07:00', coach: 'Rheza', type: 'HYROX Foundation', pax: 8, photo: LPH + 'rheza-1778032238203.png' },
      { time: '17:00', coach: 'Calysta', type: 'HYROX Complete', pax: 10, photo: LPH + 'calysta-1778032200529.png' },
      { time: '19:30', coach: 'Brian', type: 'HYROX Foundation', pax: 4, photo: '' },
    ] };
    d.subs = { pending: [{ id: 's1', from: 'Gilang', to: 'Brian', cls: 'HYROX Foundation', time: 'Mon, 17:00', reason: 'Sick' }], history: [{ from: 'Rheza', to: 'Calysta', cls: 'HYROX Complete', time: '12 Jun', status: 'Approved' }] };
    d.rotations = { incoming: [{ id: 'r1', from: 'Gilang', to: 'Rheza', cls: 'HYROX Foundation', time: 'Mon, 17:00', reason: 'Sick' }], outgoing: [{ id: 'r2', from: 'Rheza', to: 'Calysta', cls: 'HYROX Complete', time: 'Wed, 07:00', status: 'approved' }] };
    const PH = 'https://cpvzwqptzcxnwzfzgrmt.supabase.co/storage/v1/object/public/coach-photos/';
    d.coaches = [{ id: 'nando', name: 'Nando', role: 'Head Coach', classes: 16, attended: 15, peserta: 198, punctual: 94, subs: 1, status: 'Active', email: 'nando@20fit.id', phone: '-', password: 'nando456', photo: PH + 'nando-1778032225349.png' }, { id: 'rheza', name: 'Rheza', role: 'Coach', classes: 14, attended: 13, peserta: 162, punctual: 93, subs: 2, status: 'Active', email: 'rheza@20fit.id', phone: '-', password: 'rheza123', photo: PH + 'rheza-1778032238203.png' }];
    d.statMonth = 'July 2026';
    // venue booking (arena + coach)
    d.venueIsHC = true;
    d.venueCoaches = [{ name: 'Rheza', role: 'Coach', external: false }, { name: 'Elsen', role: 'Coach', external: false }, { name: 'Calysta', role: 'Coach', external: false }, { name: 'Nando', role: 'Head Coach', external: false }, { name: 'Brian', role: 'Coach', external: true }, { name: 'Gilang', role: 'Coach', external: true }, { name: 'Mae', role: 'Coach', external: true }, { name: 'YoKae', role: 'Coach', external: true }];
    d.venueBookings = [
      { id: 'v1', code: 'BK-20260706-0002', customer: 'Grace Liu', date: '2026-07-08', dateLabel: '8 Jul', dayLabel: 'Wed 8 Jul', time: '16:00', end: '18:00', needsCoach: true, coach: '', status: 'confirmed' },
      { id: 'v2', code: 'BK-20260701-0006', customer: 'Satrio', date: '2026-07-10', dateLabel: '10 Jul', dayLabel: 'Fri 10 Jul', time: '16:00', end: '20:00', needsCoach: true, coach: 'Rheza', status: 'confirmed' },
      { id: 'v3', code: 'BK-20260705-0001', customer: 'Yoshi', date: '2026-07-12', dateLabel: '12 Jul', dayLabel: 'Sun 12 Jul', time: '13:00', end: '15:00', needsCoach: false, coach: '', status: 'pending_payment' },
    ];
    d.venues = [{ id: 'v2', time: '16:00', end: '– 20:00', customer: 'Satrio', phone: '', arena: 'Arena 20FIT', notes: '', dateLabel: 'Fri 10 Jul', isToday: true, canAbsen: true, started: false }, { id: 'v3', time: '09:00', end: '– 11:00', customer: 'Corporate Group', phone: '', arena: 'Arena 20FIT', notes: '', dateLabel: 'Fri 10 Jul', isToday: true, canAbsen: false, started: true }];
    d.menuCanManage = true;
    d.classMenus = [
      { id: 'm1', title: 'HYROX Complete — Full Simulation', category: 'HYROX Complete', content: '8 stations · 1 km run each station:\n1) SkiErg 1000m\n2) Sled Push 50m\n3) Sled Pull 50m\n4) Burpee Broad Jump 80m\n5) Row 1000m\n6) Farmers Carry 200m\n7) Sandbag Lunge 100m\n8) Wall Balls 100 reps', by: 'Nando' },
      { id: 'm2', title: 'HYROX Foundation — Basic Technique', category: 'HYROX Foundation', content: 'Focus on form & pacing for beginners:\n- Warm up 10 minutes\n- Technique drill each station (half distance)\n- Cool down & mobility', by: 'Rheza' },
    ];
    d.arenaLoc = { set: true, lat: -6.195, lng: 106.83, radius_m: 150 };
    d.stats = [
      { date: '1 Jul', day: 'Wednesday', time: '18:30', type: 'HYROX Complete', peserta: 14 },
      { date: '3 Jul', day: 'Friday', time: '07:00', type: 'HYROX Foundation', peserta: 9 },
      { date: '5 Jul', day: 'Sunday', time: '09:00', type: 'HYROX Complete', peserta: 16 },
    ];
    return d;
  }
}
window.Component = Component;
