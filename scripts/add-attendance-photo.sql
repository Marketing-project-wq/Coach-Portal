-- Group attendance photo (one per class), uploaded by GRO, shown in the report + PDF.
-- Run once in the Supabase SQL editor.

-- 1) Table that holds one photo URL per class schedule.
create table if not exists public.arena_class_photos (
  schedule_id uuid primary key,
  photo_url   text not null,
  uploaded_by text,
  uploaded_at timestamptz default now()
);

-- 2) Public storage bucket for the photo files.
insert into storage.buckets (id, name, public)
values ('attendance-proof', 'attendance-proof', true)
on conflict (id) do update set public = true;

-- 3) Allow public read of the photos (bucket is public; this policy makes objects readable).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance-proof public read'
  ) then
    create policy "attendance-proof public read"
      on storage.objects for select
      using ( bucket_id = 'attendance-proof' );
  end if;
end $$;
