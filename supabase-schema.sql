create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  bio text not null default '',
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists bio text not null default '';

alter table public.profiles
add column if not exists social_links jsonb not null default '{}'::jsonb;

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

with submission_windows as (
  select
    id,
    case
      when period = 'daily' then to_char(created_at, 'YYYY-MM-DD')
      when period = 'weekly' then 'week-' || to_char(date_trunc('week', created_at), 'YYYY-MM-DD')
      when period = 'monthly' then to_char(created_at, 'YYYY-MM')
      else to_char(created_at, 'YYYY-MM-DD')
    end as base_window,
    row_number() over (
      partition by
        couple_id,
        user_id,
        period,
        case
          when period = 'daily' then to_char(created_at, 'YYYY-MM-DD')
          when period = 'weekly' then 'week-' || to_char(date_trunc('week', created_at), 'YYYY-MM-DD')
          when period = 'monthly' then to_char(created_at, 'YYYY-MM')
          else to_char(created_at, 'YYYY-MM-DD')
        end
      order by created_at desc
    ) as duplicate_number
  from public.checkup_submissions
  where period_window is null
)
update public.checkup_submissions
set period_window = case
  when submission_windows.duplicate_number = 1 then submission_windows.base_window
  else submission_windows.base_window || '-legacy-' || submission_windows.duplicate_number
end
from submission_windows
where checkup_submissions.id = submission_windows.id;

create unique index if not exists one_checkup_submission_per_window
on public.checkup_submissions (couple_id, user_id, period, period_window)
where period_window is not null;

alter table public.checkup_submissions
drop constraint if exists checkup_submissions_period_window_required;

alter table public.checkup_submissions
add constraint checkup_submissions_period_window_required
check (period_window is not null);

create table if not exists public.talk_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  principle_id text not null,
  principle_title text not null,
  source text not null default 'Reflection',
  prompt text not null,
  action text not null default '',
  status text not null default 'open' check (status in ('open', 'scheduled', 'followup', 'resolved')),
  scheduled_for date,
  note text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.talk_items
add column if not exists status text not null default 'open';

alter table public.talk_items
add column if not exists scheduled_for date;

alter table public.talk_items
add column if not exists note text not null default '';

alter table public.talk_items
drop constraint if exists talk_items_status_check;

alter table public.talk_items
add constraint talk_items_status_check
check (status in ('open', 'scheduled', 'followup', 'resolved'));

alter table public.talk_items
drop constraint if exists talk_items_principle_id_check;

alter table public.talk_items
add constraint talk_items_principle_id_check
check (principle_id in ('recognition', 'acceptance', 'stability', 'initiative', 'intimacy', 'safety'));

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_requests enable row level security;
alter table public.checkup_submissions enable row level security;
alter table public.talk_items enable row level security;

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

create or replace function public.can_view_profile(target_profile_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    target_profile_id = target_user_id
    or exists (
      select 1
      from public.couple_members viewer_membership
      join public.couple_members target_membership
        on target_membership.couple_id = viewer_membership.couple_id
      where viewer_membership.user_id = target_user_id
      and target_membership.user_id = target_profile_id
    )
    or exists (
      select 1
      from public.couple_requests
      where status = 'pending'
      and (
        (requester_id = target_user_id and recipient_id = target_profile_id)
        or (recipient_id = target_user_id and requester_id = target_profile_id)
      )
    );
$$;

create or replace function public.user_has_couple(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members
    where user_id = target_user_id
  );
$$;

create or replace function public.find_profile_for_couple_request(profile_query text)
returns table (
  id uuid,
  email text,
  display_name text
)
language sql
security definer
set search_path = public
as $$
  select profiles.id, profiles.email, profiles.display_name
  from public.profiles
  where profiles.id <> auth.uid()
  and (
    profiles.id::text = trim(profile_query)
    or lower(profiles.email) = lower(trim(profile_query))
  )
  limit 1;
$$;

create or replace function public.create_couple_workspace()
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_couple public.couples;
  new_couple public.couples;
begin
  select couples.*
  into existing_couple
  from public.couples
  join public.couple_members on couple_members.couple_id = couples.id
  where couple_members.user_id = auth.uid()
  order by couples.created_at desc
  limit 1;

  if found then
    return existing_couple;
  end if;

  insert into public.couples (created_by)
  values (auth.uid())
  returning * into new_couple;

  insert into public.couple_members (couple_id, user_id, role)
  values (new_couple.id, auth.uid(), 'owner');

  return new_couple;
end;
$$;

create or replace function public.join_couple_by_invite(target_invite_code text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple public.couples;
  current_member_count integer;
begin
  if exists (
    select 1
    from public.couple_members
    where user_id = auth.uid()
  ) then
    raise exception 'You are already connected to a couple workspace.';
  end if;

  select *
  into target_couple
  from public.couples
  where invite_code = upper(trim(target_invite_code))
  for update;

  if not found then
    raise exception 'Invite code was not found.';
  end if;

  select count(*)
  into current_member_count
  from public.couple_members
  where couple_id = target_couple.id;

  if current_member_count >= 2 then
    raise exception 'That couple workspace already has two members.';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (target_couple.id, auth.uid(), 'partner');

  return target_couple;
end;
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
  current_member_count integer;
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

  if public.user_has_couple(request_row.recipient_id)
    and public.user_has_couple(request_row.requester_id) then
    raise exception 'Both users are already connected to couple workspaces.';
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
  else
    select count(*)
    into current_member_count
    from public.couple_members
    where couple_id = new_couple_id;

    if current_member_count >= 2 then
      raise exception 'That couple workspace already has two members.';
    end if;
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
grant execute on function public.find_profile_for_couple_request(text) to authenticated;
grant execute on function public.create_couple_workspace() to authenticated;
grant execute on function public.join_couple_by_invite(text) to authenticated;

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
drop policy if exists "Couple members can view talk items" on public.talk_items;
drop policy if exists "Couple members can create talk items" on public.talk_items;
drop policy if exists "Couple members can update talk items" on public.talk_items;

create policy "Profiles are visible to signed-in users"
on public.profiles for select
to authenticated
using (public.can_view_profile(id, auth.uid()));

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

create policy "Members can view memberships in their couples"
on public.couple_members for select
to authenticated
using (public.is_couple_member(couple_id, auth.uid()));

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
  and not public.user_has_couple(auth.uid())
  and not public.user_has_couple(recipient_id)
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

create policy "Couple members can view talk items"
on public.talk_items for select
to authenticated
using (public.is_couple_member(couple_id, auth.uid()));

create policy "Couple members can create talk items"
on public.talk_items for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_couple_member(couple_id, auth.uid())
);

create policy "Couple members can update talk items"
on public.talk_items for update
to authenticated
using (public.is_couple_member(couple_id, auth.uid()))
with check (public.is_couple_member(couple_id, auth.uid()));

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

    begin
      alter publication supabase_realtime add table public.talk_items;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
