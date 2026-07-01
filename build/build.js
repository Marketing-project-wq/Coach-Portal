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
  ['PENGGANTIAN', 'ROTATION'], ['Penggantian', 'Rotation'], ['PENGGANTI', 'ROTATION'], ['pengganti', 'rotation'],
  ['Jadwal Tim', 'Schedule'], ['Email Apresiasi', 'Feedback'],
];
for (const [a, b] of renames) template = template.split(a).join(b);

const googleFonts = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

const out = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>20FIT Arena · Coach Portal</title>
${googleFonts}
<style>
${baseCss}
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
