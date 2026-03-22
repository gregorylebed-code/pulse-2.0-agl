-- Google OAuth tokens for Classroom integration
create table if not exists google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

alter table google_tokens enable row level security;

-- Users can only read their own tokens (used by frontend to check connection status)
create policy "Users can read own google tokens"
  on google_tokens for select
  using (auth.uid() = user_id);

-- Inserts/updates happen via service role in API routes (bypasses RLS), no insert policy needed
