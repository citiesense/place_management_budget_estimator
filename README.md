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
   - `CARTO_SQL_BASE` = `https://ginkgo.carto.com/v3/sql`
   - `CARTO_CONN` = `ginkgo.carto_dw`
   - `CARTO_API_KEY` = `***`
   - `VITE_SQL_PROXY` = `/api/sql`
   - `VITE_PLACES_TABLE` = `carto_overture_geography_glo_places_v3`
   - `VITE_BUILDINGS_TABLE` = `carto_overture_geography_glo_building_v3`
   - `VITE_SEGMENTS_TABLE` = `sub_overture_geography_glo_transportationsegment_v3`

Netlify serves the app from `dist/` and proxies `POST /api/sql` to a serverless function that hits CARTO with your key.

## Notes
- Intersections are estimated by snapping segment endpoints into nodes and counting degree ≥ 3.
- Coefficients can be tweaked in the Advanced drawer.
