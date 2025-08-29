// BID List API Endpoint
// Returns list of available BIDs for selection dropdown
//
// GET /api/bid-list
// Returns: Array of BID objects with id, name, city, state, area

const { BigQuery } = require('@google-cloud/bigquery');

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  try {
    // Initialize BigQuery
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: serviceAccount,
    });

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const city = params.city;
    const state = params.state;
    const search = params.search;
    const limit = parseInt(params.limit) || 100;

    // Build WHERE clauses
    let whereConditions = ['is_active = TRUE'];
    let sqlParams = {};

    if (city) {
      whereConditions.push('LOWER(city) = LOWER(@city)');
      sqlParams.city = city;
    }

    if (state) {
      whereConditions.push('LOWER(state) = LOWER(@state)'); 
      sqlParams.state = state;
    }

    if (search) {
      whereConditions.push('(LOWER(bid_name) LIKE LOWER(@search) OR LOWER(bid_short_name) LIKE LOWER(@search))');
      sqlParams.search = `%${search}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query for BID list with basic metrics
    const sql = `
      SELECT 
        ba.bid_id,
        ba.bid_name,
        ba.bid_short_name,
        ba.city,
        ba.state,
        ba.area_sq_miles,
        ba.annual_budget_usd,
        ba.established_date,
        ba.centroid,
        
        -- Latest data freshness
        MAX(bsr.calculated_at) as last_data_refresh,
        
        -- Quick metrics (raw data)
        ANY_VALUE(CASE WHEN bsr.calculation_type = 'raw' THEN bsr.total_segments END) as total_segments,
        ANY_VALUE(CASE WHEN bsr.calculation_type = 'raw' THEN bsr.total_length_miles END) as total_length_miles,
        ANY_VALUE(CASE WHEN bsr.calculation_type = 'deduplicated' THEN bsr.total_segments END) as dedup_segments,
        
        -- Places count
        bpr.total_places
        
      FROM \`ginkgo-map-data.overture_na.bid_areas\` ba
      LEFT JOIN \`ginkgo-map-data.overture_na.bid_segments_rollup\` bsr
        ON ba.bid_id = bsr.bid_id
      LEFT JOIN \`ginkgo-map-data.overture_na.bid_places_rollup\` bpr
        ON ba.bid_id = bpr.bid_id
      ${whereClause}
      GROUP BY ba.bid_id, ba.bid_name, ba.bid_short_name, ba.city, ba.state, 
               ba.area_sq_miles, ba.annual_budget_usd, ba.established_date, 
               ba.centroid, bpr.total_places
      ORDER BY ba.bid_name
      LIMIT @limit
    `;

    sqlParams.limit = limit;

    // Execute query
    const [rows] = await bigquery.query({
      query: sql,
      params: sqlParams,
    });

    // Format results
    const bids = rows.map(row => ({
      bid_id: row.bid_id,
      name: row.bid_name,
      short_name: row.bid_short_name,
      display_name: row.bid_short_name || row.bid_name,
      city: row.city,
      state: row.state,
      location: `${row.city}, ${row.state}`,
      
      // Area info
      area_sq_miles: row.area_sq_miles ? parseFloat(row.area_sq_miles.toFixed(2)) : null,
      
      // Budget info (if available)
      annual_budget_usd: row.annual_budget_usd,
      established_year: row.established_date ? new Date(row.established_date).getFullYear() : null,
      
      // Quick metrics
      total_segments: row.total_segments,
      total_length_miles: row.total_length_miles ? parseFloat(row.total_length_miles.toFixed(1)) : null,
      dedup_segments: row.dedup_segments,
      total_places: row.total_places,
      
      // Data freshness
      last_data_refresh: row.last_data_refresh,
      data_available: !!(row.total_segments && row.total_places),
      
      // Centroid for map display
      centroid: row.centroid ? {
        type: 'Point',
        coordinates: [
          parseFloat(row.centroid.value.split(' ')[0].replace('POINT(', '')),
          parseFloat(row.centroid.value.split(' ')[1].replace(')', ''))
        ]
      } : null
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bids: bids,
        total_count: bids.length,
        filters: {
          city: city || null,
          state: state || null,
          search: search || null
        }
      }),
    };

  } catch (error) {
    console.error('Error fetching BID list:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch BID list',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};