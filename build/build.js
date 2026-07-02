// Regenerate ../public/index.html from the recovered DC design template.
// Run: node build/build.js   (from repo root)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const design = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

const xdcStart = design.indexOf('<x-dc>');
const xdcEnd = design.indexOf('</x-dc>');
let xdcInner = design.slice(xdcStart + '<x-dc>'.length, xdcEnd);
const helmet = (xdcInner.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
let template = xdcInner.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
const baseCss = (helmet.replace(/@font-face\s*\{[\s\S]*?\}/g, '').match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

// ---- wiring edits (before renames so we can target original ids) ----
// Login inputs get ids (accept username or email)
template = template.replace('value="rheza@20fit.id"', 'id="loginEmail" placeholder="username atau email" value=""');
template = template.replace('value="rheza456" type="password"', 'id="loginPassword" type="password" placeholder="password" value=""');
// Reset-modal input flagged so confirmReset can read it
template = template.replace('value="{{ resetPwd }}"', 'data-reset value="{{ resetPwd }}"');
// Login card copy: neutral heading + rename the first field label (Email -> Name)
template = template.replace('Masuk sebagai Coach', 'Masuk ke Akun Anda');
template = template.replace('>Email</label>', '>Name</label>');
// Remove the promo hero panel; center the login form as a single column
template = template.replace('background:linear-gradient(160deg,#0C0E12,#101319);">', 'background:linear-gradient(160deg,#0C0E12,#101319);display:none;">');
template = template.replace('grid-template-columns:1.05fr .95fr', 'grid-template-columns:1fr');
// Rebrand "Coach Portal" -> Coach Workspace (sidebar); submit label reflects the rotation-coach flow
template = template.replace('>COACH PORTAL</div>', '>Coach Workspace</div>');
template = template.replace('Ajukan ke Head Coach', 'Kirim Permintaan Rotation');
// coachToday card: Detail/Absen buttons become per-item (scoped to that loop)
(() => {
  const start = template.indexOf('<sc-for list="{{ coachToday }}"');
  if (start < 0) return;
  const end = template.indexOf('</sc-for>', start) + '</sc-for>'.length;
  const block = template.slice(start, end)
    .replace(/\{\{ openClass \}\}/g, '{{ c.openClass }}')
    .replace(/\{\{ openAbsen \}\}/g, '{{ c.openAbsen }}')
    .replace('{{ c.end }}</span>', '{{ c.end }} · {{ c.dateLabel }}</span>')
    // jam & tanggal kelas: samakan ukuran (sedang, 16px)
    .replace('font-weight:700;font-size:24px;color:var(--text);">{{ c.time }}', 'font-weight:700;font-size:16px;color:var(--text);">{{ c.time }}')
    .replace('font-size:13px;color:var(--muted);">{{ c.end }}', 'font-size:16px;color:var(--muted);">{{ c.end }}');
  template = template.slice(0, start) + block + template.slice(end);
})();
// Dashboard: show upcoming classes (not just today) + bind the greeting/stat numbers to real data
// Schedule heading becomes a date-range filter (dari–sampai) + dynamic label
const jadwalHead = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:6px 0 14px;"><div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--muted);">JADWAL {{ jadwalLabel }}</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><input type="date" id="rangeFrom" style="background:var(--panel);border:1px solid var(--border2);color:var(--text);border-radius:9px;padding:7px 10px;font-size:12.5px;font-family:\'Hanken Grotesk\';outline:0;"><span style="color:var(--muted2);font-size:12px;">s/d</span><input type="date" id="rangeTo" style="background:var(--panel);border:1px solid var(--border2);color:var(--text);border-radius:9px;padding:7px 10px;font-size:12.5px;font-family:\'Hanken Grotesk\';outline:0;"><button onclick="{{ applyRange }}" style="background:var(--volt);border:0;color:#08090B;border-radius:9px;padding:8px 14px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:\'Archivo\';">Terapkan</button><button onclick="{{ resetRange }}" style="background:transparent;border:1px solid var(--border2);color:var(--muted);border-radius:9px;padding:8px 12px;font-weight:700;font-size:12.5px;cursor:pointer;">Reset</button></div></div>';
template = template.replace('<div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--muted);margin:6px 0 14px;">JADWAL HARI INI</div>', jadwalHead);
template = template.replace('Senin, 30 Juni 2026 · 2 kelas hari ini', '{{ todayLabel }}');
template = template.replace('line-height:1.1;">18</div>', 'line-height:1.1;">{{ monthClasses }}</div>');
template = template.replace('line-height:1.1;">162</div>', 'line-height:1.1;">{{ monthPeserta }}</div>');
// Remove the "Kalender" widget from the dashboard; Riwayat takes the full width.
template = template.replace(/<div style="background:var\(--panel\);border:1px solid var\(--border\);border-radius:18px;padding:20px;">\s*<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div[^>]*>Kalender Minggu Ini[\s\S]*?<\/sc-for>\s*<\/div>\s*<\/div>/, '');
template = template.replace('grid-template-columns:1.4fr 1fr;gap:16px;margin-top:24px;', 'grid-template-columns:1fr;gap:16px;margin-top:24px;');
// "Monitoring Kelas per Bulan" is its own screen (separate nav item), not on the dashboard.
// Summary stat cards (current-month peserta/kelas + full-year peserta) sit above the chart.
const monthlyStats = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:16px;">'
  + '<div style="background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Peserta Bulan Ini</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;color:var(--volt);">{{ mPesertaBulan }}</div></div>'
  + '<div style="background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Kelas Bulan Ini</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;">{{ mKelasBulan }}</div></div>'
  + '<div style="background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Total Peserta {{ monthlyYear }}</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;color:#4DD4F2;">{{ mPesertaTahun }}</div></div>'
  + '</div>';
const monthlyPanel = '<div style="background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:20px;"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;"><div style="font-weight:800;font-family:\'Archivo\';font-size:16px;">Monitoring Kelas per Bulan · {{ monthlyYear }}</div><div style="font-size:11px;color:var(--muted);display:flex;gap:14px;align-items:center;"><span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--text);"></span>Kelas</span><span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4DD4F2;"></span>Peserta</span></div></div><div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;align-items:end;"><sc-for list="{{ monthly }}" as="m"><div style="text-align:center;"><div style="font-size:13px;font-weight:800;font-family:\'Archivo\';margin-bottom:6px;color:{{ m.col }};">{{ m.count }}</div><div style="height:{{ m.h }}px;min-height:4px;background:{{ m.bar }};border-radius:5px;"></div><div style="font-size:10px;color:var(--muted);margin-top:6px;">{{ m.month }}</div><div style="font-size:11px;font-weight:800;font-family:\'Archivo\';color:#4DD4F2;margin-top:2px;">{{ m.peserta }}</div></div></sc-for></div></div>';
const monthlyScreen = '<sc-if value="{{ s.monthly }}"><div style="max-width:980px;margin:0 auto;"><div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:4px;">Monitoring Kelas</div><div style="color:var(--muted);font-size:13.5px;margin-bottom:20px;">Jumlah kelas & total peserta yang Anda ampu setiap bulan sepanjang tahun.</div>' + monthlyStats + monthlyPanel + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', monthlyScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Inject the "Review Peserta" screen (sibling screen in the scroll area)
const reviewsScreen = '<sc-if value="{{ s.reviews }}"><div style="max-width:820px;margin:0 auto;"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;"><div><div style="font-family:\'Archivo\';font-weight:800;font-size:22px;">Review Peserta</div><div style="color:var(--muted);font-size:13.5px;margin-top:3px;">Ulasan peserta untuk kelas yang mereka ikuti.</div></div><div style="display:flex;gap:12px;"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 18px;text-align:center;min-width:96px;"><div style="font-family:\'Archivo\';font-weight:900;font-size:26px;color:var(--amber);">{{ reviewAvg }}</div><div style="font-size:11px;color:var(--muted);">Rata-rata &#9733;</div></div><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 18px;text-align:center;min-width:96px;"><div style="font-family:\'Archivo\';font-weight:900;font-size:26px;">{{ reviewCount }}</div><div style="font-size:11px;color:var(--muted);">Total review</div></div></div></div><sc-if value="{{ hasReviewCats }}"><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"><sc-for list="{{ reviewCats }}" as="rc"><span style="background:var(--panel);border:1px solid var(--border);border-radius:100px;padding:7px 13px;font-size:12.5px;"><span style="color:var(--muted);">{{ rc.label }}</span> <span style="color:var(--amber);font-weight:700;">{{ rc.avg }}&#9733;</span></span></sc-for></div></sc-if><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div style="font-size:13px;color:var(--muted);">Link review untuk peserta:<br><span style="color:var(--volt);font-family:\'JetBrains Mono\';font-size:13px;">{{ reviewLink }}</span></div><button onclick="{{ copyReviewLink }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:9px;padding:9px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Salin Link</button></div><sc-for list="{{ reviews }}" as="rv"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:12px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><div style="font-weight:700;font-size:14px;">{{ rv.name }} <span style="color:var(--muted2);font-weight:400;font-size:12px;">&#183; {{ rv.cls }}{{ rv.coachSuffix }}</span></div><div style="color:var(--amber);font-size:15px;letter-spacing:2px;">{{ rv.stars }}</div></div><sc-if value="{{ rv.hasComment }}"><div style="color:var(--text);font-size:13.5px;margin-top:8px;">{{ rv.comment }}</div></sc-if><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;"><sc-for list="{{ rv.tags }}" as="t"><span style="background:var(--volt-dim);color:var(--volt);border-radius:100px;padding:3px 11px;font-size:11.5px;font-weight:700;">{{ t }}</span></sc-for></div><div style="color:var(--muted2);font-size:11.5px;margin-top:9px;">{{ rv.date }}</div></div></sc-for><sc-if value="{{ noReviews }}"><div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--muted);">Belum ada review. Bagikan link di atas ke peserta Anda &#10024;</div></sc-if></div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', reviewsScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Inject the "Peserta Kelas" screen — attendance frequency + last-visit recency per participant
const cardBox = 'background:var(--panel);border:1px solid var(--border);border-radius:16px;';
const membersScreen = '<sc-if value="{{ s.members }}"><div style="max-width:900px;margin:0 auto;">'
  + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:4px;">Peserta Kelas Saya</div>'
  + '<div style="color:var(--muted);font-size:13.5px;margin-bottom:20px;">Rekap peserta yang pernah hadir di kelas Anda — berapa kali datang &amp; kapan terakhir datang.</div>'
  + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px;">'
  + '<div style="' + cardBox + 'padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Total Peserta</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;">{{ membersTotal }}</div></div>'
  + '<div style="' + cardBox + 'padding:16px 18px;"><div style="font-size:12px;color:var(--muted);">Aktif 30 Hari Terakhir</div><div style="font-family:\'Archivo\';font-weight:900;font-size:28px;color:var(--green);">{{ membersActive }}</div></div>'
  + '</div>'
  + '<sc-if value="{{ hasMembers }}"><div style="' + cardBox + 'overflow:hidden;">'
  + '<sc-for list="{{ members }}" as="m"><div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);">'
  + '<div style="width:38px;height:38px;border-radius:50%;background:{{ m.avBg }};color:{{ m.avFg }};display:flex;align-items:center;justify-content:center;font-family:\'Archivo\';font-weight:800;font-size:13px;flex-shrink:0;">{{ m.initials }}</div>'
  + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:14.5px;">{{ m.name }}</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Terakhir: {{ m.lastVisit }} &#183; <span style="color:{{ m.lastCol }};font-weight:700;">{{ m.lastLabel }}</span></div></div>'
  + '<div style="text-align:right;flex-shrink:0;"><div style="font-family:\'Archivo\';font-weight:800;font-size:20px;">{{ m.visits }}</div><div style="font-size:11px;color:var(--muted);">kali datang</div></div>'
  + '</div></sc-for></div></sc-if>'
  + '<sc-if value="{{ noMembers }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">Belum ada peserta yang tercatat hadir di kelas Anda.</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', membersScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Inject the "Leaderboard Coach" screen — ranked by average participant rating
const boardScreen = '<sc-if value="{{ s.leaderboard }}"><div style="max-width:760px;margin:0 auto;">'
  + '<div style="font-family:\'Archivo\';font-weight:800;font-size:22px;margin-bottom:4px;">Leaderboard Coach</div>'
  + '<div style="color:var(--muted);font-size:13.5px;margin-bottom:20px;">Peringkat coach berdasarkan rating dari peserta.</div>'
  + '<sc-if value="{{ hasBoard }}"><div style="' + cardBox + 'overflow:hidden;">'
  + '<sc-for list="{{ leaderboard }}" as="l"><div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);background:{{ l.rowBg }};">'
  + '<div style="width:30px;text-align:center;font-family:\'Archivo\';font-weight:900;font-size:16px;color:{{ l.rankCol }};">{{ l.medal }}</div>'
  + '<div style="width:38px;height:38px;border-radius:50%;background:{{ l.avBg }};color:{{ l.avFg }};display:flex;align-items:center;justify-content:center;font-family:\'Archivo\';font-weight:800;font-size:13px;flex-shrink:0;">{{ l.initials }}</div>'
  + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:14.5px;">{{ l.name }}{{ l.meLabel }}</div><div style="font-size:12px;color:var(--muted);margin-top:1px;">{{ l.count }} review</div></div>'
  + '<div style="text-align:right;flex-shrink:0;"><div style="color:var(--amber);font-size:13px;letter-spacing:1px;">{{ l.stars }}</div><div style="font-family:\'Archivo\';font-weight:800;font-size:16px;margin-top:1px;">{{ l.avg }}</div></div>'
  + '</div></sc-for></div></sc-if>'
  + '<sc-if value="{{ noBoard }}"><div style="' + cardBox + 'padding:44px 24px;text-align:center;color:var(--muted);">Belum ada rating dari peserta. Bagikan link review ke peserta Anda &#10024;</div></sc-if>'
  + '</div></sc-if>';
template = template.replace('<!-- ===== CLASS DETAIL ===== -->', boardScreen + '\n\n        <!-- ===== CLASS DETAIL ===== -->');
// Hide Head Coach / Admin role buttons unless the account allows them
template = template.replace(/(<button onclick="\{\{ setRoleHC \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ canHC }}">$1</sc-if>');
template = template.replace(/(<button onclick="\{\{ setRoleAdmin \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ canAdmin }}">$1</sc-if>');

// ---- Rotation flow: rotation coach approves; head coach = notification only ----
// Inject a "Rotation" nav item into the COACH group (only in coach view)
const rotNav = '<sc-if value="{{ showCoachNav }}"><button onclick="{{ goSubReview }}" style="display:flex;align-items:center;justify-content:space-between;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.subrev.bg }};color:{{ nav.subrev.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.subrev.bar }};transition:background .15s;" style-hover="background:var(--panel2);"><span>Rotation</span><sc-if value="{{ hasIncoming }}"><span style="background:var(--amber);color:#08090B;font-size:11px;font-weight:800;padding:1px 7px;border-radius:100px;font-family:\'Archivo\';">{{ incomingCount }}</span></sc-if></button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goEmail \}\}"[\s\S]*?<\/button>)/, '$1' + rotNav);
// "Review" nav (peserta review) — always visible; screen is role-aware (coach=own, HC=all)
const reviewNav = '<button onclick="{{ goReviews }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.reviews.bg }};color:{{ nav.reviews.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.reviews.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Review</button>';
template = template.replace(/(<button onclick="\{\{ goEmail \}\}"[\s\S]*?<\/button>)/, '$1' + reviewNav);
// "Monitoring" nav (coach-only) — monthly class count moved off the dashboard into its own screen
const monthlyNav = '<sc-if value="{{ showCoachNav }}"><button onclick="{{ goMonthly }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.monthly.bg }};color:{{ nav.monthly.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.monthly.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Monitoring</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goReviews \}\}"[\s\S]*?<\/button>)/, '$1' + monthlyNav);
// "Peserta" nav (coach-only + admin) — per-coach member attendance frequency & recency
const membersNav = '<sc-if value="{{ showCoachNav }}"><button onclick="{{ goMembers }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.members.bg }};color:{{ nav.members.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.members.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Peserta</button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goReviews \}\}"[\s\S]*?<\/button>)/, '$1' + membersNav);
// "Leaderboard" nav — visible to everyone; ranks coaches by participant rating
const leaderboardNav = '<button onclick="{{ goLeaderboard }}" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.leaderboard.bg }};color:{{ nav.leaderboard.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.leaderboard.bar }};transition:background .15s;" style-hover="background:var(--panel2);">Leaderboard</button>';
template = template.replace(/(<button onclick="\{\{ goReviews \}\}"[\s\S]*?<\/button>)/, '$1' + leaderboardNav);
// Approve/Reject buttons only when the current user may decide (the rotation coach)
template = template.replace(/(<button onclick="\{\{ p\.approve \}\}"[\s\S]*?<\/button>)/g, '<sc-if value="{{ p.canDecide }}">$1</sc-if>');
template = template.replace(/(<button onclick="\{\{ p\.cancel \}\}"[\s\S]*?<\/button>)/g, '<sc-if value="{{ p.canDecide }}">$1</sc-if><sc-if value="{{ p.notify }}"><span style="color:var(--amber);font-size:12.5px;font-weight:700;">⏳ Menunggu {{ p.to }}</span></sc-if>');
// Role-aware header on the rotation screen + corrected submit note
template = template.replace('MENUNGGU TINDAKAN', '{{ rotHeader }}');
template = template.replace('sampai Head Coach menyetujui', 'sampai coach rotation menyetujui');

// ---- Label renames (longest/upper variants first) ----
const renames = [
  ['PENGGANTIAN', 'ROTATION'], ['Penggantian', 'Rotation'], ['penggantian', 'rotation'], ['PENGGANTI', 'ROTATION'], ['pengganti', 'rotation'],
  ['Jadwal Tim', 'Schedule'], ['Email Apresiasi', 'Feedback'], ['Template Email', 'Template Feedback'],
];
for (const [a, b] of renames) template = template.split(a).join(b);

// Full-bleed + mobile responsiveness. Targets the design's inline-styled containers
// via [style*=...] selectors so no markup classes are needed; !important beats inline styles.
const responsiveCss = `
  html, body { margin:0; padding:0; background:#08090B; }
  @media (max-width: 860px) {
    /* login: stack, hide the big hero, show only the form */
    [style*="grid-template-columns:1.05fr .95fr"] { grid-template-columns:minmax(0,1fr) !important; }
    [style*="linear-gradient(160deg,#0C0E12,#101319)"] { display:none !important; }
    [style*="justify-content:center;padding:40px"] { padding:22px !important; }
    /* app shell: stack sidebar above content */
    [style*="grid-template-columns:248px 1fr"] { grid-template-columns:minmax(0,1fr) !important; }
    aside { position:static !important; height:auto !important; max-width:100vw !important; overflow:hidden !important; border-right:0 !important; border-bottom:1px solid var(--border) !important; }
    aside nav { flex-direction:row !important; overflow-x:auto !important; overflow-y:hidden !important; gap:6px !important; padding:8px 10px !important; }
    aside nav > div { display:none !important; }
    aside nav button { white-space:nowrap !important; flex-shrink:0 !important; border-left-width:0 !important; padding:8px 12px !important; }
    main { height:auto !important; overflow:visible !important; }
    header { padding:12px 16px !important; flex-wrap:wrap !important; gap:10px !important; }
    header div:has(> span[style*="pulseDot"]) { display:none !important; }   /* hide 'Sinkron' pill */
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
    /* per-class stats table (TGL/HARI/JAM/JENIS/PESERTA): keep columns, scroll horizontally */
    [style*="80px 90px 70px 1fr 90px"] { min-width:520px; }
    [style*="border-radius:18px"]:has([style*="80px 90px 70px 1fr 90px"]) { overflow-x:auto !important; }
  }
`;

const googleFonts = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

const out = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>20FIT Coach Workspace</title>
${googleFonts}
<style>
${baseCss}
${responsiveCss}
</style>
</head>
<body>
<div id="app"></div>
<template id="tpl">${template}</template>
<script src="sc-runtime.js"></script>
<script src="app.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function(){
  window.__app = new Component();
  SC.mount(document.getElementById('tpl'), window.__app, document.getElementById('app'));
});
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'public', 'index.html'), out);
console.log('Wrote public/index.html (' + out.length + ' bytes)');
