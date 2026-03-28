import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify the caller is a real authenticated user
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const userId = user.id;

  // Generate an unguessable random state token to prevent OAuth CSRF
  const stateToken = crypto.randomUUID();

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  // Store stateToken → userId for 5 minutes (TTL matches OAuth flow window)
  await redis.set(`oauth:state:${stateToken}`, userId, { ex: 300 });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: stateToken,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Return the URL as JSON — frontend will navigate to it
  return new Response(JSON.stringify({ url }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
