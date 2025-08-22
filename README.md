# Place Management Budget Estimator

Professional BID budget analysis tool with interactive mapping, industry-standard calculations, and board-ready PDF reports. Draw polygons to analyze business districts and generate comprehensive budget estimates based on Overture Maps data.

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

## Key Features

### 📊 Enhanced Reporting
- **Executive Summary**: Board-ready metrics and visualizations
- **Service Details**: Cleaning, safety, marketing, and streetscape breakdowns
- **Interactive Parameters**: Real-time budget adjustments with sliders
- **PDF Export**: Professional 2-page reports for board presentations
- **📧 Email Sharing**: Send reports directly to stakeholders with professional email templates

### 🎯 Industry-Standard Calculations
- Service intensity modeling based on business mix
- Category-weighted factors (restaurants need more cleaning, entertainment drives night economy)
- Streetscape asset depreciation (trash cans, planters, banners)
- Staffing estimates with supervisor ratios
- Customizable parameters for local conditions

### 🗺️ Smart District Analysis
- Automatic place typology detection (Retail Core, Dining District, Mixed-Use, etc.)
- Service demand indicators based on density and business composition
- Priority recommendations for resource allocation
- Economic diversity scoring for resilience assessment

## Development Notes
- Uses BigQuery spatial queries with Overture Maps data
- Netlify Functions for secure server-side processing
- React + TypeScript + Mapbox GL for interactive mapping
- jsPDF for professional PDF generation
