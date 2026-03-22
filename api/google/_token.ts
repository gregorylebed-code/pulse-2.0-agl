// Shared helper — not exposed as an API route (underscore prefix)
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getValidToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (!data) return null;

  // Token still valid
  if (new Date(data.expires_at) > new Date()) return data.access_token;

  // Refresh it
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });

  const refreshed = await res.json();
  if (!refreshed.access_token) return null;

  await supabase
    .from('google_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}
