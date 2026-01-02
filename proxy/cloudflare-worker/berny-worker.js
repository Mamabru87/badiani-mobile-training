// Cloudflare Worker: /berny (or any route you bind)
// - Hides API keys in Worker environment variables
// - Accepts { messages: [{role, content}...], intent?, userContext? }
// - Returns { text }
//
// Env vars (recommended):
// - PROVIDER=openai|anthropic|gemini
// - OPENAI_API_KEY, OPENAI_MODEL (optional)
// - ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional)
// - GEMINI_API_KEY, GEMINI_MODEL (optional)
// - ALLOWED_ORIGIN (optional)

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed === '*' ? '*' : origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad JSON', { status: 400, headers: corsHeaders });
    }

    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || !messages.length) {
      return new Response('Missing messages[]', { status: 400, headers: corsHeaders });
    }

    const provider = String(env.PROVIDER || 'openai').toLowerCase();

    try {
      if (provider === 'gemini') {
        const sys = messages.find((m) => m?.role === 'system')?.content || '';
        const chat = messages
          .filter((m) => m?.role === 'user' || m?.role === 'assistant')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
          }));

        const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
        const key = env.GEMINI_API_KEY;

        if (!key) {
          return new Response('Missing GEMINI_API_KEY', { status: 500, headers: corsHeaders });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: sys ? { parts: [{ text: String(sys) }] } : undefined,
            contents: chat,
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 260,
            },
          }),
        });

        if (!r.ok) {
          const t = await r.text().catch(() => '');
          return new Response(`Gemini error ${r.status}: ${t}`, { status: 500, headers: corsHeaders });
        }

        const data = await r.json().catch(() => null);
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = Array.isArray(parts)
          ? parts.map((p) => String(p?.text || '')).join('').trim()
          : '';

        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }

      if (provider === 'anthropic') {
        const sys = messages.find((m) => m?.role === 'system')?.content || '';
        const chat = messages
          .filter((m) => m?.role === 'user' || m?.role === 'assistant')
          .map((m) => ({ role: m.role, content: String(m.content || '') }));

        const model = env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';

        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
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
          return new Response(`Anthropic error ${r.status}: ${t}`, { status: 500, headers: corsHeaders });
        }

        const data = await r.json();
        const text = (data?.content || [])
          .map((p) => (p?.type === 'text' ? p.text : ''))
          .join('')
          .trim();

        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }

      // Default: OpenAI Chat Completions
      const model = env.OPENAI_MODEL || 'gpt-4o-mini';

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
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
        return new Response(`OpenAI error ${r.status}: ${t}`, { status: 500, headers: corsHeaders });
      }

      const data = await r.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();

      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    } catch (e) {
      return new Response(`Proxy exception: ${String(e?.message || e)}`, { status: 500, headers: corsHeaders });
    }
  },
};
