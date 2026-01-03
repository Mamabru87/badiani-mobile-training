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
// - ALLOWED_ORIGIN (optional)  ("*" or comma-separated origins)
// - RATE_LIMIT_MAX (optional)  (default 30) POST requests per window
// - RATE_LIMIT_WINDOW_SEC (optional) (default 60)
// - ACCESS_CODES (optional) (comma/newline-separated). If set, requires header: x-berny-access-code
//
// Phone verification (optional, for site access gating):
// - REQUIRE_SITE_VERIFICATION (optional) '1'|'true' to require x-badiani-auth for POST /berny
// - AUTH_TOKEN_SECRET (required if REQUIRE_SITE_VERIFICATION is enabled) HMAC secret used to sign tokens
// - AUTH_TOKEN_TTL_DAYS (optional) default 30
// - PHONE_HASH_PEPPER (recommended) secret pepper for hashing phone numbers
// - EMPLOYEE_REGISTRY (recommended) KV binding where keys are phone hashes and values are '1'
// - ALLOWED_PHONE_HASHES (fallback) comma/newline list of allowed phone hashes
// - OTP_STORE (recommended) KV binding used to store OTP challenges (short TTL)
// - OTP_TTL_SEC (optional) default 600
// - OTP_HASH_PEPPER (recommended) pepper for hashing OTPs
//
// SMS provider (Twilio Messaging):
// - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (required for sending SMS)

/**
 * Lightweight per-isolate rate limiting.
 * Notes:
 * - This is best-effort (memory resets on cold starts / deploys).
 * - Still useful to prevent accidental loops and casual abuse.
 */
const RATE_STATE = new Map();

function getClientIp(request) {
  // Cloudflare populates CF-Connecting-IP.
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;

  // Fallback (in case of proxies).
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return String(xff).split(',')[0].trim();

  return 'unknown';
}

function rateLimitCheck(request, env) {
  const max = Math.max(1, Number.parseInt(String(env.RATE_LIMIT_MAX || '30'), 10) || 30);
  const windowMs =
    Math.max(1, Number.parseInt(String(env.RATE_LIMIT_WINDOW_SEC || '60'), 10) || 60) * 1000;

  const ip = getClientIp(request);
  const now = Date.now();

  const existing = RATE_STATE.get(ip);
  const bucket =
    existing && now - existing.windowStart < windowMs
      ? existing
      : { windowStart: now, count: 0 };

  bucket.count += 1;
  RATE_STATE.set(ip, bucket);

  // Opportunistic cleanup to avoid unbounded growth.
  if (RATE_STATE.size > 2000) {
    for (const [k, v] of RATE_STATE) {
      if (!v || now - v.windowStart >= windowMs) RATE_STATE.delete(k);
    }
  }

  const remaining = Math.max(0, max - bucket.count);
  const limited = bucket.count > max;
  const retryAfterSec = limited ? Math.ceil((bucket.windowStart + windowMs - now) / 1000) : 0;

  return { limited, remaining, retryAfterSec };
}

function parseList(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s
    .split(/[,\n\r\t ]+/g)
    .map((x) => String(x || '').trim())
    .filter(Boolean);
}

function toBase64Url(bytes) {
  let str = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  for (let i = 0; i < arr.length; i += 1) str += String.fromCharCode(arr[i]);
  // btoa expects binary string
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(String(input || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSign(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(data || '')));
  return new Uint8Array(sig);
}

async function hmacVerify(secret, data, sigBytes) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(String(data || '')));
}

function normalizePhone(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  // If it's digits only (common input), assume Italy if it looks like a mobile.
  if (!s.startsWith('+') && /^\d+$/.test(s)) {
    if (s.length === 10 && s.startsWith('3')) s = `+39${s}`;
    else if (s.length === 12 && s.startsWith('39')) s = `+${s}`;
    else s = `+${s}`;
  }
  if (!/^\+\d{8,16}$/.test(s)) return '';
  return s;
}

async function isPhoneAllowed(phoneHash, env) {
  if (!phoneHash) return false;
  try {
    const kv = env.EMPLOYEE_REGISTRY;
    if (kv && typeof kv.get === 'function') {
      const v = await kv.get(phoneHash);
      return v != null;
    }
  } catch {}
  const list = parseList(env.ALLOWED_PHONE_HASHES);
  return list.includes(phoneHash);
}

async function issueAuthToken(phoneHash, env) {
  const secret = String(env.AUTH_TOKEN_SECRET || '').trim();
  if (!secret) throw new Error('Missing AUTH_TOKEN_SECRET');
  const now = Math.floor(Date.now() / 1000);
  const ttlDays = Math.max(1, Number.parseInt(String(env.AUTH_TOKEN_TTL_DAYS || '30'), 10) || 30);
  const exp = now + ttlDays * 24 * 60 * 60;
  const payload = { v: 1, sub: String(phoneHash), iat: now, exp };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = toBase64Url(new TextEncoder().encode(payloadJson));
  const sig = await hmacSign(secret, payloadB64);
  const sigB64 = toBase64Url(sig);
  return { token: `${payloadB64}.${sigB64}`, exp };
}

async function verifyAuthToken(token, env) {
  const secret = String(env.AUTH_TOKEN_SECRET || '').trim();
  if (!secret) return null;
  const t = String(token || '').trim();
  const [payloadB64, sigB64] = t.split('.');
  if (!payloadB64 || !sigB64) return null;
  let payload;
  try {
    const bytes = fromBase64Url(payloadB64);
    const json = new TextDecoder().decode(bytes);
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  try {
    const ok = await hmacVerify(secret, payloadB64, fromBase64Url(sigB64));
    if (!ok) return null;
  } catch {
    return null;
  }
  const exp = payload?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function sendSmsTwilio({ to, body }, env) {
  const sid = String(env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(env.TWILIO_AUTH_TOKEN || '').trim();
  const from = String(env.TWILIO_FROM || '').trim();
  if (!sid || !token || !from) throw new Error('Missing Twilio env vars');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', String(to));
  form.set('From', String(from));
  form.set('Body', String(body));

  const auth = btoa(`${sid}:${token}`);
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: form.toString(),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Twilio error ${r.status}: ${t}`);
  }
}

export default {
  async fetch(request, env) {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname || '/';
    const origin = request.headers.get('Origin') || '';

    // CORS allowlist
    const allowedRaw = String(env.ALLOWED_ORIGIN || '*').trim();
    const allowAll = allowedRaw === '*';
    const allowedSet = allowAll
      ? null
      : new Set(
          allowedRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );

    const isCorsRequest = !!origin;
    const isAllowedOrigin =
      allowAll || (!isCorsRequest ? true : allowedSet && allowedSet.has(origin));

    // CORS: never reflect arbitrary origins.
    // - If ALLOWED_ORIGIN is '*', allow all.
    // - Else: allow only listed origins.
    // - Non-CORS requests (no Origin header) are allowed (e.g. opening /models in the browser address bar).
    const allowOriginHeader = allowAll
      ? '*'
      : isCorsRequest && isAllowedOrigin
        ? origin
        : Array.from(allowedSet || [])[0] || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOriginHeader,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Berny-Access-Code, X-Badiani-Auth',
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

    // Normalize path so routes work both at root and under /berny/*
    const path = pathname.startsWith('/berny/') ? `/${pathname.slice('/berny/'.length)}` : pathname;

    // ============================================================
    // AUTH (Phone OTP) endpoints
    // - POST /auth/request  { phone }
    // - POST /auth/verify   { phone, code }
    // ============================================================
    if (request.method === 'POST' && (path === '/auth/request' || path === '/auth/verify')) {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Bad JSON', { status: 400, headers: corsHeaders });
      }

      const pepper = String(env.PHONE_HASH_PEPPER || '').trim();
      const otpPepper = String(env.OTP_HASH_PEPPER || '').trim();
      const otpStore = env.OTP_STORE;

      const phone = normalizePhone(body?.phone);
      if (!phone) return new Response('Invalid phone', { status: 400, headers: corsHeaders });
      const phoneHash = await sha256Hex(`${phone}|${pepper}`);

      const allowed = await isPhoneAllowed(phoneHash, env);
      if (!allowed) return new Response('Not Found', { status: 404, headers: corsHeaders });

      if (!otpStore || typeof otpStore.get !== 'function' || typeof otpStore.put !== 'function') {
        return new Response('Missing OTP_STORE KV binding', { status: 500, headers: corsHeaders });
      }

      const otpTtlSec = Math.max(60, Number.parseInt(String(env.OTP_TTL_SEC || '600'), 10) || 600);

      if (path === '/auth/request') {
        // Simple per-phone cooldown (60s)
        try {
          const last = await otpStore.get(`otp_req:${phoneHash}`);
          if (last) return new Response('Too Many Requests', { status: 429, headers: corsHeaders });
        } catch {}

        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const otp = String(buf[0] % 100000).padStart(5, '0');
        const otpHash = await sha256Hex(`${phoneHash}|${otp}|${otpPepper}`);

        await otpStore.put(`otp:${phoneHash}`, otpHash, { expirationTtl: otpTtlSec });
        await otpStore.put(`otp_req:${phoneHash}`, '1', { expirationTtl: 60 });

        // Send SMS
        await sendSmsTwilio(
          {
            to: phone,
            body: `Badiani Training: il tuo codice di verifica è ${otp}. Valido per ${Math.ceil(otpTtlSec / 60)} minuti.`,
          },
          env
        );

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }

      // /auth/verify
      const code = String(body?.code || '').trim();
      if (!/^\d{5}$/.test(code)) return new Response('Invalid code', { status: 400, headers: corsHeaders });

      const stored = await otpStore.get(`otp:${phoneHash}`);
      if (!stored) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      const check = await sha256Hex(`${phoneHash}|${code}|${otpPepper}`);
      if (String(stored) !== String(check)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

      try { await otpStore.delete(`otp:${phoneHash}`); } catch {}
      try { await otpStore.delete(`otp_req:${phoneHash}`); } catch {}

      let issued;
      try {
        issued = await issueAuthToken(phoneHash, env);
      } catch (e) {
        return new Response(`Auth token error: ${String(e?.message || e)}`, { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ ok: true, token: issued.token, exp: issued.exp }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
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

    // Optional site verification gate (for POST /berny). This does NOT protect static HTML,
    // but it blocks privileged actions behind the Worker (e.g. Berny proxy).
    const requireSiteVerification = ['1', 'true', 'yes', 'on'].includes(String(env.REQUIRE_SITE_VERIFICATION || '').trim().toLowerCase());
    if (requireSiteVerification) {
      const token = String(request.headers.get('x-badiani-auth') || '').trim();
      const payload = await verifyAuthToken(token, env);
      if (!payload) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
    }

    // Optional access gate
    const allowedCodes = parseList(env.ACCESS_CODES);
    if (allowedCodes.length) {
      const code = String(request.headers.get('x-berny-access-code') || '').trim();
      const ok = code && allowedCodes.includes(code);
      if (!ok) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
    }

    // Rate limit only chat POSTs (keep GET /health and GET /models convenient to open).
    const rl = rateLimitCheck(request, env);
    if (rl.limited) {
      const headers = {
        ...corsHeaders,
        'Retry-After': String(rl.retryAfterSec || 1),
        'content-type': 'text/plain; charset=utf-8',
      };
      return new Response('Too Many Requests', { status: 429, headers });
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
