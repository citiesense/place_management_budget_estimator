// netlify/functions/sql.js
// Proxies SQL to CARTO DW (BigQuery) with proper CORS + error messages.

export default async (req, context) => {
  const { CARTO_SQL_BASE, CARTO_CONN, CARTO_API_KEY } = process.env;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const body = await req.json();
    const q = body?.q;
    if (!q) {
      return new Response(JSON.stringify({ error: 'Missing SQL: body.q' }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Validate env
    if (!CARTO_SQL_BASE || !CARTO_CONN || !CARTO_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Missing env vars', details: { CARTO_SQL_BASE: !!CARTO_SQL_BASE, CARTO_CONN: !!CARTO_CONN, CARTO_API_KEY: !!CARTO_API_KEY }
      }), {
        status: 500,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const url = `${CARTO_SQL_BASE.replace(/\/$/,'')}/${encodeURIComponent(CARTO_CONN)}/query`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${CARTO_API_KEY}`
      },
      body: JSON.stringify({ q })
    });

    const text = await upstream.text();
    const isJson = upstream.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? JSON.parse(text) : { raw: text };
    const status = upstream.status;

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Upstream SQL error', status, payload }), {
        status,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', details: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
