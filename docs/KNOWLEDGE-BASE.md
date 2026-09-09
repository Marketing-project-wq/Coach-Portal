# Coach Portal — Knowledge Base

Catatan arsitektur & perubahan penting untuk **coach.20fit.id** (20FIT Coach Workspace).
Repo ini tidak memakai changelog terpisah, jadi setiap perubahan yang berdampak ke
arsitektur/deploy dicatat singkat di sini pada commit yang sama.

## Arsitektur singkat

- **Backend:** `server.js` — Node murni (built-in `http` saja, tanpa framework/dependency).
  Data lewat Supabase PostgREST (`sb()` / `sbAll()`); operasi atomik pakai Postgres RPC.
- **Frontend:** SPA satu file `public/app.js` (state machine `state.screen`) +
  `public/sc-runtime.js` (templating) + `public/i18n.js` (i18n keyed ID/EN).
  Navigasi **client-side** (ganti `state.screen`), bukan URL routing.
- **Build:** `build/template.html` + `build/build.js` → `public/index.html`
  (aset di-cache-bust `?v=<hash>`). Jalankan `node build/build.js` setiap ubah frontend/head.

## Deploy

- Deploy = **merge ke `main`** → Railway auto-deploy.
- Verifikasi lokal sebelum deploy: `node -c server.js`, `node --check public/app.js`,
  `node --check public/i18n.js`, `node build/build.js`.

## Analytics

- **GA4 (`G-70JD631GZC`) terpasang di coach.20fit.id, unify traffic dgn `*.20fit.id`.**
  Measurement ID sama dengan seluruh properti `*.20fit.id` (jangan buat property baru).
  - gtag base disuntik ke `<head>` lewat `build/build.js` (`gaSnippet`), dengan
    `cookie_domain: 'auto'` supaya cookie ke-set di level `.20fit.id` (satu user journey
    lintas subdomain). ID bisa di-override via env `GA_MEASUREMENT_ID`, fallback `G-70JD631GZC`.
  - Karena SPA (nav client-side), `page_view` untuk tiap ganti screen ditembak manual oleh
    `Component.gaPageView()` di `public/app.js` (dipanggil dari `go()` dan `applyRole()`).
    `page_path`/`page_title` **hanya** memuat kunci screen (mis. `/dash`, `/gymview`) —
    **tidak ada PII** (nama member/coach) yang dikirim ke GA.
  - server.js tidak menyetel header CSP, jadi script GA tidak terblokir. Jika kelak CSP
    diperketat, whitelist `https://www.googletagmanager.com` dan
    `https://www.google-analytics.com` / `https://region1.google-analytics.com`.
  - **Belum dilakukan (butuh akses eksternal, di luar repo):**
    - Set env `GA_MEASUREMENT_ID=G-70JD631GZC` di Railway service coach portal (opsional —
      sudah ada fallback hardcode, jadi tetap jalan tanpa env).
    - Verifikasi GA4 Realtime/DebugView + filter dimensi **Hostname** = `coach.20fit.id`.
