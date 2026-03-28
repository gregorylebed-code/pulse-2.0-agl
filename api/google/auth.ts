import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return new Response('Missing userId', { status: 400 });

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

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
