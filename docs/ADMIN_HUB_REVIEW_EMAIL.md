# Instruksi Admin Hub — Kirim Link "Rate Your Coach" via Email

Dokumen untuk **tim Admin Hub**. Tujuan: mengirim link review coach ke peserta
secara **otomatis lewat email**, **15 menit sebelum kelas berakhir**.

**Alur yang diinginkan:** email berisi link → peserta buka link → peserta
**cukup memasukkan nomor HP** yang dipakai saat booking → beri rating.
Tidak perlu kode booking.

Coach Workspace (project ini) menyediakan halaman review + identifikasi via
nomor HP. Pengiriman email dikerjakan di Admin Hub karena di sanalah data
kontak peserta & channel email berada.

---

## 1. Link yang dikirim di email

Cukup link **halaman review polos** (tanpa kode):

```
https://<COACH_WORKSPACE_URL>/review
```

- `<COACH_WORKSPACE_URL>` = domain Coach Workspace. Saat ini:
  `https://coach-portal-production-8e81.up.railway.app`
  (ganti bila nanti pakai domain sendiri).

Di halaman itu peserta memasukkan **nomor HP** yang mereka pakai saat booking.
Sistem otomatis mengarahkan ke **kelas terakhir yang sudah selesai & belum
direview** milik nomor tersebut. Halaman ini publik (tanpa login) & mobile-friendly.

> Nomor HP dikenali dalam berbagai format (`+62…`, `62…`, `08…`, `8…`).
> Satu booking hanya bisa diberi **1 review** (dijaga di sisi Coach Workspace).

---

## 2. Kapan dikirim — 15 menit sebelum kelas berakhir

Waktu berakhir kelas = **`arena_class_schedules.schedule_date` + `arena_class_schedules.end_time`**
(zona waktu **Asia/Jakarta / WIB**).

Kirim email pada: **`waktu_berakhir − 15 menit`**.

Jalankan scheduler/cron di Admin Hub (mis. tiap **5 menit**) yang mencari kelas
yang akan berakhir ~15 menit lagi, lalu kirim ke tiap peserta **confirmed** yang
punya email dan belum dikirimi.

---

## 3. Data penerima (query rekomendasi)

```sql
-- Zona waktu: Asia/Jakarta. Jalankan tiap ~5 menit.
-- Ambil peserta confirmed yang kelasnya berakhir ~15 menit lagi & belum dikirimi email.
select b.id            as booking_id,
       b.full_name,
       b.email,
       s.instructor    as coach,
       ct.name         as class_name
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

Catatan: link email tidak memerlukan `booking_code` — identifikasi peserta
terjadi di halaman review lewat nomor HP. Query di atas hanya perlu untuk tahu
**siapa yang dikirimi email** dan **kapan**.

---

## 4. Cegah kirim ganda (dedup)

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

(Kolom nullable — aman, tidak mengganggu sistem lain. Alternatif: tabel log
tersendiri bila tidak ingin menambah kolom.)

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
   (cuma 1 menit). Klik tombol di bawah, lalu masukkan
   <b>nomor HP yang kamu pakai saat booking</b>:</p>
<p>
  <a href="https://coach-portal-production-8e81.up.railway.app/review"
     style="display:inline-block;background:#E4002B;color:#ffffff;
            font-weight:700;text-decoration:none;padding:12px 22px;
            border-radius:12px;">Rate Your Coach</a>
</p>
<p style="color:#888;font-size:12px;">Atau buka link ini:
   https://coach-portal-production-8e81.up.railway.app/review</p>
<p>Sampai jumpa di kelas berikutnya!<br>20FIT Arena</p>
```

Ganti `{full_name}`, `{class_name}`, `{coach}` dengan nilai dari query bagian 3.

---

## 6. Ringkasan alur

1. Peserta booking kelas di Admin Hub (dengan `email` & `phone`).
2. Cron Admin Hub (tiap ~5 menit) menjalankan query bagian 3.
3. Untuk tiap penerima: kirim email (template bagian 5) berisi link
   `https://<COACH_WORKSPACE_URL>/review`, lalu set `review_email_sent_at = now()`.
4. Peserta klik link → halaman "Rate Your Coach" → **masukkan nomor HP** →
   sistem mengarahkan ke kelas terakhirnya → beri rating per kategori + keseluruhan.
5. Rating masuk ke Coach Workspace (`arena_class_reviews`) → tampil di menu
   **Review** coach & memengaruhi data.

Tidak ada API tambahan yang perlu dipanggil Admin Hub — cukup kirim link-nya.
