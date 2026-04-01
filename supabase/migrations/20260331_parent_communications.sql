-- Parent Communications Log
-- Tracks every email, call, meeting, and ParentSquare message with parents
-- Especially valuable for IEP meetings and difficult situations

create table if not exists public.parent_communications (
  id           text primary key default gen_random_uuid()::text,
  user_id      uuid not null references auth.users(id) on delete cascade,
  student_id   text not null,
  student_name text not null,

  -- Communication metadata
  comm_type    text not null,         -- 'Email' | 'Phone' | 'Meeting' | 'ParentSquare' | custom
  direction    text not null default 'outbound', -- 'outbound' | 'inbound'
  subject      text,                  -- email subject or brief topic
  notes        text not null default '',         -- full notes/content

  -- Who was contacted
  parent_name  text,

  -- Dates
  comm_date    timestamptz not null default now(),
  follow_up_date date,
  follow_up_done boolean not null default false,

  -- Flags
  is_iep_related   boolean not null default false,
  is_urgent        boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Enable RLS
alter table public.parent_communications enable row level security;

-- Users can only see/modify their own records
create policy "parent_communications_select" on public.parent_communications
  for select using (auth.uid() = user_id);

create policy "parent_communications_insert" on public.parent_communications
  for insert with check (auth.uid() = user_id);

create policy "parent_communications_update" on public.parent_communications
  for update using (auth.uid() = user_id);

create policy "parent_communications_delete" on public.parent_communications
  for delete using (auth.uid() = user_id);

-- Index for fast per-student queries
create index if not exists parent_communications_student_idx
  on public.parent_communications (user_id, student_id, comm_date desc);

-- Auto-update updated_at
create or replace function public.touch_parent_communications()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger parent_communications_updated
  before update on public.parent_communications
  for each row execute procedure public.touch_parent_communications();
