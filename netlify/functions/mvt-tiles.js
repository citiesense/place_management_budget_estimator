/**
 * Phase 4: MVT Tile Server Implementation
 * Netlify Function for serving vector tiles (MVT) from BigQuery
 * 
 * Endpoint: /.netlify/functions/mvt-tiles/{z}/{x}/{y}.mvt
 * Query params: classes
 */

const { BigQuery } = require('@google-cloud/bigquery');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
});

// Cache configuration
const CACHE_TTL_MINUTES = 15;
const CACHE_TTL_SECONDS = CACHE_TTL_MINUTES * 60;
const MAX_TILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB limit for Netlify functions
const ENABLE_BROWSER_CACHE = true;

/**
 * Parse tile coordinates from URL path
 */
function parseTileCoords(path) {
  // Expected format: /mvt-tiles/14/4829/6160.mvt
  const match = path.match(/\/mvt-tiles\/(\d+)\/(\d+)\/(\d+)\.mvt$/);
  if (!match) {
    throw new Error('Invalid tile URL format. Expected: /mvt-tiles/{z}/{x}/{y}.mvt');
  }
  
  return {
    z: parseInt(match[1]),
    x: parseInt(match[2]), 
    y: parseInt(match[3])
  };
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(queryStringParameters) {
  const params = queryStringParameters || {};
  
  return {
    classes: params.classes ? params.classes.split(',').map(c => c.trim()) : [],
    format: params.format || 'mvt'  // Support for debugging with 'json'
  };
}

/**
 * Generate cache key for tile
 */
function generateCacheKey(z, x, y, classes) {
  const classesHash = classes.length > 0 ? classes.sort().join(',') : 'all';
  return `tile_${z}_${x}_${y}_${classesHash}`;
}

/**
 * Execute BigQuery MVT generation  
 */
async function generateMVTTile(z, x, y, classes) {
  try {
    const query = `
      SELECT \`ginkgo-map-data.overture_na.get_cached_mvt_tile\`(
        @zoom_level,
        @tile_x, 
        @tile_y,
        @bid_id,
        @road_classes,
        @use_deduplication
      ) AS mvt_data
    `;

    const options = {
      query,
      params: {
        zoom_level: z,
        tile_x: x,
        tile_y: y,
        road_classes: classes,
      }
    };

    // Generating MVT tile
    
    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    
    if (rows && rows.length > 0 && rows[0].mvt_data) {
      return rows[0].mvt_data;
    } else {
      // Return empty MVT tile
      // No data found, returning empty tile
      return Buffer.alloc(0);
    }
    
  } catch (error) {
    // BigQuery MVT generation failed
    throw new Error(`Tile generation failed: ${error.message}`);
  }
}

/**
 * Generate GeoJSON for debugging (when format=json)
 */
async function generateGeoJSONTile(z, x, y, classes) {
  try {
    const query = `
      WITH 
      tile_bounds AS (
        SELECT ST_TILEENVELOPE(@zoom_level, @tile_x, @tile_y) AS tile_geom
      ),
      segments_in_tile AS (
        SELECT 
          s.segment_id,
          s.name,
          s.class,
          s.subclass,
          s.geometry,
          s.length_meters
        FROM \`ginkgo-map-data.overture_na.segment_view\` s
        CROSS JOIN tile_bounds tb
        WHERE (ARRAY_LENGTH(@road_classes) = 0 OR s.class IN UNNEST(@road_classes))
          AND ST_INTERSECTS(s.geometry, tb.tile_geom)
        LIMIT 1000
      )
      SELECT 
        JSON_OBJECT(
          'type', 'FeatureCollection',
          'features', ARRAY(
            SELECT JSON_OBJECT(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geometry),
              'properties', JSON_OBJECT(
                'id', segment_id,
                'name', name,
                'class', class,
                'subclass', subclass,
                'length_m', ROUND(length_meters, 2)
              )
            )
            FROM segments_in_tile
          )
        ) AS geojson
    `;

    const options = {
      query,
      params: {
        zoom_level: z,
        tile_x: x,
        tile_y: y,
        bid_id: bidId,
        road_classes: classes
      }
    };

    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    
    return rows && rows.length > 0 ? JSON.parse(rows[0].geojson) : {
      type: 'FeatureCollection',
      features: []
    };
    
  } catch (error) {
    // GeoJSON generation failed
    return {
      type: 'FeatureCollection', 
      features: [],
      error: error.message
    };
  }
}

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Handle conditional requests with ETag
  const ifNoneMatch = event.headers['if-none-match'];
  if (ifNoneMatch) {
    const coords = parseTileCoords(event.path);
    const params = parseQueryParams(event.queryStringParameters);
    const etag = generateCacheKey(coords.z, coords.x, coords.y, params.classes);
    
    if (ifNoneMatch === etag) {
      return {
        statusCode: 304,
        headers: {
          ...headers,
          'ETag': etag,
          'Cache-Control': ENABLE_BROWSER_CACHE ? `public, max-age=${CACHE_TTL_SECONDS}` : 'no-cache'
        },
        body: ''
      };
    }
  }

  try {
    // Parse tile coordinates from path
    const coords = parseTileCoords(event.path);
    const { z, x, y } = coords;
    
    // Validate zoom level
    if (z < 8 || z > 18) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid zoom level. Must be between 8 and 18.',
          zoom: z
        })
      };
    }

    // Parse query parameters
    const params = parseQueryParams(event.queryStringParameters);
    const { classes, format } = params;
    
    // Processing MVT tile request

    // Generate response based on format
    if (format === 'json') {
      // Return GeoJSON for debugging
      const geoJson = await generateGeoJSONTile(z, x, y, classes);
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Cache-Control': ENABLE_BROWSER_CACHE ? `public, max-age=${CACHE_TTL_SECONDS}` : 'no-cache',
          'ETag': generateCacheKey(z, x, y, classes)
        },
        body: JSON.stringify(geoJson, null, 2)
      };
      
    } else {
      // Return MVT binary data
      const mvtData = await generateMVTTile(z, x, y, classes);
      
      // Check tile size
      if (mvtData.length > MAX_TILE_SIZE_BYTES) {
        // Large tile size detected
      }
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/vnd.mapbox-vector-tile',
          'Content-Encoding': 'gzip', 
          'Cache-Control': ENABLE_BROWSER_CACHE ? `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=86400` : 'no-cache',
          'Content-Length': mvtData.length.toString(),
          'ETag': generateCacheKey(z, x, y, classes),
          'Vary': 'Accept-Encoding'
        },
        body: mvtData.toString('base64'),
        isBase64Encoded: true
      };
    }

  } catch (error) {
    // MVT tile server error
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Tile generation failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};