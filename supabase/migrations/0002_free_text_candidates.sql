-- ============================================================
-- 0002 — Kandidat bebas-teks: pemilih mengetik nama peserta
-- (typeahead). Kandidat tercipta otomatis saat suara masuk.
-- Jalankan di Supabase Dashboard → SQL Editor (setelah 0001).
-- ============================================================

-- ---------- 1) kolom nama_key pada candidates ----------

alter table candidates add column if not exists name_key text;

update candidates
set name_key = lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
where name_key is null;

-- Gabungkan duplikat (nama beda kapitalisasi/spasi): pindahkan suara
-- ke kandidat tertua, baris kembar dihapus. Semua statement punya
-- predicate (aturan Supabase: tanpa WHERE dilarang).
update votes v
set candidate_id = d.keep_id
from (
  select name_key, (array_agg(id order by created_at))[1] as keep_id
  from candidates
  group by name_key
  having count(*) > 1
) d
join candidates c on c.name_key = d.name_key
where v.candidate_id = c.id
  and c.id <> d.keep_id;

delete from candidates c
using (
  select name_key, (array_agg(id order by created_at))[1] as keep_id
  from candidates
  group by name_key
  having count(*) > 1
) d
where c.name_key = d.name_key
  and c.id <> d.keep_id;

create unique index if not exists candidates_name_key_idx on candidates (name_key);

-- ---------- 2) cast_vote overload: nama teks bebas ----------
-- Overload lama (p_candidate_id uuid) dipertahankan untuk jendela
-- deploy — klien lama tetap jalan sampai halaman dimuat ulang.

create or replace function cast_vote(
  p_voter_id uuid,
  p_candidate_name text,
  p_candidate_name_key text
)
returns jsonb
language plpgsql
as $$
declare
  v_status text;
  v_candidate_id uuid;
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
  if exists (select 1 from votes where voter_id = p_voter_id) then
    return jsonb_build_object('ok', false, 'reason', 'already-voted');
  end if;
  if p_candidate_name_key is null or p_candidate_name_key = ''
     or length(btrim(coalesce(p_candidate_name, ''))) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'invalid-name');
  end if;

  -- Auto-buat kandidat dari nama yang diketik pemilih (idempotent
  -- per name_key; unique_violation = pemain lain baru membuatnya).
  select id into v_candidate_id from candidates where name_key = p_candidate_name_key;
  if v_candidate_id is null then
    begin
      insert into candidates (name, name_key)
      values (btrim(p_candidate_name), p_candidate_name_key)
      returning id into v_candidate_id;
    exception when unique_violation then
      select id into v_candidate_id from candidates where name_key = p_candidate_name_key;
    end;
  end if;
  if v_candidate_id is null then
    return jsonb_build_object('ok', false, 'reason', 'candidate-not-found');
  end if;

  begin
    insert into votes (voter_id, candidate_id)
    values (p_voter_id, v_candidate_id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already-voted');
  end;

  update voters set has_voted = true, voted_at = now() where id = p_voter_id;
  return jsonb_build_object('ok', true, 'candidate_id', v_candidate_id);
end;
$$;

-- ---------- 3) reset_election: ikut hapus kandidat ----------
-- Kandidat kini tercipta dari suara pemilih, bukan inputan admin —
-- sesi baru harus mulai bersih agar typeahead tidak membawa nama
-- sesi sebelumnya.

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
  delete from candidates where id is not null;
  delete from voters where id is not null;

  return jsonb_build_object('ok', true);
end;
$$;
