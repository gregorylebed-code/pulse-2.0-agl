export const config = { runtime: 'edge' };

// Map Groq model names to Together AI equivalents
const TOGETHER_MODEL_MAP: Record<string, string> = {
  'llama-3.3-70b-versatile': 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — missing GROQ_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.text();

  // TEMP: force Together AI for testing — revert after
  const groqRes = { ok: false, status: 429 } as any;

  // On rate limit (429) or server error (5xx), try Together AI as fallback
  if ((groqRes.status === 429 || groqRes.status >= 500) && process.env.TOGETHER_API_KEY) {
    try {
      const parsed = JSON.parse(body);
      const togetherModel = TOGETHER_MODEL_MAP[parsed.model] ?? parsed.model;
      const togetherBody = JSON.stringify({ ...parsed, model: togetherModel });

      const togetherRes = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: togetherBody,
      });

      const data = await togetherRes.text();
      if (!togetherRes.ok) {
        console.error(`[groq.ts] Together AI error ${togetherRes.status}:`, data);
      }
      return new Response(data, {
        status: togetherRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // If fallback errors, fall through and return the original Groq error
    }
  }

  const data = await groqRes.text();
  return new Response(data, {
    status: groqRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
