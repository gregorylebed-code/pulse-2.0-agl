export const config = { runtime: 'edge' };

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getIp } from './_ratelimit';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Tighter limit — no auth on this endpoint
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:free-tool',
});

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { success } = await limiter.limit(getIp(req));
  if (!success) {
    return new Response(
      JSON.stringify({ error: { message: 'Too many requests. Please wait a moment.' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'Server misconfigured.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let prompt: string;
  try {
    const body = await req.json();
    prompt = body?.prompt;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 1000) throw new Error();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid request.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that writes concise, warm, specific report card comments for elementary school teachers. Output only the comment text — no intro, no labels, no quotes.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: { message: err?.error?.message ?? 'AI request failed.' } }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    const comment = data.choices?.[0]?.message?.content?.trim();
    if (!comment) throw new Error('Empty response from AI.');

    return new Response(
      JSON.stringify({ comment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: { message: e?.message ?? 'Something went wrong.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
