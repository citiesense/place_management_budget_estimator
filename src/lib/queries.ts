// src/lib/queries.ts
// Parameterized SQL for Places-in-polygon from BigQuery Overture slice.

const PROJECT = 'ginkgo-map-data';
const DATASET = 'overture_na';
const PLACES = 'place';

export function placesWithinPolygonSQL() {
  return `
    WITH poly AS (
      SELECT ST_GEOGFROMGEOJSON(@polygon_geojson) AS g
    )
    SELECT
      id,
      SAFE_OFFSET(categories, 0) AS category,         -- first category if present
      JSON_VALUE(names, '$.primary') AS name,         -- Overture names is JSON; adjust if your schema differs
      ST_ASGEOJSON(geometry) AS geom_json
    FROM \`${PROJECT}.${DATASET}.${PLACES}\`, poly
    WHERE ST_INTERSECTS(geometry, poly.g)
  `;
}
