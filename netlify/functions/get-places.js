import {BigQuery} from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATASET = 'overture_na';
const PLACES = 'place';

const bq = new BigQuery();

export async function handler(event) {
  const polygon_geojson = JSON.parse(event.body).polygon_geojson;

  const sql = `
    WITH poly AS (
      SELECT ST_GEOGFROMGEOJSON(@polygon_geojson) AS g
    )
    SELECT
      id,
      SAFE_OFFSET(categories, 0) AS category,
      JSON_VALUE(names, '$.primary') AS name,
      ST_ASGEOJSON(geometry) AS geom_json
    FROM \`${PROJECT_ID}.${DATASET}.${PLACES}\`, poly
    WHERE ST_INTERSECTS(geometry, poly.g)
  `;

  const options = {
    query: sql,
    params: { polygon_geojson },
    location: 'US'
  };

  const [job] = await bq.createQueryJob(options);
  const [rows] = await job.getQueryResults();

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
}
