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
    .replace('{{ c.end }}</span>', '{{ c.end }} · {{ c.dateLabel }}</span>');
  template = template.slice(0, start) + block + template.slice(end);
})();
// Dashboard: show upcoming classes (not just today) + bind the greeting/stat numbers to real data
template = template.replace('JADWAL HARI INI', 'JADWAL MENDATANG');
template = template.replace('Senin, 30 Juni 2026 · 2 kelas hari ini', '{{ todayLabel }}');
template = template.replace('line-height:1.1;">18</div>', 'line-height:1.1;">{{ monthClasses }}</div>');
template = template.replace('line-height:1.1;">162</div>', 'line-height:1.1;">{{ monthPeserta }}</div>');
// Weekly calendar: replace the static range with prev/next navigation (browse to Dec, etc.)
const calNav = '<div style="display:flex;align-items:center;gap:8px;"><button onclick="{{ prevWeek }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:16px;line-height:1;padding:0;">‹</button><div style="font-size:13px;color:var(--muted);min-width:104px;text-align:center;">{{ weekRange }}</div><button onclick="{{ nextWeek }}" style="background:var(--raised);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:16px;line-height:1;padding:0;">›</button></div>';
template = template.replace(/(Kalender Minggu Ini<\/div>)<div style="font-size:13px;color:var\(--muted\);">[^<]*<\/div>/, '$1' + calNav);
template = template.replace('Kalender Minggu Ini', 'Kalender');
// Hide Head Coach / Admin role buttons unless the account allows them
template = template.replace(/(<button onclick="\{\{ setRoleHC \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ canHC }}">$1</sc-if>');
template = template.replace(/(<button onclick="\{\{ setRoleAdmin \}\}"[\s\S]*?<\/button>)/, '<sc-if value="{{ canAdmin }}">$1</sc-if>');

// ---- Rotation flow: rotation coach approves; head coach = notification only ----
// Inject a "Rotation" nav item into the COACH group (only in coach view)
const rotNav = '<sc-if value="{{ isCoachView }}"><button onclick="{{ goSubReview }}" style="display:flex;align-items:center;justify-content:space-between;gap:11px;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;background:{{ nav.subrev.bg }};color:{{ nav.subrev.fg }};font-family:\'Hanken Grotesk\';font-weight:600;font-size:14px;text-align:left;border-left:3px solid {{ nav.subrev.bar }};transition:background .15s;" style-hover="background:var(--panel2);"><span>Rotation</span><sc-if value="{{ hasIncoming }}"><span style="background:var(--amber);color:#08090B;font-size:11px;font-weight:800;padding:1px 7px;border-radius:100px;font-family:\'Archivo\';">{{ incomingCount }}</span></sc-if></button></sc-if>';
template = template.replace(/(<button onclick="\{\{ goEmail \}\}"[\s\S]*?<\/button>)/, '$1' + rotNav);
// Approve/Reject buttons only when the current user may decide (the rotation coach)
template = template.replace(/(<button onclick="\{\{ p\.approve \}\}"[\s\S]*?<\/button>)/g, '<sc-if value="{{ p.canDecide }}">$1</sc-if>');
template = template.replace(/(<button onclick="\{\{ p\.cancel \}\}"[\s\S]*?<\/button>)/g, '<sc-if value="{{ p.canDecide }}">$1</sc-if><sc-if value="{{ p.notify }}"><span style="color:var(--amber);font-size:12.5px;font-weight:700;">⏳ Menunggu {{ p.to }}</span></sc-if>');
// Role-aware header on the rotation screen + corrected submit note
template = template.replace('MENUNGGU TINDAKAN', '{{ rotHeader }}');
template = template.replace('sampai Head Coach menyetujui', 'sampai coach rotation menyetujui');

// ---- Label renames (longest/upper variants first) ----
const renames = [
  ['PENGGANTIAN', 'ROTATION'], ['Penggantian', 'Rotation'], ['penggantian', 'rotation'], ['PENGGANTI', 'ROTATION'], ['pengganti', 'rotation'],
  ['Jadwal Tim', 'Schedule'], ['Email Apresiasi', 'Feedback'],
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
    [style*="70px repeat(6,1fr)"] { min-width:520px; }
    [style*="border-radius:18px"]:has([style*="70px repeat(6,1fr)"]) { overflow-x:auto !important; }
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
