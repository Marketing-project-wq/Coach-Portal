// Regenerate ../public/index.html from the recovered DC design template.
// Run: node build/build.js   (from repo root)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const design = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
// Cache-busting version derived from the JS content — changes whenever app.js /
// sc-runtime.js change, so browsers/CDNs always fetch the newest script.
const assetVer = crypto.createHash('md5')
  .update(fs.readFileSync(path.join(ROOT, 'public', 'app.js')) + fs.readFileSync(path.join(ROOT, 'public', 'sc-runtime.js')) + fs.readFileSync(path.join(ROOT, 'public', 'i18n.js')))
  .digest('hex').slice(0, 8);

const xdcStart = design.indexOf('<x-dc>');
const xdcEnd = design.indexOf('</x-dc>');
let xdcInner = design.slice(xdcStart + '<x-dc>'.length, xdcEnd);
const helmet = (xdcInner.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
let template = xdcInner.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
let baseCss = (helmet.replace(/@font-face\s*\{[\s\S]*?\}/g, '').match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

// ---- wiring edits (before renames so we can target original ids) ----
// Login inputs get ids (accept username or email)
template = template.replace('value="rheza@20fit.id"', 'id="loginEmail" placeholder="username or email" value=""');
template = template.replace('value="rheza456" type="password"', 'id="loginPassword" type="password" placeholder="password" value=""');
// Reset-modal input flagged so confirmReset can read it
template = template.replace('value="{{ resetPwd }}"', 'data-reset value="{{ resetPwd }}"');
// Login card copy: neutral heading + rename the first field label (Email -> Name)
template = template.replace('Sign in as Coach', 'Sign in to your account');
template = template.replace('>Email</label>', '>Name</label>');
// Remove the promo hero panel; center the login form as a single column
template = template.replace('background:linear-gradient(160deg,#0C0E12,#101319);">', 'background:linear-gradient(160deg,#0C0E12,#101319);display:none;">');
template = template.replace('grid-template-columns:1.05fr .95fr', 'grid-template-columns:1fr');
// Sidebar logo: drop the old "20" badge; show the 20FIT ARENA wordmark above "Coach Workspace"
template = template.replace(
  '<div style="width:34px;height:34px;border-radius:9px;background:var(--volt);display:flex;align-items:center;justify-content:center;font-family:\'Archivo\';font-weight:900;font-size:16px;color:#08090B;">20</div>',
  '');
const arenaLogo = '<div style="display:flex;align-items:center;gap:6px;font-family:\'Archivo\';font-weight:900;font-size:19px;letter-spacing:.01em;line-height:1;margin-bottom:7px;">'
  + '<span style="color:var(--text);display:inline-flex;align-items:center;">2<span style="display:inline-flex;width:.66em;height:.66em;border:.15em solid var(--text);box-sizing:border-box;border-radius:50%;position:relative;margin:0 .04em;"><span style="position:absolute;inset:22%;background:#E4002B;border-radius:50%;"></span></span>FIT</span>'
  + '<span style="color:var(--muted2);font-weight:400;">|</span>'
  + '<span style="color:#E4002B;">ARENA</span></div>';
// Primary: the uploaded brand PNG. If it isn't present yet, fall back to the CSS wordmark above.
// On the dark sidebar we render the brand wordmark (white "20FIT" + red "ARENA")
// so the red brand accent stays visible — a plain PNG would be black-on-dark.
const arenaLogoDark = '<div style="display:flex;justify-content:center;">' + arenaLogo + '</div>';
template = template.replace(
  '<div style="font-family:\'Archivo\';font-weight:800;font-size:15px;letter-spacing:.01em;line-height:1;">20FIT<span style="color:var(--volt);"> ARENA</span><div style="font-size:10px;color:var(--muted2);font-weight:600;letter-spacing:.14em;margin-top:3px;">COACH PORTAL</div></div>',
  '<div style="flex:1;text-align:center;min-width:0;">' + arenaLogoDark + '<div style="font-family:\'Archivo\';font-weight:800;font-size:14px;letter-spacing:.02em;line-height:1.05;color:var(--muted);text-align:center;">Coach Workspace</div></div>');
template = template.replace('Submit to Head Coach', 'Send Coverage Request');
// Mobile drawer: mark the app shell with the menu state + inject a tap-to-close backdrop
template = template.replace(
  '<div style="position:relative;z-index:2;display:grid;grid-template-columns:248px 1fr;min-height:100vh;">',
  '<div data-menu="{{ menuState }}" style="position:relative;z-index:2;display:grid;grid-template-columns:248px 1fr;min-height:100vh;"><div class="menu-backdrop" onclick="{{ closeMenu }}"></div>');
// coachToday card: Detail/Absen buttons become per-item (scoped to that loop)
(() => {
  const start = template.indexOf('<sc-for list="{{ coachToday }}"');
  if (start < 0) return;
  const end = template.indexOf('</sc-for>', start) + '</sc-for>'.length;
  const block = template.slice(start, end)
    .replace(/\{\{ openClass \}\}/g, '{{ c.openClass }}')
    .replace(/\{\{ openAbsen \}\}/g, '{{ c.openAbsen }}')
    .replace('{{ c.end }}</span>', '{{ c.end }} · {{ c.dateLabel }}</span>')
    // jam & tanggal kelas: samakan ukuran (sedang, 15px)
    .replace('font-weight:700;font-size:24px;color:var(--text);">{{ c.time }}', 'font-weight:700;font-size:15px;color:var(--text);">{{ c.time }}')
    .replace('font-size:13px;color:var(--muted);">{{ c.end }}', 'font-size:15px;color:var(--muted);">{{ c.end }}')
    // perkecil kartu jadwal
    .replace('border-radius:18px;padding:20px;position:relative', 'border-radius:14px;padding:14px 15px;position:relative')
    .replace('align-items:center;justify-content:space-between;margin-bottom:14px;', 'align-items:center;justify-content:space-between;margin-bottom:8px;')
    .replace("font-family:'Archivo';font-weight:800;font-size:21px;letter-spacing:-.01em;", "font-family:'Archivo';font-weight:800;font-size:16px;letter-spacing:-.01em;")
    .replace('color:var(--muted);font-size:14px;margin-top:6px;', 'color:var(--muted);font-size:12.5px;margin-top:3px;')
    .replace('display:flex;gap:10px;margin-top:18px;', 'display:flex;gap:8px;margin-top:12px;')
    .replace('border-radius:10px;padding:11px;font-weight:700;font-size:13.5px;', 'border-radius:9px;padding:9px;font-weight:700;font-size:12.5px;')
    .replace("border-radius:10px;padding:11px;font-family:'Archivo';font-weight:800;font-size:13.5px;", "border-radius:9px;padding:9px;font-family:'Archivo';font-weight:800;font-size:12.5px;");
  template = template.slice(0, start) + block + template.slice(end);
})();
// Schedule heading: no date-range filter — the calendar drives which day is shown.
const jadwalHead = '<div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--muted);margin:6px 0 14px;">SCHEDULE · {{ jadwalLabel }}</div>';
template = template.replace('<div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--muted);margin:6px 0 14px;">TODAY\'S SCHEDULE</div>', jadwalHead);
// Dashboard: drop the "Classes This Month" / "Participants Served" stat cards (not needed)
template = template.replace(/<div style="display:flex;gap:12px;">\s*<div style="background:var\(--panel\)[\s\S]*?Participants Served[\s\S]*?<\/div><\/div>\s*<\/div>/, '');
// Tighter grid for the (now smaller) schedule cards
template = template.replace('<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">', '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">');
// Monthly teaching calendar on the Schedule screen — shows which dates the coach teaches
const calPanel = '<div style="background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:18px 20px;margin-bottom:22px;">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-family:\'Archivo\';font-weight:800;font-size:16px;">Calendar · {{ calMonthLabel }}</div>'
  + '<div style="display:flex;gap:8px;"><button onclick="{{ calPrev }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;line-height:1;">&#8249;</button><button onclick="{{ calNext }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;line-height:1;">&#8250;</button></div></div>'
  + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">'
  + '<sc-for list="{{ calDow }}" as="d"><div style="text-align:center;font-size:11px;font-weight:700;color:var(--muted2);padding:2px 0 4px;">{{ d }}</div></sc-for>'
  + '<sc-for list="{{ calCells }}" as="c"><div onclick="{{ c.pick }}" style="min-height:40px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:{{ c.bg }};border:1px solid {{ c.border }};cursor:{{ c.cursor }};" style-hover="border-color:var(--muted);"><sc-if value="{{ c.show }}"><div style="font-size:13px;font-weight:700;color:{{ c.col }};">{{ c.day }}</div><sc-if value="{{ c.teach }}"><div style="font-size:9px;color:{{ c.countCol }};font-weight:700;margin-top:1px;">{{ c.count }} cls</div></sc-if></sc-if></div></sc-for>'
  + '</div>'
  + '<div style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--muted);"><span style="width:11px;height:11px;border-radius:3px;background:var(--volt-dim);border:1px solid rgba(214,255,61,.3);display:inline-block;"></span>Has a class · click a date to see its schedule</div>'
  + '</div>';
// "Kalender Arena" — a full-month grid where each day lists its class bars (red, with pax,
// clickable to open per-class check-in) and venue bookings (dark). Shown for GRO in place of
// the simple month calendar.
const calNavBtn = 'background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;line-height:1;';
const arenaCalPanel = '<sc-if value="{{ showArenaCal }}">'
  + '<div style="background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:18px 20px;margin-bottom:22px;">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div><div style="font-family:\'Archivo\';font-weight:900;font-size:20px;letter-spacing:-.01em;">Kalender Arena &#183; {{ arenaCalLabel }}</div>'
      + '<div style="display:flex;gap:16px;margin-top:8px;font-size:11.5px;color:var(--muted);"><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;border-radius:3px;background:var(--volt);display:inline-block;"></span>Kelas</span><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;border-radius:3px;background:#2B3242;display:inline-block;"></span>Venue Booking</span></div></div>'
      + '<div style="display:flex;gap:8px;"><button onclick="{{ arenaCalPrev }}" style="' + calNavBtn + '">&#8249;</button><button onclick="{{ arenaCalNext }}" style="' + calNavBtn + '">&#8250;</button></div>'
    + '</div>'
    + '<div style="overflow-x:auto;"><div class="arena-cal-inner" style="min-width:1040px;">'
      + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;"><sc-for list="{{ calDow }}" as="d"><div style="text-align:center;font-size:11px;font-weight:700;color:var(--muted2);padding:2px 0;">{{ d }}</div></sc-for></div>'
      + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">'
        + '<sc-for list="{{ arenaCalCells }}" as="c"><div class="arena-cal-cell" style="min-height:120px;border-radius:9px;background:{{ c.bg }};border:1px solid {{ c.border }};padding:6px;display:flex;flex-direction:column;gap:3px;overflow:hidden;">'
          + '<sc-if value="{{ c.show }}"><div style="font-size:12px;font-weight:800;color:{{ c.numCol }};margin-bottom:1px;">{{ c.day }}</div>'
          + '<sc-for list="{{ c.events }}" as="e"><div onclick="{{ e.open }}" style="background:{{ e.bg }};color:#fff;border-radius:5px;padding:3px 6px;font-size:10px;line-height:1.25;cursor:{{ e.cursor }};display:flex;align-items:center;gap:4px;"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ e.text }}</span><sc-if value="{{ e.hasPax }}"><span style="background:rgba(0,0,0,.28);border-radius:100px;padding:0 6px;font-weight:700;flex-shrink:0;">{{ e.pax }}</span></sc-if></div></sc-for>'
          + '</sc-if>'
        + '</div></sc-for>'
      + '</div>'
    + '</div></div>'
  + '</div>'
  + '</sc-if>';
// "Rekap Absensi" — the attendance recap directly below the calendar, grouped by date → class →
// participant (name/phone/email/payment). GRO checks in inline; HC/Admin read it as a report.
const rcSel = 'background:var(--bg);border:1px solid var(--border2);border-radius:10px;padding:8px 12px;color:var(--text);font-family:\'Hanken Grotesk\';font-size:13px;font-weight:700;cursor:pointer;';
const registerRecap = '<sc-if value="{{ showRegister }}">'
  + '<div style="margin-bottom:22px;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
      + '<div style="font-family:\'Archivo\';font-weight:800;font-size:18px;">Rekap Absensi</div>'
      + '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;">'
        + '<sc-if value="{{ hasRegisterMonths }}"><select onchange="{{ setRegisterMonth }}" style="' + rcSel + '"><sc-for list="{{ registerMonthOpts }}" as="o"><option value="{{ o.ym }}" selected="{{ o.picked }}">{{ o.label }}</option></sc-for></select></sc-if>'
        + ''
      + '</div>'
    + '</div>'
    + '<sc-if value="{{ hasRegister }}"><sc-for list="{{ registerGroups }}" as="g">'
      + '<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--muted);margin:16px 0 9px;">{{ g.dateLabel }}</div>'
      + '<sc-for list="{{ g.classes }}" as="cl"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:12px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:var(--panel2);border-bottom:1px solid var(--border);">'
          + '<div style="display:flex;align-items:center;gap:11px;min-width:0;"><sc-if value="{{ cl.hasPhoto }}"><img src="{{ cl.photo }}" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex-shrink:0;"></sc-if><div style="min-width:0;"><div style="font-weight:800;font-size:14px;"><span style="font-family:\'JetBrains Mono\';">{{ cl.time }}</span> &#183; {{ cl.className }}</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">&#128100; {{ cl.coach }}</div><div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:3px;font-size:11px;font-weight:700;"><span style="color:var(--muted);">Jadwal {{ cl.schedTime }}</span><span style="color:{{ cl.ciCol }};">{{ cl.ciIcon }} {{ cl.ciText }}</span><sc-if value="{{ cl.ciTag }}"><span style="color:{{ cl.ciTagCol }};background:color-mix(in srgb,{{ cl.ciTagCol }} 15%,transparent);border-radius:100px;padding:1px 8px;">{{ cl.ciTag }}</span></sc-if><span style="color:{{ cl.coCol }};">{{ cl.coIcon }} {{ cl.coText }}</span></div></div></div>'
          + '<div style="text-align:right;flex-shrink:0;"><div style="font-weight:800;font-size:14px;">{{ cl.paxLabel }}</div><div style="font-size:11.5px;color:var(--green);font-weight:700;">{{ cl.attendedLabel }}</div><div style="font-size:11px;color:var(--amber);font-weight:700;">{{ cl.absentLabel }}</div></div>'
        + '</div>'
        + '<sc-for list="{{ cl.participants }}" as="p"><div style="padding:11px 16px;border-bottom:1px solid var(--border);">'
          + '<div style="display:flex;align-items:center;gap:12px;">'
            + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13.5px;">{{ p.name }}</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px;font-family:\'JetBrains Mono\';">&#128222; {{ p.phone }} &#183; &#9993; {{ p.email }}</div></div>'
            + '<sc-if value="{{ p.hasPayment }}"><span style="font-size:10.5px;font-weight:700;color:{{ p.payCol }};border:1px solid var(--border2);border-radius:100px;padding:3px 10px;flex-shrink:0;">{{ p.payment }}</span></sc-if>'
            + '<sc-if value="{{ registerCanCheck }}"><button onclick="{{ p.toggle }}" style="flex-shrink:0;border:1px solid var(--border2);background:{{ p.attBg }};color:{{ p.attFg }};border-radius:7px;padding:6px 18px;font-size:11.5px;font-weight:700;cursor:pointer;">Hadir</button></sc-if>'
            + '<sc-if value="{{ registerReadonly }}"><span style="font-weight:700;font-size:12.5px;color:{{ p.attCol }};flex-shrink:0;min-width:52px;text-align:right;">{{ p.attLabel }}</span></sc-if>'
          + '</div>'
          + '<sc-if value="{{ registerCanNote }}"><input value="{{ p.note }}" onchange="{{ p.saveNote }}" placeholder="Catatan (mis. izin, datang telat)…" style="width:100%;box-sizing:border-box;margin-top:8px;background:var(--bg);border:1px solid var(--border2);border-radius:8px;padding:7px 10px;color:var(--text);font-family:\'Hanken Grotesk\';font-size:12px;outline:0;"></sc-if>'
          + '<sc-if value="{{ p.hasNote }}"><sc-if value="{{ registerReadonly }}"><div style="margin-top:6px;font-size:12px;color:var(--muted);"><span style="color:var(--muted2);font-weight:700;">Note:</span> {{ p.note }}</div></sc-if></sc-if>'
        + '</div></sc-for>'
      + '</div></sc-for>'
    + '</sc-for></sc-if>'
    + '<sc-if value="{{ hasRegisterTotals }}"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-top:18px;">'
      + '<div style="font-family:\'Archivo\';font-weight:800;font-size:15px;margin-bottom:4px;">&#9201; Total Mengajar Coach &#183; bulan ini</div>'
      + '<sc-if value="{{ registerHoursOff }}"><div style="font-size:11.5px;color:var(--amber);margin-bottom:8px;">Total jam aktif setelah migrasi DB (checkout_at) dijalankan.</div></sc-if>'
      + '<sc-for list="{{ registerCoachTotals }}" as="t"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">'
        + '<div style="font-weight:700;">{{ t.coach }}</div>'
        + '<div style="color:var(--muted);font-size:12px;">{{ t.completed }}/{{ t.sessions }} sesi selesai &#183; <span style="color:var(--text);font-weight:800;font-size:14px;">{{ t.hours }}</span></div>'
      + '</div></sc-for>'
    + '</div></sc-if>'
    + '<sc-if value="{{ noRegister }}"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:34px 24px;text-align:center;color:var(--muted);">Belum ada data peserta pada periode ini.</div></sc-if>'
  + '</div>'
  + '</sc-if>';
// Simple month calendar stays for coach/HC/admin; GRO gets the Kalender Arena above instead.
// The per-day class cards below are hidden for GRO — open that wrapper right after the calendars.
template = template.replace(jadwalHead, '<sc-if value="{{ showSimpleCal }}">' + calPanel + '</sc-if>' + arenaCalPanel + '<sc-if value="{{ showDayCards }}">' + jadwalHead);
// ---- Check-out reminder banner on the coach dashboard (we never auto check-out) ----
const checkoutReminder = '<sc-if value="{{ hasPendingCheckout }}">'
  + '<div style="background:rgba(176,113,10,.12);border:1px solid var(--amber);border-radius:14px;padding:14px 16px;margin-bottom:18px;">'
    + '<div style="font-weight:800;font-size:14px;color:var(--amber);">&#9200; Jangan lupa Check Out</div>'
    + '<div style="font-size:12.5px;color:var(--muted);margin:4px 0 10px;">Kelas ini sudah selesai tapi belum kamu check out:</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;">'
      + '<sc-for list="{{ pendingCheckout }}" as="p"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:9px 12px;">'
        + '<div style="min-width:0;"><div style="font-weight:700;font-size:13px;">{{ p.type }}</div><div style="font-size:11.5px;color:var(--muted);">{{ p.dateLabel }} &#183; {{ p.time }}&#8211;{{ p.end }}</div></div>'
        + '<button onclick="{{ p.checkout }}" style="background:var(--green);border:0;color:#fff;border-radius:9px;padding:8px 15px;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap;flex-shrink:0;">Check Out</button>'
      + '</div></sc-for>'
    + '</div>'
  + '</div></sc-if>';
template = template.replace('<sc-if value="{{ showSimpleCal }}">', checkoutReminder + '<sc-if value="{{ showSimpleCal }}">');

// ---- Monthly coach-session report (conduct/check-out/hours) on the Reports screen ----
const coachSessPanel = '<sc-if value="{{ showCoachSess }}">'
  + '<div style="background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:18px 20px;margin-bottom:16px;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
      + '<div style="font-family:\'Archivo\';font-weight:800;font-size:18px;">Rekap Sesi Coach &#183; {{ coachSessMonthLabel }}</div>'
      + '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;">'
        + '<select onchange="{{ setCoachSessMonth }}" style="' + rcSel + '"><sc-for list="{{ coachSessMonths }}" as="o"><option value="{{ o.ym }}" selected="{{ o.picked }}">{{ o.label }}</option></sc-for></select>'
        + '<button onclick="{{ exportMonthly }}" style="background:var(--volt);border:0;color:#fff;border-radius:10px;padding:9px 15px;font-family:\'Archivo\';font-weight:800;font-size:12.5px;cursor:pointer;">&#128196; Cetak PDF (lengkap)</button>'
      + '</div>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Conduct = coach check-in &#183; Selesai = check-out. Terhitung otomatis dari kehadiran coach.</div>'
    + '<sc-if value="{{ coachSessHoursOff }}"><div style="background:rgba(176,113,10,.14);border:1px solid var(--amber);border-radius:10px;padding:9px 13px;font-size:12px;color:var(--amber);margin-bottom:12px;">Kolom &#8220;Total jam&#8221; aktif setelah migrasi DB (checkout_at) dijalankan.</div></sc-if>'
    + '<div style="overflow-x:auto;"><div style="min-width:680px;">'
      + '<div style="display:grid;grid-template-columns:1.5fr .8fr .8fr .8fr .9fr 1.2fr;gap:8px;padding:8px 10px;font-size:10.5px;font-weight:800;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid var(--border);">'
        + '<div>Coach</div><div style="text-align:center;">Terjadwal</div><div style="text-align:center;">Conduct</div><div style="text-align:center;">Selesai</div><div style="text-align:center;">Total jam</div><div>Status</div>'
      + '</div>'
      + '<sc-for list="{{ coachSessRows }}" as="r"><div style="display:grid;grid-template-columns:1.5fr .8fr .8fr .8fr .9fr 1.2fr;gap:8px;padding:11px 10px;font-size:13px;border-bottom:1px solid var(--border);align-items:center;">'
        + '<div style="font-weight:700;">{{ r.name }} <span style="color:var(--muted);font-weight:400;font-size:11px;">{{ r.roleTag }}</span></div>'
        + '<div style="text-align:center;font-variant-numeric:tabular-nums;">{{ r.scheduled }}</div>'
        + '<div style="text-align:center;font-weight:800;color:var(--volt);font-variant-numeric:tabular-nums;">{{ r.conducted }}</div>'
        + '<div style="text-align:center;font-variant-numeric:tabular-nums;">{{ r.completed }}</div>'
        + '<div style="text-align:center;font-variant-numeric:tabular-nums;font-weight:700;">{{ r.hours }}</div>'
        + '<div><span style="background:{{ r.statusBg }};color:{{ r.statusCol }};border-radius:100px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap;">{{ r.note }}</span></div>'
      + '</div></sc-for>'
      + '<sc-if value="{{ noCoachSess }}"><div style="padding:30px;text-align:center;color:var(--muted);">Belum ada sesi tercatat di bulan ini.</div></sc-if>'
    + '</div></div>'
  + '</div></sc-if>';
template = template.replace('<!-- REPORTS-RECAP -->', coachSessPanel + '<!-- REPORTS-RECAP -->');
// The attendance recap lives on the Reports screen (Head Coach / Admin), not the Schedule screen.
template = template.replace('<!-- REPORTS-RECAP -->', registerRecap);
// Empty state when the selected day has no classes
const noClassBox = '<sc-if value="{{ noClasses }}"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:34px 24px;text-align:center;color:var(--muted);">No classes on this date.</div></sc-if>';
template = template.replace(jadwalHead, jadwalHead + noClassBox);
// Close the showDayCards wrapper right after the class-cards grid (before the venue section).
template = template.replace('<sc-if value="{{ hasScheduleVenues }}">', '</sc-if>\n          <sc-if value="{{ hasScheduleVenues }}">');
// Remove the bottom grid entirely (the old "Kalender Minggu Ini" + "Riwayat Terakhir" panels)
// from the Schedule screen — the JADWAL cards are the last section now.
template = template.replace(/<div style="display:grid;grid-template-columns:1\.4fr 1fr;gap:16px;margin-top:24px;">[\s\S]*?Recent History[\s\S]*?<\/sc-for>\s*<\/div>\s*<\/div>/, '');
// "Monitoring Kelas per Bulan" is its own screen (separate nav item), not on the dashboard.
// Summary stat cards (current-month peserta/kelas + full-year peserta) sit above the chart.
const statCard = (label, val, col) => '<div style="background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">' + label + '</div><div style="font-family:\'Archivo\';font-weight:900;font-size:30px;' + (col ? 'color:' + col + ';' : '') + '">' + val + '</div></div>';
const monthlyStats = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:16px;">'
  + statCard('Classes This Month', '{{ mKelasBulan }}', 'var(--volt)')
  + statCard('Participants This Month', '{{ mPesertaBulan }}', '#0068C9')
  + statCard('Participants since July', '{{ mPesertaTahun }}', '#0068C9')
  + '</div>';
const monthlyPanel = '<div style="background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:22px;">'
  + '<div style="font-weight:800;font-family:\'Archivo\';font-size:16px;margin-bottom:4px;">Pax &amp; Classes per Month · since July {{ monthlyYear }}</div>'
  + '<div style="font-size:12px;color:var(--muted);margin-bottom:22px;">Bar height = number of <b style="color:#0068C9;">pax</b>. The number under each month name = number of <b style="color:var(--volt);">classes</b>.</div>'
  + '<div style="display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:10px;align-items:end;">'
  + '<sc-for list="{{ monthly }}" as="m"><div style="text-align:center;">'
  + '<div style="font-size:13px;font-weight:800;font-family:\'Archivo\';margin-bottom:6px;color:{{ m.pesertaCol }};">{{ m.pesertaLabel }}</div>'
  + '<div style="height:{{ m.h }}px;min-height:3px;background:{{ m.bar }};border-radius:6px;"></div>'
  + '<div style="font-size:11px;color:{{ m.monthCol }};margin-top:8px;font-weight:700;">{{ m.month }}</div>'
  + '<div style="font-size:10.5px;color:var(--muted2);margin-top:2px;">{{ m.kelasLabel }}</div>'
  + '</div></sc-for></div></div>';
const monthlyScreen = '<sc-if value="{{ s.monthly }}"><div style="max-width:980px;margin:0 auto;"><div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:20px;">Class Monitoring</div>' + monthlyStats + monthlyPanel + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', monthlyScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Inject the "Review Peserta" screen (sibling screen in the scroll area)
const reviewsScreen = '<sc-if value="{{ s.reviews }}"><div style="max-width:820px;margin:0 auto;"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;"><div><div style="font-family:\'Archivo\';font-weight:800;font-size:22px;">Participant Reviews</div></div><div style="display:flex;gap:12px;"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 18px;text-align:center;min-width:96px;"><div style="font-family:\'Archivo\';font-weight:900;font-size:26px;color:var(--amber);">{{ reviewAvg }}</div><div style="font-size:11px;color:var(--muted);">Average &#9733;</div></div><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 18px;text-align:center;min-width:96px;"><div style="font-family:\'Archivo\';font-weight:900;font-size:26px;">{{ reviewCount }}</div><div style="font-size:11px;color:var(--muted);">Total reviews</div></div></div></div><sc-if value="{{ hasReviewCats }}"><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"><sc-for list="{{ reviewCats }}" as="rc"><span style="background:var(--panel);border:1px solid var(--border);border-radius:100px;padding:7px 13px;font-size:12.5px;"><span style="color:var(--muted);">{{ rc.label }}</span> <span style="color:var(--amber);font-weight:700;">{{ rc.avg }}&#9733;</span></span></sc-for></div></sc-if><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div style="font-size:13px;color:var(--muted);">Review link for participants:<br><span style="color:var(--volt);font-family:\'JetBrains Mono\';font-size:13px;">{{ reviewLink }}</span></div><button onclick="{{ copyReviewLink }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:9px;padding:9px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Copy Link</button></div><sc-if value="{{ reviewFilterOn }}"><div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px;">Filter by coach</div><select onchange="{{ setReviewCoach }}" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:11px;padding:11px;color:var(--text);font-size:13.5px;cursor:pointer;"><option value="">All coaches</option><sc-for list="{{ reviewCoachOpts }}" as="o"><option value="{{ o.name }}" selected="{{ o.picked }}">{{ o.label }}</option></sc-for></select></div></sc-if><sc-for list="{{ reviews }}" as="rv"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:12px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><div style="font-weight:700;font-size:14px;">{{ rv.name }} <span style="color:var(--muted2);font-weight:400;font-size:12px;">&#183; {{ rv.cls }}{{ rv.coachSuffix }}</span></div><div style="color:var(--amber);font-size:15px;letter-spacing:2px;">{{ rv.stars }}</div></div><sc-if value="{{ rv.hasComment }}"><div style="color:var(--text);font-size:13.5px;margin-top:8px;">{{ rv.comment }}</div></sc-if><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;"><sc-for list="{{ rv.tags }}" as="t"><span style="background:var(--volt-dim);color:var(--volt);border-radius:100px;padding:3px 11px;font-size:11.5px;font-weight:700;">{{ t }}</span></sc-for></div><div style="color:var(--muted2);font-size:11.5px;margin-top:9px;">{{ rv.date }}</div></div></sc-for><sc-if value="{{ noReviews }}"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--muted);">No reviews yet. Share the link above with your participants &#10024;</div></sc-if></div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', reviewsScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Inject the "Peserta Kelas" screen — attendance frequency + last-visit recency per participant
const cardBox = 'background:var(--panel);border:1px solid var(--border);border-radius:16px;';
const selStyle = 'background:var(--bg);border:1px solid var(--border2);border-radius:10px;padding:8px 12px;color:var(--text);font-family:\'Hanken Grotesk\';font-size:13px;font-weight:700;cursor:pointer;';
const membersScreen = '<sc-if value="{{ s.members }}"><div style="max-width:900px;margin:0 auto;">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px;">'
    + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;">Participants Leaderboard</div>'
    + '<sc-if value="{{ hasMemberMonths }}"><select onchange="{{ setMemberMonth }}" style="' + selStyle + '"><option value="">All months</option><sc-for list="{{ memberMonthOpts }}" as="o"><option value="{{ o.ym }}" selected="{{ o.picked }}">{{ o.label }}</option></sc-for></select></sc-if>'
  + '</div>'
  + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px;">'
  + '<div style="' + cardBox + 'padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Participants</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;">{{ membersTotal }}</div></div>'
  + '<div style="' + cardBox + 'padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Active Last 30 Days</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;color:var(--green);">{{ membersActive }}</div></div>'
  + '</div>'
  + '<sc-if value="{{ hasMembers }}"><div style="' + cardBox + 'overflow:hidden;">'
  + '<sc-for list="{{ members }}" as="m"><div style="display:flex;align-items:center;gap:13px;padding:14px 18px;border-bottom:1px solid var(--border);">'
  + '<div style="width:24px;text-align:center;font-family:\'Archivo\';font-weight:800;font-size:15px;color:var(--muted2);flex-shrink:0;">{{ m.rank }}</div>'
  + '<div style="width:38px;height:38px;border-radius:50%;background:{{ m.avBg }};color:{{ m.avFg }};display:flex;align-items:center;justify-content:center;font-family:\'Archivo\';font-weight:800;font-size:13px;flex-shrink:0;">{{ m.initials }}</div>'
  + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:14.5px;">{{ m.name }}</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Last: {{ m.lastVisit }} &#183; <span style="color:{{ m.lastCol }};font-weight:700;">{{ m.lastLabel }}</span></div><sc-if value="{{ m.hasClasses }}"><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;"><sc-for list="{{ m.classes }}" as="c"><span style="background:var(--volt-dim);color:var(--volt);border-radius:100px;padding:2px 9px;font-size:10.5px;font-weight:700;white-space:nowrap;">{{ c.label }}</span></sc-for></div></sc-if><sc-if value="{{ m.hasMenus }}"><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center;"><span style="font-size:10px;color:var(--muted2);font-weight:700;">Menu:</span><sc-for list="{{ m.menus }}" as="mn"><span style="background:var(--panel2);border:1px solid var(--border2);color:var(--muted);border-radius:100px;padding:2px 9px;font-size:10.5px;font-weight:700;white-space:nowrap;">{{ mn.label }}</span></sc-for></div></sc-if></div>'
  + '<div style="text-align:right;flex-shrink:0;"><div style="font-family:\'Archivo\';font-weight:800;font-size:20px;">{{ m.visits }}</div><div style="font-size:11px;color:var(--muted);">visits</div></div>'
  + '</div></sc-for></div></sc-if>'
  + '<sc-if value="{{ noMembers }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">Belum ada peserta pada periode ini.</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', membersScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Inject the "Leaderboard Coach" screen — ranked by average participant rating
const boardScreen = '<sc-if value="{{ s.leaderboard }}"><div style="max-width:760px;margin:0 auto;">'
  + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:14px;">Coach Leaderboard</div>'
  + '<div style="display:inline-flex;background:var(--panel);border:1px solid var(--border);border-radius:11px;padding:3px;margin-bottom:16px;gap:2px;">'
    + '<button onclick="{{ sortByPax }}" style="background:{{ boardSortPax.bg }};color:{{ boardSortPax.fg }};border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:12.5px;cursor:pointer;">Participants</button>'
    + '<button onclick="{{ sortByRating }}" style="background:{{ boardSortRating.bg }};color:{{ boardSortRating.fg }};border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:12.5px;cursor:pointer;">Rating</button>'
  + '</div>'
  + '<sc-if value="{{ hasBoard }}"><div style="' + cardBox + 'overflow:hidden;">'
  + '<sc-for list="{{ leaderboard }}" as="l"><div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);background:{{ l.rowBg }};">'
  + '<div style="width:30px;text-align:center;font-family:\'Archivo\';font-weight:900;font-size:16px;color:{{ l.rankCol }};">{{ l.medal }}</div>'
  + '<div style="width:38px;height:38px;border-radius:50%;background:{{ l.avBg }};color:{{ l.avFg }};display:flex;align-items:center;justify-content:center;font-family:\'Archivo\';font-weight:800;font-size:13px;flex-shrink:0;position:relative;overflow:hidden;">{{ l.initials }}<sc-if value="{{ l.hasPhoto }}"><img src="{{ l.photo }}" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></sc-if></div>'
  + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:14.5px;">{{ l.name }}{{ l.meLabel }}</div><div style="font-size:12px;color:var(--muted);margin-top:1px;">{{ l.subLabel }}</div></div>'
  + '<div style="text-align:right;flex-shrink:0;"><div style="font-family:\'Archivo\';font-weight:800;font-size:19px;">{{ l.metricVal }}</div><div style="font-size:11px;color:var(--muted);">{{ l.metricLabel }}</div></div>'
  + '</div></sc-for></div></sc-if>'
  + '<sc-if value="{{ noBoard }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">No participant booking data yet.</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', boardScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');

// ---- Venue Booking (arena + coach) ----
// Nav item visible to ALL roles (coach / head coach / admin).
const venueNav = '<sc-if value="{{ showVenueNav }}"><button onclick="{{ goVenue }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.venue.bg }};color:{{ nav.venue.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.venue.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Venue Booking</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goDash \}\}"[\s\S]*?<\/button>)/, '$1' + venueNav);
// The in-app "Panduan" nav button was removed — the coach guide now lives at the shareable
// standalone URL <domain>/tutorial (public/tutorial.html → panduan-internal/freelance.html).
// GRO-only "Participants" nav — lives in the always-visible COACH area (the HC membersNav
// is inside the isHC block, invisible to GRO). Anchored on the always-shown goVenue button.
const groMembersNav = '<sc-if value="{{ isGro }}"><button onclick="{{ goMembers }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.members.bg }};color:{{ nav.members.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.members.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Participants</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goVenue \}\}"[\s\S]*?<\/button>)/, '$1' + groMembersNav);
// Head-coach-only "Assign Venue" nav (dispatch bookings to other coaches) — added inside the HEAD COACH section.
const venueAssignNav = '<button onclick="{{ goVenueAssign }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.venueassign.bg }};color:{{ nav.venueassign.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.venueassign.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Assign Venue</button>';
template = template.replace(/(<button onclick="\{\{ goSchedule \}\}"[\s\S]*?<\/button>)/, '$1' + venueAssignNav);
// Venue screen
const vInput = 'width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:11px;padding:12px;color:var(--text);font-family:\'Hanken Grotesk\';font-size:14px;outline:0;box-sizing:border-box;';
const vLabel = 'display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px;';
// One booking card. `showAssign`/`showCoachInfo` are per-item so the same card renders
// the HC dispatch dropdown OR the coach's own view (assigned coach).
const venueCard = '<div style="' + cardBox + 'padding:16px 18px;">'
  + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
    + '<div style="min-width:0;"><div style="font-weight:800;font-size:15.5px;">{{ b.customer }}</div>'
    + '<div style="font-size:12.5px;color:var(--muted);margin-top:3px;">{{ b.dayLabel }} &#183; {{ b.timeLabel }}</div>'
    + '<div style="font-size:11px;color:var(--muted2);margin-top:3px;font-family:\'JetBrains Mono\';">{{ b.code }}</div></div>'
    + '<span style="font-size:11px;font-weight:700;padding:4px 11px;border-radius:100px;background:{{ b.typeBg }};color:{{ b.typeCol }};white-space:nowrap;flex-shrink:0;">{{ b.typeLabel }}</span>'
  + '</div>'
  + '<sc-if value="{{ b.needsCoach }}">'
    + '<sc-if value="{{ b.showAssign }}"><div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">'
      + '<div style="font-size:12.5px;font-weight:700;color:{{ b.assignCol }};margin-bottom:9px;">{{ b.assignLabel }}</div>'
      + '<div style="display:flex;gap:10px;align-items:center;">'
        + '<select onchange="{{ b.reassign }}" style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:9px;padding:10px;color:var(--text);font-family:\'Hanken Grotesk\';font-size:13px;cursor:pointer;"><option value="">— select the responsible coach —</option><sc-for list="{{ b.coachOpts }}" as="o"><option value="{{ o.name }}" selected="{{ o.picked }}">{{ o.label }}</option></sc-for></select>'
        + '<sc-if value="{{ b.assigned }}"><button onclick="{{ b.unassign }}" style="background:transparent;border:1px solid var(--border2);color:var(--muted);border-radius:9px;padding:10px 14px;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap;">Remove</button></sc-if>'
      + '</div>'
      + '<button onclick="{{ b.dismiss }}" style="margin-top:11px;background:transparent;border:0;color:var(--muted);font-size:11.5px;font-weight:700;cursor:pointer;text-decoration:underline;padding:0;">No coach needed &#183; hide this booking</button>'
    + '</div></sc-if>'
    + '<sc-if value="{{ b.showCoachInfo }}"><div style="margin-top:12px;font-size:12.5px;color:var(--muted);">Assigned coach: <span style="color:var(--text);font-weight:700;">{{ b.coach }}</span></div></sc-if>'
  + '</sc-if>'
+ '</div>';
// Screen 1 — "Venue Booking": the coach's / head coach's OWN assigned arena sessions.
const venueScreen = '<sc-if value="{{ s.venue }}"><div style="max-width:900px;margin:0 auto;">'
  + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:18px;">Venue Booking</div>'
  + '<sc-if value="{{ hasVenueOwn }}"><div style="display:flex;flex-direction:column;gap:12px;">'
    + '<sc-for list="{{ venueOwn }}" as="b">' + venueCard + '</sc-for>'
  + '</div></sc-if>'
  + '<sc-if value="{{ noVenueOwn }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">No arena sessions assigned to you yet.</div></sc-if>'
  + '</div></sc-if>';
// Screen 2 — "Assign Venue" (head coach / admin only): dispatch every upcoming booking to a coach.
const venueAssignScreen = '<sc-if value="{{ s.venueassign }}"><div style="max-width:900px;margin:0 auto;">'
  + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:6px;">Assign Venue</div>'
  + '<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">Assign a responsible coach to each Arena + Coach booking.</div>'
  + '<sc-if value="{{ hasVenueDispatch }}"><div style="display:flex;flex-direction:column;gap:12px;">'
    + '<sc-for list="{{ venueDispatch }}" as="b">' + venueCard + '</sc-for>'
  + '</div></sc-if>'
  + '<sc-if value="{{ noVenueDispatch }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">No upcoming arena bookings.</div></sc-if>'
  // Bookings marked "no coach needed" (hidden from the list above) — with a Restore action.
  + '<sc-if value="{{ hasVenueHidden }}"><div style="margin-top:26px;">'
    + '<div style="font-family:\'Archivo\';font-weight:800;font-size:15px;color:var(--muted);letter-spacing:.02em;margin:0 0 10px;">Hidden &#183; no coach needed</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;"><sc-for list="{{ venueHidden }}" as="b"><div style="' + cardBox + 'padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;opacity:.75;">'
      + '<div style="min-width:0;"><div style="font-weight:700;font-size:14px;">{{ b.customer }}</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">{{ b.dayLabel }} &#183; {{ b.timeLabel }}</div></div>'
      + '<button onclick="{{ b.restore }}" style="background:transparent;border:1px solid var(--border2);color:var(--text);border-radius:9px;padding:8px 14px;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap;flex-shrink:0;">Restore</button>'
    + '</div></sc-for></div>'
  + '</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', venueScreen + '\n\n        ' + venueAssignScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');

// Admin-only "Arena Renters" leaderboard screen — customers who book the arena most (month-filterable).
const rentersScreen = '<sc-if value="{{ s.renters }}"><div style="max-width:760px;margin:0 auto;">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;">'
    + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;">&#127942; Top Arena Renters</div>'
    + '<sc-if value="{{ hasVenueLbMonths }}"><select onchange="{{ setVenueLbMonth }}" style="' + selStyle + '"><option value="">All months</option><sc-for list="{{ venueLbMonthOpts }}" as="o"><option value="{{ o.ym }}" selected="{{ o.picked }}">{{ o.label }}</option></sc-for></select></sc-if>'
  + '</div>'
  + '<sc-if value="{{ hasVenueRenters }}"><div style="' + cardBox + 'overflow:hidden;">'
    + '<sc-for list="{{ venueRenters }}" as="r"><div style="display:flex;align-items:center;gap:13px;padding:13px 18px;border-bottom:1px solid var(--border);">'
      + '<div style="width:26px;text-align:center;font-family:\'Archivo\';font-weight:900;font-size:16px;color:{{ r.medalCol }};flex-shrink:0;">{{ r.rank }}</div>'
      + '<div style="width:36px;height:36px;border-radius:50%;background:{{ r.avBg }};color:{{ r.avFg }};display:flex;align-items:center;justify-content:center;font-family:\'Archivo\';font-weight:800;font-size:12.5px;flex-shrink:0;">{{ r.initials }}</div>'
      + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:14.5px;">{{ r.name }}</div><div style="font-size:11.5px;color:var(--muted);">Terakhir sewa: {{ r.lastLabel }}</div></div>'
      + '<div style="text-align:right;flex-shrink:0;"><div style="font-family:\'Archivo\';font-weight:800;font-size:20px;">{{ r.count }}</div><div style="font-size:10.5px;color:var(--muted);">booking</div></div>'
    + '</div></sc-for>'
  + '</div></sc-if>'
  + '<sc-if value="{{ noVenueRenters }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">Belum ada data booking arena pada periode ini.</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', rentersScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');

// ---- Menu Kelas — shared class-program reference (patokan) for every coach ----
const menuNav = '<sc-if value="{{ showMenuNav }}"><button onclick="{{ goMenu }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.menu.bg }};color:{{ nav.menu.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.menu.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Class Menu</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goVenue \}\}"[\s\S]*?<\/button>)/, '$1' + menuNav);
const menuScreen = '<sc-if value="{{ s.menu }}"><div style="max-width:900px;margin:0 auto;">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;">'
    + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;">Class Menu</div>'
    + '<button onclick="{{ openMenuModal }}" style="background:var(--volt);border:0;color:#08090B;border-radius:11px;padding:11px 18px;font-family:\'Archivo\';font-weight:800;font-size:13.5px;cursor:pointer;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;">+ Add Menu</button>'
  + '</div>'
  + '<div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--muted);margin:0 0 12px;">MENU LIST</div>'
  + '<sc-if value="{{ hasClassMenus }}"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;align-items:start;">'
    + '<sc-for list="{{ classMenus }}" as="m"><div style="' + cardBox + 'padding:14px 16px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">'
        + '<div style="min-width:0;"><div style="font-weight:800;font-size:14.5px;">{{ m.title }}</div><sc-if value="{{ m.hasCategory }}"><span style="display:inline-block;margin-top:5px;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:100px;background:var(--volt-dim);color:var(--volt);">{{ m.category }}</span></sc-if></div>'
        + '<div style="display:flex;gap:7px;flex-shrink:0;">'
          + '<sc-if value="{{ m.canEdit }}"><button onclick="{{ m.edit }}" style="background:transparent;border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:6px 12px;font-weight:700;font-size:11.5px;cursor:pointer;white-space:nowrap;">Edit</button></sc-if>'
          + '<sc-if value="{{ m.canDelete }}"><button onclick="{{ m.del }}" style="background:transparent;border:1px solid var(--border2);color:var(--muted);border-radius:8px;padding:6px 12px;font-weight:700;font-size:11.5px;cursor:pointer;white-space:nowrap;">Remove</button></sc-if>'
        + '</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--text);margin-top:9px;line-height:1.45;white-space:pre-wrap;">{{ m.content }}</div>'
      + '<sc-if value="{{ m.hasBy }}"><div style="font-size:11px;color:var(--muted2);margin-top:9px;">Added by {{ m.by }}</div></sc-if>'
    + '</div></sc-for></div></sc-if>'
    + '<sc-if value="{{ noClassMenus }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">No class menus yet. Add the first one above &#128221;</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', menuScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');

// ---- Class Menu builder modal (structured: note + blocks + exercises with unit/weight) ----
const mi = 'background:var(--bg);border:1px solid var(--border2);border-radius:9px;padding:9px 10px;color:var(--text);font-family:\'Hanken Grotesk\';font-size:13px;outline:0;box-sizing:border-box;';
const menuModal = '<sc-if value="{{ showMenuModal }}" hint-placeholder-val="{{ false }}">'
  + '<div data-modalscroll style="position:fixed;inset:0;z-index:55;background:rgba(4,5,7,.72);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto;" onclick="{{ closeMenuModal }}">'
  + '<div onclick="{{ stopProp }}" style="background:var(--panel2);border:1px solid var(--border2);border-radius:20px;padding:24px;max-width:660px;width:100%;margin:auto;">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;">'
      + '<h2 style="font-family:\'Archivo\';font-weight:800;font-size:21px;margin:0;">{{ menuModalTitle }}</h2>'
      + '<button onclick="{{ closeMenuModal }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--muted);border-radius:9px;width:30px;height:30px;flex-shrink:0;cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>'
    + '</div>'
    + '<label style="' + vLabel + '">Menu Name</label>'
    + '<input data-mb="title" value="{{ mbTitle }}" placeholder="e.g. HYROX Complete — Full Simulation" style="' + mi + 'width:100%;margin-bottom:12px;">'
    + '<label style="' + vLabel + '">Class Type <span style="color:var(--muted2);font-weight:400;">(optional)</span></label>'
    + '<select data-mb="category" style="' + mi + 'width:100%;margin-bottom:12px;cursor:pointer;"><option value="">— select class type —</option><sc-for list="{{ mbCategoryOpts }}" as="o"><option value="{{ o.name }}" selected="{{ o.picked }}">{{ o.name }}</option></sc-for></select>'
    + '<label style="' + vLabel + '">Notes / manual add-on — before blocks <span style="color:var(--muted2);font-weight:400;">(optional)</span></label>'
    + '<textarea data-mb="note" rows="2" placeholder="e.g. 10 min amrap / 2 min rest — or type extra exercises by hand" style="' + mi + 'width:100%;resize:vertical;line-height:1.5;">{{ mbNote }}</textarea>'
    + '<div style="border-top:1px solid var(--border);margin:16px 0 4px;"></div>'
    // Blocks
    + '<sc-for list="{{ mbBlocks }}" as="blk"><div style="' + cardBox + 'padding:12px 13px;margin-bottom:8px;background:var(--panel);">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;">'
        + '<input data-mb="{{ blk.labelAttr }}" value="{{ blk.label }}" placeholder="Block (A, B, Wu…)" style="' + mi + 'width:150px;font-weight:700;">'
        + '<div style="flex:1;"></div>'
        + '<button onclick="{{ blk.removeBlock }}" title="Delete block" style="background:transparent;border:1px solid var(--border2);color:var(--muted);border-radius:8px;width:34px;height:34px;flex-shrink:0;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>'
      + '</div>'
      + '<sc-for list="{{ blk.items }}" as="it"><div style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:7px;">'
        + '<input data-mb="{{ it.nameAttr }}" value="{{ it.name }}" placeholder="exercise (e.g. Wallballs)" style="' + mi + 'flex:1;min-width:130px;">'
        + '<input data-mb="{{ it.amountAttr }}" value="{{ it.amount }}" placeholder="qty" inputmode="decimal" style="' + mi + 'width:62px;text-align:center;">'
        + '<select data-mb="{{ it.unitAttr }}" style="' + mi + 'width:84px;cursor:pointer;"><sc-for list="{{ it.unitOpts }}" as="o"><option value="{{ o.v }}" selected="{{ o.picked }}">{{ o.l }}</option></sc-for></select>'
        + '<input data-mb="{{ it.weightAttr }}" value="{{ it.weight }}" placeholder="kg (opt)" style="' + mi + 'width:80px;">'
        + '<button onclick="{{ it.remove }}" style="background:transparent;border:1px solid var(--border2);color:var(--muted);border-radius:8px;width:32px;height:34px;flex-shrink:0;cursor:pointer;font-size:13px;line-height:1;">✕</button>'
      + '</div></sc-for>'
      + '<div style="display:flex;gap:8px;margin-top:2px;flex-wrap:wrap;">'
        + '<button onclick="{{ blk.addItem }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:7px 13px;font-weight:700;font-size:12px;cursor:pointer;">+ Add Menu</button>'
        + '<button onclick="{{ blk.addBlockAfter }}" style="background:var(--volt-dim);border:1px solid var(--volt);color:var(--volt);border-radius:8px;padding:7px 13px;font-weight:700;font-size:12px;cursor:pointer;">+ Add Block</button>'
      + '</div>'
    + '</div></sc-for>'
    + '<div style="display:flex;gap:11px;margin-top:16px;">'
      + '<button onclick="{{ closeMenuModal }}" style="flex:1;background:transparent;border:1px solid var(--border2);color:var(--muted);border-radius:11px;padding:13px;font-weight:700;font-size:14px;cursor:pointer;">Cancel</button>'
      + '<button onclick="{{ saveMenuBuilder }}" style="flex:1.5;background:var(--volt);border:0;color:#08090B;border-radius:11px;padding:13px;font-family:\'Archivo\';font-weight:800;font-size:14px;cursor:pointer;text-transform:uppercase;letter-spacing:.02em;">Save Menu</button>'
    + '</div>'
  + '</div></div></sc-if>';
template = template.replace('<!-- ===== TOAST ===== -->', menuModal + '\n\n  <!-- ===== TOAST ===== -->');

// Hide Head Coach / Admin role buttons unless the account allows them
template = template.replace(/(<button onclick="\{\{ setRoleHC \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ canHC }}">$1</sc-if>');
template = template.replace(/(<button onclick="\{\{ setRoleAdmin \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ canAdmin }}">$1</sc-if>');

// ---- Rotation flow: rotation coach approves; head coach = notification only ----
// Inject a "Rotation" nav item into the COACH group (only in coach view)
const rotNav = '<sc-if value="{{ showCoachNav }}"><button onclick="{{ goSubReview }}" style="display:flex;align-items:center;justify-content:space-between;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.subrev.bg }};color:{{ nav.subrev.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.subrev.bar }};transition:background .15s;" style-hover="background:var(--panel2);"><span>Coverage</span><sc-if value="{{ hasIncoming }}"><span style="background:var(--amber);color:#08090B;font-size:11px;font-weight:800;padding:1px 7px;border-radius:100px;font-family:\'Archivo\';">{{ incomingCount }}</span></sc-if></button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goEmail \}\}"[\s\S]*?<\/button>)/, '$1' + rotNav);
// "Review" nav (peserta review) — hidden for external coaches; screen is role-aware (coach=own, HC=all)
const reviewNav = '<button onclick="{{ goReviews }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.reviews.bg }};color:{{ nav.reviews.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.reviews.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Review</button>';
template = template.replace(/(<button onclick="\{\{ goEmail \}\}"[\s\S]*?<\/button>)/, '$1' + reviewNav);
// "Monitoring" nav (coach-only) — monthly class count moved off the dashboard into its own screen
const monthlyNav = '<sc-if value="{{ showCoachNav }}"><button onclick="{{ goMonthly }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.monthly.bg }};color:{{ nav.monthly.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.monthly.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Monitoring</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goReviews \}\}"[\s\S]*?<\/button>)/, '$1' + monthlyNav);
// "Participants" nav — moved to the HEAD COACH group (HC + admin only); per-coach member
// attendance frequency, recency & menu history. Anchored on the HC "Reports" button.
const membersNav = '<sc-if value="{{ showMembers }}"><button onclick="{{ goMembers }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.members.bg }};color:{{ nav.members.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.members.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Participants</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goReports \}\}"[\s\S]*?<\/button>)/, '$1' + membersNav);
// "Leaderboard" nav — hidden for external coaches; ranks coaches by participant rating
const leaderboardNav = '<sc-if value="{{ showLeaderboard }}"><button onclick="{{ goLeaderboard }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.leaderboard.bg }};color:{{ nav.leaderboard.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.leaderboard.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Leaderboard</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goReviews \}\}"[\s\S]*?<\/button>)/, '$1' + leaderboardNav);
// Wrap the Review nav button itself in an sc-if (done last so the monthly/members/leaderboard
// injections above — which target the goReviews button — remain siblings, not children).
template = template.replace(/(<button onclick="\{\{ goReviews \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ showReview }}">$1</sc-if>');
// Approve/Reject buttons only when the current user may decide (the rotation coach)
template = template.replace(/(<button onclick="\{\{ p\.approve \}\}"[\s\S]*?<\/button>)/g, '<sc-if value="{{ p.canDecide }}">$1</sc-if>');
template = template.replace(/(<button onclick="\{\{ p\.cancel \}\}"[\s\S]*?<\/button>)/g, '<sc-if value="{{ p.canDecide }}">$1</sc-if><sc-if value="{{ p.notify }}"><span style="color:var(--amber);font-size:12.5px;font-weight:700;">⏳ Awaiting {{ p.to }}</span></sc-if>');
// Role-aware header on the rotation screen + corrected submit note
template = template.replace('AWAITING ACTION', '{{ rotHeader }}');
template = template.replace('until the Head Coach approves it.', 'until the coverage coach approves it.');

// ---- Label renames (longest/upper variants first) ----
const renames = [
  ['PENGGANTIAN', 'ROTATION'], ['Penggantian', 'Rotation'], ['penggantian', 'rotation'], ['PENGGANTI', 'ROTATION'], ['pengganti', 'rotation'],
  ['Jadwal Tim', 'Schedule'], ['Email Apresiasi', 'Feedback'], ['Template Email', 'Template Feedback'],
  ['Dashboard', 'Schedule'],
];
for (const [a, b] of renames) template = template.split(a).join(b);

// Remove the "Feedback" nav item from the coach group (done after the nav injections
// above, which anchor on this same button, so the other injected items stay intact).
template = template.replace(/<button onclick="\{\{ goEmail \}\}"[\s\S]*?<\/button>/, '');

// Full-bleed + mobile responsiveness. Targets the design's inline-styled containers
// via [style*=...] selectors so no markup classes are needed; !important beats inline styles.
const responsiveCss = `
  html, body { margin:0; padding:0; min-height:100%; background:linear-gradient(135deg,#F2E9E6 0%,#EDEBEA 46%,#E9EEF3 100%) fixed; font-family:'Manrope',system-ui,sans-serif; }
  .hamburger { display:none; }
  .menu-backdrop { display:none; }
  .pop-cards { display:none; }
  @media (max-width: 860px) {
    /* Class popup: swap the wide table for stacked participant cards (Hadir toggle always reachable) */
    .pop-table { display:none !important; }
    .pop-cards { display:block !important; }
    .pop-modal { padding:18px 15px !important; border-radius:16px !important; }
    /* Kalender Arena: tighter cells so more of the week is visible before scrolling */
    .arena-cal-inner { min-width:660px !important; }
    .arena-cal-cell { min-height:92px !important; }
  }
  @media (max-width: 560px) {
    .arena-cal-inner { min-width:560px !important; }
    .arena-cal-cell { min-height:82px !important; }
  }
  @media (max-width: 860px) {
    /* login: stack, hide the big hero, show only the form */
    [style*="grid-template-columns:1.05fr .95fr"] { grid-template-columns:minmax(0,1fr) !important; }
    [style*="linear-gradient(160deg,#0C0E12,#101319)"] { display:none !important; }
    [style*="justify-content:center;padding:40px"] { padding:22px !important; }
    /* app shell: stack sidebar above content */
    [style*="grid-template-columns:248px 1fr"] { grid-template-columns:minmax(0,1fr) !important; }
    /* sidebar becomes a left slide-in drawer, toggled by the hamburger */
    aside { position:fixed !important; left:0 !important; top:0 !important; height:100vh !important; width:270px !important; max-width:84vw !important; transform:translateX(-100%); transition:transform .22s ease; z-index:90 !important; overflow-y:auto !important; border-right:1px solid var(--border) !important; border-bottom:0 !important; box-shadow:0 20px 60px rgba(20,15,30,.18); }
    [data-menu="open"] aside { transform:translateX(0) !important; }
    [data-menu="open"] .menu-backdrop { display:block !important; position:fixed !important; inset:0 !important; background:rgba(20,15,30,.42); z-index:85; }
    .hamburger { display:flex !important; }
    main { height:auto !important; overflow:visible !important; }
    header { padding:12px 16px !important; flex-wrap:wrap !important; gap:10px !important; }
    header div:has(> span[style*="pulseDot"]) { display:none !important; }   /* hide sync pill */
    [style*="align-items:center;gap:14px"] { flex-wrap:wrap !important; }     /* topbar right group */
    [style*="overflow-y:auto;padding:28px"] { padding:16px !important; overflow-x:auto !important; }
    /* two-column blocks -> single column */
    [style*="grid-template-columns:1fr 1fr"],
    [style*="grid-template-columns:1.55fr 1fr"],
    [style*="grid-template-columns:1.4fr 1fr"] { grid-template-columns:minmax(0,1fr) !important; }
    /* four stat cards -> 2x2 */
    [style*="grid-template-columns:repeat(4,1fr)"] { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
    /* class-card action buttons stack full width */
    [style*="display:flex;gap:10px;margin-top:18px"] { flex-direction:column !important; }
    /* team schedule grid: keep width, scroll horizontally */
    [style*="70px repeat("] { min-width:520px; }
    [style*="border-radius:18px"]:has([style*="70px repeat("]) { overflow-x:auto !important; }
    /* per-class stats table (DATE/DAY/TIME/TYPE/PAX): keep columns, scroll horizontally */
    [style*="80px 90px 70px 1fr 90px"] { min-width:520px; }
    [style*="border-radius:18px"]:has([style*="80px 90px 70px 1fr 90px"]) { overflow-x:auto !important; }
  }
`;

// ============ THEME: 20FIT Design System v1.0 — "Glass Minimalist" ============
// Light glass surfaces on a warm->cool gradient, #E4002B primary, three-font system.
// 1) Palette tokens (var definitions on the app root div + :root)
const VARMAP = {
  '--bg:#08090B': '--bg:rgba(255,255,255,.55)', '--panel:#121419': '--panel:rgba(255,255,255,.62)', '--panel2:#171A21': '--panel2:rgba(255,255,255,.44)',
  '--raised:#1D212A': '--raised:rgba(255,255,255,.55)', '--border:#262B35': '--border:rgba(17,17,20,.10)', '--border2:#323845': '--border2:rgba(17,17,20,.15)',
  '--text:#F3F5F7': '--text:#1D1D1F', '--muted:#888F9C': '--muted:#6E6E73', '--muted2:#5B616E': '--muted2:#9A9A9E',
  '--volt:#D6FF3D': '--volt:#E4002B', '--volt-dim:rgba(214,255,61,.13)': '--volt-dim:rgba(228,0,43,.09)',
  '--green:#3ED598': '--green:#1C8A4B', '--amber:#FFB020': '--amber:#C77A00', '--red:#FF5247': '--red:#E4002B', '--cyan:#4DD4F2': '--cyan:#0068C9',
};
for (const [k, v] of Object.entries(VARMAP)) { template = template.split(k).join(v); baseCss = baseCss.split(k).join(v); }
// 2) Hardcoded colors: dark-text-on-accent -> white; volt-green tints/solids -> red; bright cyan -> progress blue
template = template.split('color:#08090B').join('color:#ffffff');
template = template.split('214,255,61').join('228,0,43');
template = template.split('#9BD11E').join('#B0001F');
template = template.split('#4DD4F2').join('#0068C9');
// 3) Fonts — three jobs: Barlow Condensed (display/label), JetBrains Mono (data/numbers), Manrope (body)
template = template.split("'Archivo'").join("'Barlow Condensed'"); baseCss = baseCss.split("'Archivo'").join("'Barlow Condensed'");
template = template.split("'Hanken Grotesk'").join("'Manrope'"); baseCss = baseCss.split("'Hanken Grotesk'").join("'Manrope'");
// (JetBrains Mono kept as-is for times/dates/numbers/email/search)
// 4) Bigger glass radii (design system: card 22px, small 14px)
template = template.split('border-radius:20px').join('border-radius:22px');
template = template.split('border-radius:18px').join('border-radius:22px');
template = template.split('border-radius:16px').join('border-radius:18px');
// 5) Glass surfaces + gradient page + red sidebar
const themeCss = `
  [style*="--volt:#E4002B"]{ background:linear-gradient(135deg,#F2E9E6 0%,#EDEBEA 46%,#E9EEF3 100%) !important; background-attachment:fixed !important; }
  /* Cards sit over a smooth gradient, so blurring behind each one costs GPU on every
     re-render for ~no visible gain. Keep the frosted look on the sidebar + header only;
     give inner cards a slightly more opaque fill + soft shadow so they still read as glass. */
  [style*="background:var(--panel)"]{ background:rgba(255,255,255,.72) !important; box-shadow:0 10px 30px rgba(35,25,45,.06), inset 0 1px 0 rgba(255,255,255,.55); }
  [style*="background:var(--panel2)"]{ background:rgba(255,255,255,.6) !important; }
  [style*="Barlow Condensed"]{ text-transform:uppercase; letter-spacing:.012em; }
  header { background:rgba(255,255,255,.55) !important; backdrop-filter:blur(20px) !important; -webkit-backdrop-filter:blur(20px) !important; }
  [style*="radial-gradient(900px 600px at 12% -8%"] { display:none !important; }
  /* Sidebar: dark black->gray surface with white text; active nav item = red pill */
  aside { background:linear-gradient(180deg,#171719 0%,#2b2b30 100%) !important; backdrop-filter:blur(22px) !important; -webkit-backdrop-filter:blur(22px) !important; color:#FFFFFF !important; border-right:1px solid rgba(255,255,255,.08) !important; box-shadow:0 10px 30px rgba(0,0,0,.28) !important;
    --bg:rgba(255,255,255,.06); --panel:rgba(255,255,255,.07); --panel2:rgba(255,255,255,.10); --raised:rgba(255,255,255,.08);
    --border:rgba(255,255,255,.10); --border2:rgba(255,255,255,.18);
    --text:#FFFFFF; --muted:rgba(255,255,255,.66); --muted2:rgba(255,255,255,.46); }
  aside [style*="background:var(--panel)"]{ background:rgba(255,255,255,.06) !important; backdrop-filter:none !important; box-shadow:none !important; }
  aside nav button { font-family:'Barlow Condensed',system-ui,sans-serif !important; text-transform:uppercase; letter-spacing:.03em; font-weight:700 !important; font-size:15px !important; }
  /* Active nav item stays red on hover so its white label doesn't vanish.
     During hover the JS handler normalizes #E4002B -> rgb(228, 0, 43), so match that. */
  aside nav button[style*="rgb(228, 0, 43)"]:hover,
  aside nav button[style*="#E4002B"]:hover { background:#C80028 !important; color:#FFFFFF !important; }
`;

const googleFonts = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

const out = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>20FIT Coach Workspace</title>
${googleFonts}
<style>
${baseCss}
${themeCss}
${responsiveCss}
</style>
</head>
<body>
<div id="app"></div>
<template id="tpl">${template}</template>
<script src="i18n.js?v=${assetVer}"></script>
<script src="sc-runtime.js?v=${assetVer}"></script>
<script src="app.js?v=${assetVer}"></script>
<script>
document.addEventListener('DOMContentLoaded', function(){
  window.__app = new Component();
  SC.mount(document.getElementById('tpl'), window.__app, document.getElementById('app'));
});
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'public', 'index.html'), out);
console.log('Wrote public/index.html (' + out.length + ' bytes)');
