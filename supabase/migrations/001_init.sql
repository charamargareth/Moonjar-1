-- ============================================================
-- MOONJAR — Skema database Supabase
-- Jalankan ini di Supabase Dashboard > SQL Editor (atau lewat CLI)
-- ============================================================

-- Tabel profil user (melengkapi auth.users milik Supabase)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  initials text not null,
  avatar_color text not null default '#3C3489',
  created_at timestamptz not null default now()
);

-- Tabel grup tabungan
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  target_name text not null default 'Target Tabungan',
  target_amount numeric not null default 10000000,
  duration_weeks integer not null default 13,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Tabel keanggotaan grup (many-to-many user <-> group)
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Tabel transaksi nabung
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  note text,
  is_late boolean not null default false,
  created_at timestamptz not null default now()
);

-- Tabel cache saran AI (biar gak panggil API tiap render)
create table public.ai_tips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  tip_text text not null,
  created_at timestamptz not null default now()
);

create index idx_members_group on public.group_members(group_id);
create index idx_members_user on public.group_members(user_id);
create index idx_tx_group on public.transactions(group_id);
create index idx_tx_created on public.transactions(created_at desc);

-- ============================================================
-- Row Level Security — tiap user hanya boleh akses grup miliknya
-- ============================================================
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.transactions enable row level security;
alter table public.ai_tips enable row level security;

-- Helper: cek apakah user adalah anggota grup tertentu
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- profiles: semua orang login boleh lihat profil dasar (buat tampil nama anggota grup)
create policy "profiles_select_all" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- groups: hanya anggota grup yang boleh lihat; siapapun yg login boleh create
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id));
create policy "groups_insert_any" on public.groups
  for insert with check (auth.uid() = created_by);
create policy "groups_update_admin" on public.groups
  for update using (
    exists (select 1 from public.group_members
      where group_id = id and user_id = auth.uid() and role = 'admin')
  );

-- group_members: anggota grup boleh lihat sesama anggota
create policy "members_select_member" on public.group_members
  for select using (public.is_group_member(group_id));
create policy "members_insert_self" on public.group_members
  for insert with check (user_id = auth.uid());

-- transactions: hanya anggota grup yang boleh lihat & tambah transaksi grupnya
create policy "tx_select_member" on public.transactions
  for select using (public.is_group_member(group_id));
create policy "tx_insert_member" on public.transactions
  for insert with check (
    user_id = auth.uid() and public.is_group_member(group_id)
  );

-- ai_tips: hanya anggota grup
create policy "tips_select_member" on public.ai_tips
  for select using (public.is_group_member(group_id));
create policy "tips_insert_member" on public.ai_tips
  for insert with check (public.is_group_member(group_id));

-- ============================================================
-- Fungsi untuk generate kode undangan unik 6 karakter
-- ============================================================
create or replace function public.generate_invite_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$;
