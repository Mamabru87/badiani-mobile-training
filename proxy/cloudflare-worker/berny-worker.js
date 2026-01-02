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
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname || '/';
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';

    const isCorsRequest = !!origin;
    const isAllowedOrigin = allowed === '*' || (!isCorsRequest ? true : origin === allowed);

    // CORS: do not reflect arbitrary origins.
    // - If ALLOWED_ORIGIN is '*', allow all.
    // - If ALLOWED_ORIGIN is set, only allow that exact Origin on CORS requests.
    // - Non-CORS requests (no Origin header) are still allowed (e.g. opening /models in the browser address bar).
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };

    if (!isAllowedOrigin) {
      // Block browser-based calls coming from untrusted origins.
      return new Response('Forbidden (CORS)', { status: 403, headers: corsHeaders });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health endpoint (no secrets). Useful to confirm routing + provider.
    // Usage: open https://<worker>.workers.dev/health in the browser.
    if (request.method === 'GET' && (pathname === '/health' || pathname === '/health/' || pathname === '/berny/health' || pathname === '/berny/health/')) {
      const provider = String(env.PROVIDER || 'openai').toLowerCase();
      return new Response(JSON.stringify({ ok: true, provider }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Helper endpoint: list available Gemini models for this API key.
    // Usage: open https://<worker>.workers.dev/models in the browser.
    if (request.method === 'GET' && (pathname === '/models' || pathname === '/models/' || pathname === '/berny/models' || pathname === '/berny/models/')) {
      const key = env.GEMINI_API_KEY;
      if (!key) {
        return new Response('Missing GEMINI_API_KEY', { status: 500, headers: corsHeaders });
      }

      const listV1beta = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const listV1 = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`;

      let r = await fetch(listV1beta);
      if (!r.ok && r.status === 404) {
        r = await fetch(listV1);
      }

      const text = await r.text().catch(() => '');
      return new Response(text, {
        status: r.ok ? 200 : 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
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

        // Gemini model names may be provided either as "gemini-…" or "models/gemini-…".
        // Also, some accounts expose models differently between v1beta and v1.
        const rawModel = String(env.GEMINI_MODEL || 'gemini-1.5-flash-latest');
        const model = rawModel.replace(/^models\//i, '');
        const key = env.GEMINI_API_KEY;

        if (!key) {
          return new Response('Missing GEMINI_API_KEY', { status: 500, headers: corsHeaders });
        }

        const payload = {
          systemInstruction: sys ? { parts: [{ text: String(sys) }] } : undefined,
          contents: chat,
          generationConfig: {
            temperature: 0.6,
            // Give the model enough room to finish a thought.
            // The system prompt already asks for short answers.
            maxOutputTokens: 512,
          },
        };

        const urlV1beta = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
        const urlV1 = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

        let r = await fetch(urlV1beta, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // If the model isn't available on v1beta (common 404), retry against v1.
        if (!r.ok && r.status === 404) {
          r = await fetch(urlV1, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.log('Gemini upstream error', r.status);
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
          console.log('Anthropic upstream error', r.status);
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
        console.log('OpenAI upstream error', r.status);
        return new Response(`OpenAI error ${r.status}: ${t}`, { status: 500, headers: corsHeaders });
      }

      const data = await r.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();

      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    } catch (e) {
      console.log('Proxy exception', String(env.PROVIDER || 'openai').toLowerCase());
      return new Response(`Proxy exception: ${String(e?.message || e)}`, { status: 500, headers: corsHeaders });
    }
  },
};
