# 20FIT Arena — Coach Portal

Portal untuk coach melihat **jadwal kelas** dan **peserta yang terdaftar**, membaca
langsung dari database Supabase Arena (bersama dengan Admin HUB Arena).

- **Backend:** Node.js tanpa dependency eksternal (`server.js`) — hanya butuh Node ≥ 18.
- **Frontend:** `public/index.html` (login + dashboard).
- **Prototipe desain asli:** `design-prototype/` (sebagai referensi, tidak dipakai runtime).

## Environment variables (wajib di-set di Railway)

| Variable | Wajib | Keterangan |
|----------|:-----:|------------|
| `SUPABASE_URL` | ⚠️ | URL project, contoh `https://cpvzwqptzcxnwzfzgrmt.supabase.co`. Sudah ada default di kode. |
| `SUPABASE_SERVICE_KEY` | ✅ | **Service role key** Supabase (rahasia, server-side). Ambil di: Supabase Dashboard → Project Settings → API → `service_role`. |
| `SESSION_SECRET` | ✅ | String acak panjang untuk menandatangani token login. Contoh generate: `openssl rand -hex 32`. |
| `PORT` | — | Diisi otomatis oleh Railway. |

> ⚠️ Backend memakai **service key** (mem-bypass RLS) karena tabel Arena punya RLS aktif.
> Service key hanya dipakai di server dan **tidak pernah** dikirim ke browser.
> Jangan commit key ini ke repo.

## Menjalankan lokal

```bash
export SUPABASE_URL="https://cpvzwqptzcxnwzfzgrmt.supabase.co"
export SUPABASE_SERVICE_KEY="<service_role key>"
export SESSION_SECRET="$(openssl rand -hex 32)"
npm start
# buka http://localhost:3000
```

## API

| Method | Endpoint | Auth | Fungsi |
|--------|----------|:----:|--------|
| POST | `/api/auth/login` | — | `{username, password}` → `{token, coach}` |
| GET | `/api/coach/me` | ✅ | Info coach dari token |
| GET | `/api/coach/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD` | ✅ | Jadwal coach + jumlah confirmed/pending |
| GET | `/api/coach/schedules/:id/participants` | ✅ | Daftar peserta satu kelas |
| POST | `/api/coach/change-password` | ✅ | `{current_password, new_password}` |
| GET | `/healthz` | — | Health check |

Auth memakai token HMAC (berlaku 12 jam) dikirim via header `Authorization: Bearer <token>`.

## Login coach

Akun coach disimpan di tabel `arena_coach_users` (username + password ter-hash scrypt).
Field `coach_name` **harus sama persis** dengan kolom `instructor` di
`arena_class_schedules` (filter berbasis teks). Coach hanya bisa melihat kelas & peserta
miliknya sendiri.

Menambah/menonaktifkan coach: ubah baris di tabel `arena_coach_users`
(`is_active = false` untuk menonaktifkan). Reset password bisa dilakukan lewat backend
(hash ulang) atau minta developer.
