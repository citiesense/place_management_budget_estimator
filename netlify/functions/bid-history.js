// BID History API Endpoint
// Returns historical data and trends for a specific BID
//
// GET /api/bid-history?bid_id=BID_001&period=1year&metric=segments

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

    // Parse and validate parameters
    const params = event.queryStringParameters || {};
    const bidId = params.bid_id;
    const period = params.period || '1year'; // '3months', '6months', '1year', '2years', 'all'
    const metric = params.metric || 'all'; // 'segments', 'places', 'all'

    if (!bidId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'bid_id parameter is required' }),
      };
    }

    // Calculate date range based on period
    let dateFilter = '';
    const today = new Date();
    
    switch (period) {
      case '3months':
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        dateFilter = `AND calculated_at >= '${threeMonthsAgo.toISOString().split('T')[0]}'`;
        break;
      case '6months':
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        dateFilter = `AND calculated_at >= '${sixMonthsAgo.toISOString().split('T')[0]}'`;
        break;
      case '1year':
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        dateFilter = `AND calculated_at >= '${oneYearAgo.toISOString().split('T')[0]}'`;
        break;
      case '2years':
        const twoYearsAgo = new Date(today);
        twoYearsAgo.setFullYear(today.getFullYear() - 2);
        dateFilter = `AND calculated_at >= '${twoYearsAgo.toISOString().split('T')[0]}'`;
        break;
      case 'all':
      default:
        dateFilter = '';
        break;
    }

    const queries = [];

    // BID basic info and boundary changes
    const bidInfoSql = `
      SELECT 
        ba.bid_id,
        ba.bid_name,
        ba.bid_short_name,
        ba.area_sq_miles,
        ba.established_date,
        ba.created_at as bid_created,
        ba.updated_at as bid_updated,
        
        -- Historical boundary changes
        COUNT(bah.history_id) as boundary_changes,
        MIN(bah.effective_date) as first_boundary_change,
        MAX(bah.effective_date) as latest_boundary_change
        
      FROM \`ginkgo-map-data.overture_na.bid_areas\` ba
      LEFT JOIN \`ginkgo-map-data.overture_na.bid_areas_history\` bah
        ON ba.bid_id = bah.bid_id
      WHERE ba.bid_id = @bid_id AND ba.is_active = TRUE
      GROUP BY ba.bid_id, ba.bid_name, ba.bid_short_name, ba.area_sq_miles, 
               ba.established_date, ba.created_at, ba.updated_at
    `;
    queries.push(bigquery.query({ query: bidInfoSql, params: { bid_id: bidId } }));

    // Historical segments data (if requested)
    if (metric === 'all' || metric === 'segments') {
      const segmentsHistorySql = `
        SELECT 
          DATE(calculated_at) as calculation_date,
          calculation_type,
          total_segments,
          total_length_miles,
          segments_per_sq_mile,
          class_breakdown,
          calculated_at
        FROM \`ginkgo-map-data.overture_na.bid_segments_rollup\`
        WHERE bid_id = @bid_id ${dateFilter}
        ORDER BY calculated_at DESC
      `;
      queries.push(bigquery.query({ query: segmentsHistorySql, params: { bid_id: bidId } }));
    }

    // Historical places data (if requested)
    if (metric === 'all' || metric === 'places') {
      const placesHistorySql = `
        SELECT 
          DATE(calculated_at) as calculation_date,
          total_places,
          places_per_sq_mile,
          category_breakdown,
          calculated_at
        FROM \`ginkgo-map-data.overture_na.bid_places_rollup\`
        WHERE bid_id = @bid_id ${dateFilter}
        ORDER BY calculated_at DESC
      `;
      queries.push(bigquery.query({ query: placesHistorySql, params: { bid_id: bidId } }));
    }

    // Data refresh activity log
    const refreshLogSql = `
      SELECT 
        DATE(created_at) as refresh_date,
        operation_type,
        records_processed,
        duration_seconds,
        source_data_version,
        created_at
      FROM \`ginkgo-map-data.overture_na.data_refresh_log\`
      WHERE bid_id = @bid_id ${dateFilter.replace('calculated_at', 'created_at')}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    queries.push(bigquery.query({ query: refreshLogSql, params: { bid_id: bidId } }));

    // Execute all queries
    const results = await Promise.all(queries);
    
    const [bidInfoRows] = results[0];
    if (bidInfoRows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'BID not found or inactive' }),
      };
    }

    const bidInfo = bidInfoRows[0];
    let segmentsHistory = [];
    let placesHistory = [];
    let refreshLog = [];

    // Parse results based on which queries were run
    let resultIndex = 1;
    if (metric === 'all' || metric === 'segments') {
      const [segmentsRows] = results[resultIndex];
      segmentsHistory = segmentsRows;
      resultIndex++;
    }
    
    if (metric === 'all' || metric === 'places') {
      const [placesRows] = results[resultIndex];
      placesHistory = placesRows;
      resultIndex++;
    }

    const [refreshRows] = results[resultIndex];
    refreshLog = refreshRows;

    // Process segments historical data
    const segmentsTrends = {
      raw: segmentsHistory.filter(row => row.calculation_type === 'raw').map(row => ({
        date: row.calculation_date,
        total_segments: row.total_segments,
        total_length_miles: parseFloat(row.total_length_miles?.toFixed(2) || 0),
        segments_per_sq_mile: parseFloat(row.segments_per_sq_mile?.toFixed(1) || 0),
        class_breakdown: row.class_breakdown ? JSON.parse(row.class_breakdown) : null,
        calculated_at: row.calculated_at
      })),
      deduplicated: segmentsHistory.filter(row => row.calculation_type === 'deduplicated').map(row => ({
        date: row.calculation_date,
        total_segments: row.total_segments,
        total_length_miles: parseFloat(row.total_length_miles?.toFixed(2) || 0),
        segments_per_sq_mile: parseFloat(row.segments_per_sq_mile?.toFixed(1) || 0),
        class_breakdown: row.class_breakdown ? JSON.parse(row.class_breakdown) : null,
        calculated_at: row.calculated_at
      }))
    };

    // Process places historical data
    const placesTrends = placesHistory.map(row => ({
      date: row.calculation_date,
      total_places: row.total_places,
      places_per_sq_mile: parseFloat(row.places_per_sq_mile?.toFixed(1) || 0),
      category_breakdown: row.category_breakdown ? JSON.parse(row.category_breakdown) : null,
      calculated_at: row.calculated_at
    }));

    // Process refresh log
    const refreshActivity = refreshLog.map(row => ({
      date: row.refresh_date,
      operation: row.operation_type,
      records_processed: row.records_processed,
      duration_seconds: row.duration_seconds,
      source_version: row.source_data_version,
      timestamp: row.created_at
    }));

    // Calculate trends and changes
    const calculateTrend = (data, field) => {
      if (data.length < 2) return { change: null, percentage: null, trend: 'stable' };
      
      const latest = data[0][field];
      const previous = data[1][field];
      
      if (latest === null || previous === null) return { change: null, percentage: null, trend: 'stable' };
      
      const change = latest - previous;
      const percentage = previous !== 0 ? ((change / previous) * 100) : 0;
      const trend = change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable';
      
      return { change, percentage: parseFloat(percentage.toFixed(1)), trend };
    };

    const segmentsTrendAnalysis = {
      raw: {
        total_segments: calculateTrend(segmentsTrends.raw, 'total_segments'),
        total_length: calculateTrend(segmentsTrends.raw, 'total_length_miles'),
        density: calculateTrend(segmentsTrends.raw, 'segments_per_sq_mile')
      },
      deduplicated: {
        total_segments: calculateTrend(segmentsTrends.deduplicated, 'total_segments'),
        total_length: calculateTrend(segmentsTrends.deduplicated, 'total_length_miles'),
        density: calculateTrend(segmentsTrends.deduplicated, 'segments_per_sq_mile')
      }
    };

    const placesTrendAnalysis = {
      total_places: calculateTrend(placesTrends, 'total_places'),
      density: calculateTrend(placesTrends, 'places_per_sq_mile')
    };

    // Return comprehensive historical data
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bid_info: {
          bid_id: bidInfo.bid_id,
          name: bidInfo.bid_name,
          short_name: bidInfo.bid_short_name,
          area_sq_miles: bidInfo.area_sq_miles,
          established_date: bidInfo.established_date,
          boundary_changes: bidInfo.boundary_changes,
          first_boundary_change: bidInfo.first_boundary_change,
          latest_boundary_change: bidInfo.latest_boundary_change
        },

        query_params: {
          period: period,
          metric: metric,
          date_filter_applied: !!dateFilter
        },

        // Historical trends
        segments_history: metric === 'all' || metric === 'segments' ? segmentsTrends : null,
        places_history: metric === 'all' || metric === 'places' ? placesTrends : null,

        // Trend analysis
        trends: {
          segments: metric === 'all' || metric === 'segments' ? segmentsTrendAnalysis : null,
          places: metric === 'all' || metric === 'places' ? placesTrendAnalysis : null
        },

        // Data management info
        refresh_activity: refreshActivity,
        data_points: {
          segments_data_points: segmentsHistory.length,
          places_data_points: placesHistory.length,
          refresh_events: refreshLog.length
        },

        generated_at: new Date().toISOString()
      }),
    };

  } catch (error) {
    // Error fetching BID history
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch BID history',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};