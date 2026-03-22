import { getValidToken } from './_token';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const courseId = url.searchParams.get('courseId');

  if (!userId || !courseId) {
    return new Response(JSON.stringify({ error: 'Missing userId or courseId' }), { status: 400 });
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
