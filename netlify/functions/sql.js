export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const CARTO_SQL_BASE = process.env.CARTO_SQL_BASE;
  const CARTO_CONN = process.env.CARTO_CONN || 'bigquery';
  const CARTO_API_KEY = process.env.CARTO_API_KEY;
  if (!CARTO_SQL_BASE || !CARTO_API_KEY) {
    return { statusCode: 500, body: 'Missing CARTO env vars' };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    const url = `${CARTO_SQL_BASE}/${CARTO_CONN}/query`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CARTO_API_KEY}` },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    return { statusCode: r.status, body: text, headers: { 'Content-Type': 'application/json' } };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
}
