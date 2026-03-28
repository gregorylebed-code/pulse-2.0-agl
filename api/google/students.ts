import { createClient } from '@supabase/supabase-js';
import { getValidToken } from './_token';
import { googleLimiter, getIp } from '../_ratelimit';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { success } = await googleLimiter.limit(getIp(req));
  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const userId = user.id;

  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');

  if (!courseId) {
    return new Response(JSON.stringify({ error: 'Missing courseId' }), { status: 400 });
  }

  const token = await getValidToken(userId);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Not connected' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/students?pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();

  // Normalize to just what we need: name, email, photoUrl
  const students = (data.students ?? []).map((s: any) => ({
    name: s.profile?.name?.fullName ?? '',
    email: s.profile?.emailAddress ?? '',
    photoUrl: s.profile?.photoUrl ?? null,
  }));

  return new Response(JSON.stringify(students), {
    headers: { 'Content-Type': 'application/json' },
  });
}
