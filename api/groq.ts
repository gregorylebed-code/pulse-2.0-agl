export const config = { runtime: 'edge' };

// Map Groq model names to their Cerebras equivalents
const CEREBRAS_MODEL_MAP: Record<string, string> = {
  'llama-3.3-70b-versatile': 'llama-3.3-70b',
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

  // Try Groq first
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  // If Groq succeeded, return immediately
  if (groqRes.ok) {
    const data = await groqRes.text();
    return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // On rate limit (429) or server error (5xx), try Cerebras as fallback
  const shouldFallback = groqRes.status === 429 || groqRes.status >= 500;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;

  if (shouldFallback && cerebrasKey) {
    try {
      const parsed = JSON.parse(body);
      // Skip fallback for vision/image requests — Cerebras doesn't support them
      const hasImage = Array.isArray(parsed.messages?.[0]?.content) &&
        parsed.messages[0].content.some((c: any) => c.type === 'image_url');

      if (!hasImage) {
        // Swap model name to Cerebras equivalent if needed
        const cerebrasModel = CEREBRAS_MODEL_MAP[parsed.model] ?? parsed.model;
        const cerebrasBody = JSON.stringify({ ...parsed, model: cerebrasModel });

        const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasKey}`,
            'Content-Type': 'application/json',
          },
          body: cerebrasBody,
        });

        const data = await cerebrasRes.text();
        return new Response(data, {
          status: cerebrasRes.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // If fallback itself errors, fall through and return the original Groq error
    }
  }

  const data = await groqRes.text();
  return new Response(data, {
    status: groqRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
