# Instruksi Admin Hub — Kirim Link "Rate Your Coach" via Email

Dokumen untuk **tim Admin Hub**. Tujuan: mengirim link review coach ke peserta
secara **otomatis lewat email**, **15 menit sebelum kelas berakhir**.

Coach Workspace (project ini) **hanya menyediakan link & halaman review**.
Pengiriman email dikerjakan di Admin Hub karena di sanalah data kontak peserta
dan channel pengiriman berada.

---

## 1. Format link review

```
https://<COACH_WORKSPACE_URL>/review?code=<BOOKING_CODE>
```

- `<COACH_WORKSPACE_URL>` = domain Coach Workspace. Saat ini:
  `https://coach-portal-production-8e81.up.railway.app`
  (ganti bila nanti pakai domain sendiri).
- `<BOOKING_CODE>` = kolom **`arena_class_bookings.booking_code`** (format `CL-YYYYMMDD-NNNN`).

Contoh:

```
https://coach-portal-production-8e81.up.railway.app/review?code=CL-20260701-0001
```

Saat peserta membuka link ini, kode booking **otomatis terisi** dan form review
langsung terbuka (peserta tidak perlu mengetik kode). Halaman ini **publik**
(tanpa login) dan sudah mobile-friendly.

> Catatan: satu `booking_code` hanya bisa memberi **1 review** (dijaga di sisi
> Coach Workspace — kalau sudah pernah review, halaman menampilkan pesan
> "sudah pernah review"). Jadi Admin Hub aman meski link terkirim ulang, tapi
> tetap disarankan mencegah kirim ganda (lihat bagian 4).

---

## 2. Kapan dikirim — 15 menit sebelum kelas berakhir

Waktu berakhir kelas = **`arena_class_schedules.schedule_date` + `arena_class_schedules.end_time`**
(zona waktu **Asia/Jakarta / WIB**).

Kirim email pada: **`waktu_berakhir − 15 menit`**.

Jalankan scheduler/cron di Admin Hub (mis. tiap **5 menit**) yang mencari kelas
yang akan berakhir ~15 menit lagi, lalu kirim ke tiap peserta **confirmed** yang
belum dikirimi.

---

## 3. Data yang dibutuhkan (query rekomendasi)

Jalankan query ini tiap beberapa menit untuk mendapat daftar penerima:

```sql
-- Zona waktu: Asia/Jakarta. Jalankan tiap ~5 menit.
-- Ambil booking confirmed yang kelasnya berakhir ~15 menit lagi & belum dikirimi email.
select b.id            as booking_id,
       b.booking_code,
       b.full_name,
       b.email,
       s.instructor    as coach,
       ct.name         as class_name,
       s.schedule_date,
       s.end_time
from arena_class_bookings b
join arena_class_schedules s  on s.id = b.schedule_id
left join arena_class_types ct on ct.id = s.class_type_id
where b.status = 'confirmed'
  and b.email is not null and b.email <> ''
  and s.is_cancelled = false
  and b.review_email_sent_at is null                       -- dedup (lihat bagian 4)
  and ((s.schedule_date + s.end_time) at time zone 'Asia/Jakarta')
        between now() + interval '13 minutes'
            and now() + interval '17 minutes';              -- jendela ~15 menit sebelum berakhir
```

Jendela 13–17 menit memberi toleransi bila cron telat sedikit. Kolom
`review_email_sent_at` (bagian 4) memastikan tiap peserta hanya dikirimi sekali.

---

## 4. Cegah kirim ganda (dedup)

Tambahkan penanda "sudah dikirim" pada tabel booking:

```sql
alter table public.arena_class_bookings
  add column if not exists review_email_sent_at timestamptz;
```

Setelah email terkirim untuk sebuah booking:

```sql
update public.arena_class_bookings
   set review_email_sent_at = now()
 where id = :booking_id;
```

(Kolom nullable — aman, tidak mengganggu sistem lain. Alternatif: pakai tabel
log tersendiri bila tidak ingin menambah kolom.)

---

## 5. Template email (Bahasa Indonesia)

**Subject:**
```
Gimana kelas {class_name} tadi? Kasih rating coach kamu ⭐
```

**Body (HTML):**
```html
<p>Hai {full_name},</p>
<p>Terima kasih sudah ikut kelas <b>{class_name}</b> bareng
   <b>Coach {coach}</b> di 20FIT Arena hari ini! 💪</p>
<p>Bantu coach kamu jadi lebih baik — kasih rating &amp; masukan singkat
   (cuma 1 menit):</p>
<p>
  <a href="https://coach-portal-production-8e81.up.railway.app/review?code={booking_code}"
     style="display:inline-block;background:#D6FF3D;color:#08090B;
            font-weight:700;text-decoration:none;padding:12px 22px;
            border-radius:10px;">Rate Your Coach</a>
</p>
<p style="color:#888;font-size:12px;">Atau buka link ini:
   https://coach-portal-production-8e81.up.railway.app/review?code={booking_code}</p>
<p>Sampai jumpa di kelas berikutnya!<br>20FIT Arena</p>
```

Ganti `{full_name}`, `{class_name}`, `{coach}`, `{booking_code}` dengan nilai
dari query di bagian 3.

---

## 6. Ringkasan alur

1. Peserta booking kelas di Admin Hub → tercatat di `arena_class_bookings`
   (dengan `booking_code` & `email`).
2. Cron Admin Hub (tiap ~5 menit) menjalankan query bagian 3.
3. Untuk tiap baris hasil: kirim email (template bagian 5) berisi link
   `/review?code={booking_code}`, lalu set `review_email_sent_at = now()`.
4. Peserta klik link → form "Rate Your Coach" terbuka otomatis → kirim rating.
5. Rating masuk ke Coach Workspace (`arena_class_reviews`) → tampil di menu
   **Review** coach & memengaruhi data, sesuai konfigurasi Coach Workspace.

Tidak ada API tambahan yang perlu dipanggil Admin Hub — cukup kirim link-nya.
