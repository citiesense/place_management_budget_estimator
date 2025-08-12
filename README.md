# Place Management Budget Estimator (CARTO + deck.gl)

Estimate a BID/place-management budget from **urban context** (businesses, intersections, area, optional GFA) by drawing a polygon. Uses CARTO v3 SQL API against your BigQuery Overture tables.

## Local dev
```bash
npm i
npm run dev
```

Create `.env` from `.env.example` for local env if you want to call CARTO directly (not required when using Netlify proxy).

## Netlify deploy (recommended)
1) Connect this repo in Netlify → set Build: `npm run build` and Publish dir: `dist`
2) Set **Environment variables** in Netlify (Production context):

```
# Server-side (set only in Netlify UI; do not commit values)
CARTO_SQL_BASE=__SET_IN_NETLIFY_ENV__
CARTO_CONN=__SET_IN_NETLIFY_ENV__

# Public values (safe in client bundle)
VITE_SQL_PROXY=/.netlify/functions/sql
VITE_PLACES_TABLE=__PUBLIC_TABLE_NAME__
VITE_BUILDINGS_TABLE=__PUBLIC_TABLE_NAME__
VITE_SEGMENTS_TABLE=__PUBLIC_TABLE_NAME__
```

Netlify serves the app from `dist/` and proxies `POST /api/sql` to a serverless function that hits CARTO with your key.

## Notes
- Intersections are estimated by snapping segment endpoints into nodes and counting degree ≥ 3.
- Coefficients can be tweaked in the Advanced drawer.
