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

create table if not exists public.checkup_submissions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  note text not null default '',
  responses jsonb not null,
  principle_scores jsonb not null,
  overall_score integer not null check (overall_score between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.checkup_submissions enable row level security;

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
using (
  exists (
    select 1 from public.couple_members
    where couple_members.couple_id = couples.id
    and couple_members.user_id = auth.uid()
  )
);

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
using (
  exists (
    select 1 from public.couple_members own_membership
    where own_membership.couple_id = couple_members.couple_id
    and own_membership.user_id = auth.uid()
  )
);

create policy "Users can create their own membership"
on public.couple_members for insert
to authenticated
with check (user_id = auth.uid());

create policy "Couple creators can add their partner"
on public.couple_members for insert
to authenticated
with check (
  exists (
    select 1 from public.couples
    where couples.id = couple_members.couple_id
    and couples.created_by = auth.uid()
  )
);

create policy "Couple members can view submissions"
on public.checkup_submissions for select
to authenticated
using (
  exists (
    select 1 from public.couple_members
    where couple_members.couple_id = checkup_submissions.couple_id
    and couple_members.user_id = auth.uid()
  )
);

create policy "Users can submit their own check-ups"
on public.checkup_submissions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.couple_members
    where couple_members.couple_id = checkup_submissions.couple_id
    and couple_members.user_id = auth.uid()
  )
);
