import { getValidToken } from './_token';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });

  const token = await getValidToken(userId);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Not connected' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=50',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();

  return new Response(JSON.stringify(data.courses ?? []), {
    headers: { 'Content-Type': 'application/json' },
  });
}
