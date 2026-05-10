-- Add is_demo flag to parent_communications for sandbox mode
alter table public.parent_communications
  add column if not exists is_demo boolean not null default false;

create index if not exists parent_communications_demo_idx
  on public.parent_communications (user_id, is_demo);
