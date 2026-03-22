export const config = { runtime: 'edge' };

export default function handler(req: Request): Response {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return new Response('Missing userId', { status: 400 });

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
    state: userId,
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
