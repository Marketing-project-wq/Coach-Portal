# Instruksi Admin Hub — Email Notifikasi "Perubahan Coach" ke Peserta

Dokumen untuk **tim Admin Hub**. Tujuan: mengirim email otomatis ke peserta
**ketika coach sebuah kelas berganti** (mis. lewat fitur Rotation di Coach
Workspace, saat coach pengganti menyetujui permintaan).

Sama seperti email "Rate Your Coach", **pengiriman email dikerjakan di Admin
Hub** (karena di sanalah data kontak & channel email berada). Coach Workspace
sudah **mencatat setiap perubahan coach** — Admin Hub tinggal membaca catatan
itu lalu mengirim email ke peserta kelas yang bersangkutan.

---

## 1. Kapan sebuah perubahan coach terjadi

Setiap kali sebuah permintaan rotation **disetujui**, Coach Workspace:

1. Mengganti `arena_class_schedules.instructor` menjadi coach yang baru, dan
2. Menandai barisnya di `arena_coach_substitutions` dengan
   `status = 'approved'` + `decided_at` terisi.

Baris `arena_coach_substitutions` inilah **sumber kebenaran** perubahan coach:

| kolom | arti |
|-------|------|
| `schedule_id` | kelas yang coach-nya berganti |
| `from_coach` | coach lama |
| `to_coach` | coach baru (yang sekarang mengajar) |
| `class_label`, `time_label` | label kelas & jam (untuk isi email) |
| `status` | `approved` = perubahan resmi terjadi |
| `decided_at` | kapan perubahan disetujui |

---

## 2. Data penerima (query rekomendasi)

Ambil peserta **confirmed** yang punya email, untuk kelas yang coach-nya baru
saja berganti dan **belum dikirimi** notifikasi.

```sql
-- Zona waktu: Asia/Jakarta. Jalankan tiap ~5 menit.
select b.id            as booking_id,
       b.full_name,
       b.email,
       sub.from_coach,
       sub.to_coach,
       coalesce(sub.class_label, ct.name) as class_name,
       sub.time_label,
       s.schedule_date
from arena_coach_substitutions sub
join arena_class_schedules s   on s.id = sub.schedule_id
left join arena_class_types ct on ct.id = s.class_type_id
join arena_class_bookings b    on b.schedule_id = sub.schedule_id
where sub.status = 'approved'
  and sub.decided_at >= now() - interval '1 day'   -- perubahan yang masih baru
  and s.is_cancelled = false
  and s.schedule_date >= (now() at time zone 'Asia/Jakarta')::date  -- kelas belum lewat
  and b.status = 'confirmed'
  and b.email is not null and b.email <> ''
  and b.coach_change_notified_at is null;           -- dedup (lihat bagian 3)
```

> Kirim notifikasi **hanya untuk kelas yang belum berlangsung** — tidak ada
> gunanya memberi tahu peserta setelah kelasnya lewat.

---

## 3. Cegah kirim ganda (dedup)

```sql
alter table public.arena_class_bookings
  add column if not exists coach_change_notified_at timestamptz;
```

Setelah email terkirim untuk sebuah booking:

```sql
update public.arena_class_bookings
   set coach_change_notified_at = now()
 where id = :booking_id;
```

(Kolom nullable — aman, tidak mengganggu sistem lain. Alternatif: tabel log
tersendiri bila tidak ingin menambah kolom.)

---

## 4. Template email (Bahasa Indonesia)

**Subject:**
```
Info kelas {class_name}: coach kamu berganti jadi Coach {to_coach}
```

**Body (HTML):**
```html
<p>Hai {full_name},</p>
<p>Ada sedikit perubahan untuk kelas <b>{class_name}</b>
   ({time_label}, {schedule_date}) di 20FIT Arena:</p>
<p style="font-size:16px;">
   Coach kamu berganti dari <b>Coach {from_coach}</b>
   menjadi <b>Coach {to_coach}</b>.
</p>
<p>Jadwal, lokasi, dan slot booking kamu <b>tidak berubah</b> — cukup datang
   seperti biasa. Sampai jumpa di kelas! 💪</p>
<p style="color:#888;font-size:12px;">Email ini dikirim otomatis oleh 20FIT Arena.</p>
```

Ganti `{...}` dengan nilai dari query bagian 2.

---

## 5. Ringkasan alur

1. Coach pengganti menyetujui rotation di Coach Workspace →
   `arena_class_schedules.instructor` diganti + baris
   `arena_coach_substitutions` jadi `status = 'approved'`.
2. Cron Admin Hub (tiap ~5 menit) menjalankan query bagian 2.
3. Untuk tiap penerima: kirim email (template bagian 4), lalu set
   `coach_change_notified_at = now()`.
4. Peserta tahu coach kelasnya berganti — jadwal & booking tetap sama.

Tidak ada API tambahan yang perlu dipanggil Admin Hub — cukup baca tabel
`arena_coach_substitutions` + `arena_class_bookings`.
