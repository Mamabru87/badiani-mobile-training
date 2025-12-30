// Vercel Serverless Function: /api/berny
// - Hides API keys server-side
// - Accepts { messages: [{role, content}...], intent?, userContext? }
// - Returns { text }
//
// Env vars:
// - PROVIDER=openai|anthropic
// - OPENAI_API_KEY, OPENAI_MODEL (optional)
// - ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional)
// - ALLOWED_ORIGIN (optional)

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body || {};
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || !messages.length) {
    return res.status(400).send('Missing messages[]');
  }

  const provider = String(process.env.PROVIDER || 'openai').toLowerCase();

  try {
    if (provider === 'anthropic') {
      const sys = messages.find((m) => m?.role === 'system')?.content || '';
      const chat = messages
        .filter((m) => m?.role === 'user' || m?.role === 'assistant')
        .map((m) => ({ role: m.role, content: String(m.content || '') }));

      const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 260,
          temperature: 0.6,
          system: String(sys),
          messages: chat,
        }),
      });

      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return res.status(500).send(`Anthropic error ${r.status}: ${t}`);
      }

      const data = await r.json();
      const text = (data?.content || [])
        .map((p) => (p?.type === 'text' ? p.text : ''))
        .join('')
        .trim();

      return res.status(200).json({ text });
    }

    // Default: OpenAI Chat Completions
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 260,
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return res.status(500).send(`OpenAI error ${r.status}: ${t}`);
    }

    const data = await r.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).send(`Proxy exception: ${String(e?.message || e)}`);
  }
}
