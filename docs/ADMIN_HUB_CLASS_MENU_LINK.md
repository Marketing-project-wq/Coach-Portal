# Setup — "Class Menu per Kelas" (Opsi B)

Fitur ini membuat coach bisa **memilih & mengganti menu** untuk tiap kelas dari
layar **Class Detail**. Pilihan itu disimpan di tabel baru `arena_class_menu_links`.

> Coach Portal **menulis langsung** ke tabel ini (bukan lewat Admin Hub). Yang
> perlu tim Admin Hub / pemilik Supabase lakukan **hanya sekali**: membuat tabelnya.
> Sampai tabel ini ada, fitur tetap aman — dropdown muncul, tapi menyimpan pilihan
> akan menampilkan pesan "belum di-setup".

## 1. DDL tabel — jalankan sekali di Supabase (SQL Editor)

```sql
create table if not exists public.arena_class_menu_links (
  schedule_id text primary key,          -- id kelas (arena_class_schedules.id)
  menu_id     text not null,             -- id menu (arena_class_menus.id)
  set_by      text,                      -- coach yang menyetel
  updated_at  timestamptz not null default now()
);
```

- `schedule_id` dibuat **primary key** → satu kelas = satu menu (di-upsert saat diganti).
- Tipe `text` dipakai agar cocok baik id-nya uuid maupun text.

## 2. RLS (kalau RLS aktif)

Portal memakai **service key** (server-side, bypass RLS), jadi tidak perlu policy
khusus untuk portal. Kalau ingin Admin Hub / klien lain membacanya, tambahkan policy
sesuai kebutuhan.

## 3. Selesai

Setelah tabel dibuat, buka **Class Detail → Class Menu**, pilih menu → tersimpan.
Ganti menu kapan saja lewat dropdown yang sama; pilih **"— no menu —"** untuk melepas.
