// netlify/functions/sql.js
// BigQuery SQL proxy for the frontend. Accepts POST { q, params } and returns { rows } or { geojson }.
// Uses a Service Account JSON stored in an env var.

import { BigQuery } from '@google-cloud/bigquery';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { q, params = {} } = body;

    if (!q) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing SQL (q)' }) };
    }

    // Auth: service account JSON placed in env var GOOGLE_SERVICE_ACCOUNT_JSON
    const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!sa) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_JSON' }) };
    }
    
    let credentials;
    try {
      credentials = JSON.parse(sa);
    } catch (parseError) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Invalid service account JSON format' }) };
    }
    
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      credentials
    });

    // BigQuery parameter binding
    const bqParams = [];
    const paramTypes = [];
    for (const [name, value] of Object.entries(params)) {
      // Handle different parameter types
      if (typeof value === 'number') {
        bqParams.push({ name, parameterType: { type: Number.isInteger(value) ? 'INT64' : 'FLOAT64' }, parameterValue: { value: String(value) } });
        paramTypes.push({ name, type: Number.isInteger(value) ? 'INT64' : 'FLOAT64' });
      } else if (Array.isArray(value)) {
        // Handle array parameters (for IN UNNEST queries)
        bqParams.push({ 
          name, 
          parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } }, 
          parameterValue: { arrayValues: value.map(v => ({ value: String(v) })) } 
        });
        paramTypes.push({ name, type: 'ARRAY<STRING>' });
      } else {
        // All string parameters including polygon_geojson
        bqParams.push({ name, parameterType: { type: 'STRING' }, parameterValue: { value: String(value) } });
        paramTypes.push({ name, type: 'STRING' });
      }
    }

    const [job] = await bigquery.createQueryJob({
      query: q,
      location: process.env.BQ_LOCATION || 'US',
      parameterMode: 'NAMED',
      queryParameters: bqParams
    });

    const [rows] = await job.getQueryResults({ maxResults: 200000 });

    // If the query returned a "geom_json" column, convert to GeoJSON FeatureCollection
    if (rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'geom_json')) {
      const features = rows.map((r) => ({
        type: 'Feature',
        geometry: JSON.parse(r.geom_json),
        properties: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'geom_json'))
      }));
      const fc = { type: 'FeatureCollection', features };
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geojson: fc, count: features.length })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
