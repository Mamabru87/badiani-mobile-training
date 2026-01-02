# Berny → API proxy (sicuro)

Questo progetto è un sito statico: **non mettere mai API key nel frontend**.

Qui trovi due esempi pronti (copy/paste) per nascondere la key:

- `api/berny.js` → Vercel Serverless Function
- `proxy/cloudflare-worker/berny-worker.js` → Cloudflare Worker

## Payload atteso (dal frontend)

Il frontend (vedi `scripts/berny-brain-api.js`) invia:

```json
{
  "intent": "product_info",
  "userContext": {"nickname":"...","language":"it"},
  "messages": [{"role":"system","content":"..."},{"role":"user","content":"..."}]
}
```

Il proxy deve rispondere:

```json
{ "text": "risposta..." }
```

## Configurazione frontend

Imposta via DevTools Console:

```js
localStorage.setItem('badianiBerny.config.v1', JSON.stringify({
  provider: 'proxy',
  proxyEndpoint: '/api/berny'
}));
```

> Se usi Cloudflare Worker su dominio diverso, metti l’URL completo.

## Variabili ambiente

Esempio (vedi `.env` / `.env.example`):

- `PROVIDER=openai|anthropic|gemini`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `ALLOWED_ORIGIN` (CORS)
