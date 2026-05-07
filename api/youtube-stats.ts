export const config = { runtime: 'edge' };

const CHANNEL_ID = 'UCqnJPd4iSKLpr1gDPAPPTtA';

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing YOUTUBE_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ error: `YouTube API error: ${res.status}`, detail: text }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const json = await res.json() as any;
  const stats = json?.items?.[0]?.statistics;

  if (!stats) {
    return new Response(JSON.stringify({ error: 'No channel data returned' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      subscribers: parseInt(stats.subscriberCount ?? '0'),
      totalViews:  parseInt(stats.viewCount ?? '0'),
      videoCount:  parseInt(stats.videoCount ?? '0'),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
