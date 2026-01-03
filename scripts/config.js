// FILE: scripts/config.js
// Global runtime configuration for the static site.
// Keep secrets OUT of the frontend.

(() => {
  // Berny proxy endpoint (Cloudflare Worker). Must be public.
  // NOTE: the Worker hides the provider API keys in env vars.
  window.BERNY_PROXY_ENDPOINT = window.BERNY_PROXY_ENDPOINT || 'https://autumn-boat-f7a0badiani-berny-proxy.marco-bruzzi.workers.dev/berny';

  // Optional explicit auth base endpoint. If omitted, the client derives it from BERNY_PROXY_ENDPOINT.
  // Example: 'https://<worker>.workers.dev'
  window.BADIANI_AUTH_ENDPOINT = window.BADIANI_AUTH_ENDPOINT || '';
})();
