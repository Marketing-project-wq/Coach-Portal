# Instruksi Admin Hub — Kirim "Feedback Peserta" via Email

Dokumen untuk **tim Admin Hub**. Tujuan: mengirim **feedback yang ditulis coach
untuk tiap peserta** ke email masing-masing peserta.

**Bukan otomatis.** Coach menulis sendiri feedback untuk tiap peserta di Coach
Workspace (menu **Feedback**). Setiap feedback disimpan sebagai satu baris di
tabel `arena_coach_feedback` dengan `status = 'pending'`. Admin Hub tinggal
membaca baris pending, mengirim emailnya, lalu menandainya `sent`.

Seperti email lain (review, perubahan coach), **pengiriman email dikerjakan di
Admin Hub** karena di sanalah data kontak & channel email berada.

---

## 0. DDL tabel (sudah dibuat di production)

```sql
create table if not exists public.arena_coach_feedback (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid,
  booking_id uuid,
  coach text,
  participant_name text,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
```

## 1. Tabel sumber — `arena_coach_feedback`

| kolom | arti |
|-------|------|
| `id` | id feedback |
| `schedule_id` | kelas terkait |
| `booking_id` | booking peserta (untuk cari email) |
| `coach` | coach yang menulis |
| `participant_name` | nama peserta (snapshot) |
| `message` | isi feedback yang ditulis coach |
| `status` | `pending` = belum dikirim, `sent` = sudah |
| `created_at` | kapan ditulis |
| `sent_at` | kapan dikirim (diisi Admin Hub) |

---

## 2. Data penerima (query rekomendasi)

```sql
-- Jalankan tiap ~2–5 menit. Ambil feedback yang belum dikirim + email pesertanya.
select f.id           as feedback_id,
       f.message,
       f.coach,
       coalesce(f.participant_name, b.full_name) as full_name,
       b.email,
       coalesce(f.participant_name, b.full_name) as name,
       ct.name        as class_name,
       s.schedule_date
from arena_coach_feedback f
join arena_class_bookings b     on b.id = f.booking_id
left join arena_class_schedules s on s.id = f.schedule_id
left join arena_class_types ct   on ct.id = s.class_type_id
where f.status = 'pending'
  and b.email is not null and b.email <> '';
```

Setelah email terkirim:

```sql
update public.arena_coach_feedback
   set status = 'sent', sent_at = now()
 where id = :feedback_id;
```

---

## 3. Template email (Bahasa Indonesia)

**Subject:**
```
Feedback dari Coach {coach} buat kamu 💪
```

**Body (HTML):**
```html
<p>Hai {full_name},</p>
<p>Coach <b>{coach}</b> menuliskan feedback khusus buat kamu
   dari kelas <b>{class_name}</b> di 20FIT Arena:</p>
<blockquote style="border-left:3px solid #E4002B;margin:12px 0;padding:6px 14px;
                   color:#1d1d1f;background:#faf1f0;border-radius:6px;">
  {message}
</blockquote>
<p>Terus semangat & sampai jumpa di kelas berikutnya!<br>20FIT Arena</p>
```

Ganti `{...}` dengan nilai dari query bagian 2. `{message}` = isi feedback dari coach.

---

## 4. Ringkasan alur

1. Coach buka menu **Feedback** → pilih kelas → tulis feedback untuk tiap peserta → **Kirim Feedback**.
2. Tiap feedback tersimpan di `arena_coach_feedback` dengan `status = 'pending'`.
3. Cron Admin Hub (tiap ~2–5 menit) menjalankan query bagian 2.
4. Untuk tiap baris: kirim email (template bagian 3), lalu set `status = 'sent'`.
5. Peserta menerima feedback personal dari coach-nya lewat email.

Coach **tidak** melihat email/nomor peserta (privasi tetap terjaga) — Admin Hub
yang memetakan `booking_id` → email saat mengirim.
