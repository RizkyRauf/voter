-- ============================================================
-- Aplikasi Voting Online — skema Supabase (jalankan sekali di
-- Supabase Dashboard → SQL Editor → New query → Run)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tabel ----------

create table if not exists admins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists election (
  id                    text primary key check (id = 'main'),
  title                 text not null,
  status                text not null default 'DRAFT'
                        check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  show_results_to_voters boolean not null default true,
  started_at            timestamptz,
  closed_at             timestamptz,
  created_at            timestamptz not null default now()
);

create table if not exists candidates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists voters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  name_key   text not null unique,
  has_voted  boolean not null default false,
  voted_at   timestamptz,
  created_at timestamptz not null default now()
);

-- UNIQUE voter_id = jaminan "1 nama = 1 suara" langsung di level database.
create table if not exists votes (
  id           uuid primary key default gen_random_uuid(),
  voter_id     uuid not null unique references voters (id) on delete cascade,
  candidate_id uuid not null references candidates (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value text not null
);

create index if not exists votes_candidate_id_idx on votes (candidate_id);

-- ---------- RLS: tolak semua akses client; hanya server (service_role) ----------

alter table admins     enable row level security;
alter table election   enable row level security;
alter table candidates enable row level security;
alter table voters     enable row level security;
alter table votes      enable row level security;
alter table settings   enable row level security;

-- ---------- seed baris election ----------

insert into election (id, title) values ('main', 'Pemilihan')
on conflict (id) do nothing;

-- ---------- fungsi atomic ----------

-- Registrasi pemilih: insert jika nama (dinormalisasi) belum ada,
-- selalu mengembalikan baris pemilihnya.
create or replace function register_voter(p_name text, p_name_key text)
returns setof voters
language sql
as $$
  insert into voters (name, name_key)
  values (p_name, p_name_key)
  on conflict (name_key) do nothing;
  select * from voters where name_key = p_name_key;
$$;

-- Suara: satu transaksi — cek status, cek pemilih/kandidat, cek ganda,
-- tandai pemilih. Unique violation ditangkap → 'already-voted'.
create or replace function cast_vote(p_voter_id uuid, p_candidate_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from election where id = 'main';

  if v_status = 'DRAFT' then
    return jsonb_build_object('ok', false, 'reason', 'not-started');
  end if;
  if v_status = 'CLOSED' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if not exists (select 1 from voters where id = p_voter_id) then
    return jsonb_build_object('ok', false, 'reason', 'voter-gone');
  end if;
  if not exists (select 1 from candidates where id = p_candidate_id) then
    return jsonb_build_object('ok', false, 'reason', 'candidate-not-found');
  end if;
  if exists (select 1 from votes where voter_id = p_voter_id) then
    return jsonb_build_object('ok', false, 'reason', 'already-voted');
  end if;

  begin
    insert into votes (voter_id, candidate_id)
    values (p_voter_id, p_candidate_id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already-voted');
  end;

  update voters set has_voted = true, voted_at = now() where id = p_voter_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Reset sesi baru: hanya dari CLOSED; hapus semua suara, reset status
-- pemilih. Transaksional. Catatan: Supabase memblokir DELETE/UPDATE tanpa
-- WHERE clause (baik di restapi maupun di dalam function) — semua
-- statement di bawah sengaja punya predicate meski id memang NOT NULL.
create or replace function reset_election()
returns jsonb
language plpgsql
as $$
begin
  if not exists (select 1 from election where id = 'main' and status = 'CLOSED') then
    return jsonb_build_object('ok', false, 'reason', 'not-closed');
  end if;

  update election
    set status = 'DRAFT', started_at = null, closed_at = null
    where id = 'main';
  delete from votes where id is not null;
  update voters set has_voted = false, voted_at = null where id is not null;

  return jsonb_build_object('ok', true);
end;
$$;

-- Secret sesi HMAC: dibuat sekali, dibaca semua instance (aman lintas
-- cold start serverless).
create or replace function get_or_create_secret()
returns text
language plpgsql
as $$
declare
  v text;
begin
  select value into v from settings where key = 'session_secret';
  if v is not null then
    return v;
  end if;

  v := encode(gen_random_bytes(32), 'hex');
  insert into settings (key, value)
  values ('session_secret', v)
  on conflict (key) do nothing;

  select value into v from settings where key = 'session_secret';
  return v;
end;
$$;
