create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'partner',
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.couple_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  couple_id uuid references public.couples(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint couple_requests_not_self check (requester_id <> recipient_id)
);

create unique index if not exists one_pending_couple_request_per_pair
on public.couple_requests (
  least(requester_id, recipient_id),
  greatest(requester_id, recipient_id)
)
where status = 'pending';

create table if not exists public.checkup_submissions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  period_window text,
  note text not null default '',
  responses jsonb not null,
  principle_scores jsonb not null,
  overall_score integer not null check (overall_score between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.checkup_submissions
add column if not exists period_window text;

create unique index if not exists one_checkup_submission_per_window
on public.checkup_submissions (couple_id, user_id, period, period_window)
where period_window is not null;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_requests enable row level security;
alter table public.checkup_submissions enable row level security;

create or replace function public.is_couple_member(target_couple_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = target_couple_id
    and user_id = target_user_id
  );
$$;

create or replace function public.accept_couple_request(target_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.couple_requests;
  new_couple_id uuid;
begin
  select *
  into request_row
  from public.couple_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Couple request was not found.';
  end if;

  if request_row.recipient_id <> auth.uid() then
    raise exception 'Only the recipient can accept this couple request.';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'This couple request is no longer pending.';
  end if;

  select couple_id
  into new_couple_id
  from public.couple_members
  where user_id in (request_row.recipient_id, request_row.requester_id)
  group by couple_id
  having count(*) = 1
  order by max(created_at) desc
  limit 1;

  if new_couple_id is null then
    insert into public.couples (created_by)
    values (auth.uid())
    returning id into new_couple_id;
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values
    (new_couple_id, request_row.recipient_id, 'owner'),
    (new_couple_id, request_row.requester_id, 'partner')
  on conflict (couple_id, user_id) do nothing;

  update public.couple_requests
  set status = 'accepted',
      couple_id = new_couple_id,
      responded_at = now()
  where id = target_request_id;

  update public.couple_requests
  set status = 'cancelled',
      responded_at = now()
  where status = 'pending'
  and id <> target_request_id
  and (
    requester_id in (request_row.requester_id, request_row.recipient_id)
    or recipient_id in (request_row.requester_id, request_row.recipient_id)
  );

  return new_couple_id;
end;
$$;

grant execute on function public.accept_couple_request(uuid) to authenticated;

drop policy if exists "Profiles are visible to signed-in users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Members can view their couples" on public.couples;
drop policy if exists "Signed-in users can find couples by invite code" on public.couples;
drop policy if exists "Signed-in users can create couples" on public.couples;
drop policy if exists "Members can view memberships in their couples" on public.couple_members;
drop policy if exists "Users can create their own membership" on public.couple_members;
drop policy if exists "Users can update their own membership" on public.couple_members;
drop policy if exists "Couple creators can add their partner" on public.couple_members;
drop policy if exists "Users can send couple requests" on public.couple_requests;
drop policy if exists "Users can view their couple requests" on public.couple_requests;
drop policy if exists "Recipients can answer couple requests" on public.couple_requests;
drop policy if exists "Requesters can cancel couple requests" on public.couple_requests;
drop policy if exists "Couple members can view submissions" on public.checkup_submissions;
drop policy if exists "Users can submit their own check-ups" on public.checkup_submissions;

create policy "Profiles are visible to signed-in users"
on public.profiles for select
to authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members can view their couples"
on public.couples for select
to authenticated
using (public.is_couple_member(id, auth.uid()));

create policy "Signed-in users can find couples by invite code"
on public.couples for select
to authenticated
using (true);

create policy "Signed-in users can create couples"
on public.couples for insert
to authenticated
with check (created_by = auth.uid());

create policy "Members can view memberships in their couples"
on public.couple_members for select
to authenticated
using (public.is_couple_member(couple_id, auth.uid()));

create policy "Users can create their own membership"
on public.couple_members for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own membership"
on public.couple_members for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can send couple requests"
on public.couple_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and recipient_id <> auth.uid()
);

create policy "Users can view their couple requests"
on public.couple_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or recipient_id = auth.uid()
);

create policy "Recipients can answer couple requests"
on public.couple_requests for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "Requesters can cancel couple requests"
on public.couple_requests for update
to authenticated
using (requester_id = auth.uid())
with check (requester_id = auth.uid());

create policy "Couple members can view submissions"
on public.checkup_submissions for select
to authenticated
using (public.is_couple_member(couple_id, auth.uid()));

create policy "Users can submit their own check-ups"
on public.checkup_submissions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_couple_member(couple_id, auth.uid())
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.couple_requests;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.couple_members;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.checkup_submissions;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
