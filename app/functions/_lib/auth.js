// Bearer-token gate shared across all dashboard-facing endpoints.
//
// The dashboard ships with a token (VITE_DASHBOARD_TOKEN) and sends it on every
// request. The Function checks it against DASHBOARD_TOKEN in CF Pages env vars.
// They MUST be the same value — set both at deploy time.
//
// This token is in the client bundle (read it via DevTools), so it isn't a
// secret in the cryptographic sense — it's a bot deterrent + the gate that
// makes accidental crawlers / scrapers get a 401 instead of consuming our
// Google API quota. The Functions also enforce CORS so a malicious page can't
// read responses with the token.

export function checkAuth(request, env) {
  if (!env.DASHBOARD_TOKEN) {
    return new Response(JSON.stringify({ error: 'server misconfigured: DASHBOARD_TOKEN unset' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${env.DASHBOARD_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  return null; // ok
}

// Build CORS headers if the request origin is allowlisted. Set ALLOW_ORIGIN to
// a comma-separated list (e.g. "https://yourapp.pages.dev,http://localhost:5173").
export function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  const allowed = (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '600',
    'vary': 'origin',
  };
}

export function json(body, init = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
      ...extraHeaders,
    },
  });
}
