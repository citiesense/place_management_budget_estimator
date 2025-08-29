// BID Data API Endpoint  
// Returns complete BID analysis data (segments, places, metrics)
//
// GET /api/bid-data?bid_id=BID_001&dedup=true&classes=primary,secondary

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
    const useDedup = params.dedup === 'true' || params.dedup === '1';
    const selectedClasses = params.classes ? params.classes.split(',').map(c => c.trim()) : [
      'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified'
    ];

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

    // Fetch BID basic info and verify it exists
    const bidInfoSql = `
      SELECT 
        bid_id, bid_name, bid_short_name, city, state,
        area_sq_miles, annual_budget_usd, established_date,
        geometry, is_active
      FROM \`ginkgo-map-data.overture_na.bid_areas\`
      WHERE bid_id = @bid_id AND is_active = TRUE
    `;

    const [bidInfoRows] = await bigquery.query({
      query: bidInfoSql,
      params: { bid_id: bidId },
    });

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

    // Determine which segments table to use
    const segmentsTable = useDedup ? 
      'ginkgo-map-data.overture_na.bid_segments_dedup' : 
      'ginkgo-map-data.overture_na.bid_segments';

    // Fetch segments data
    const segmentsSql = useDedup ? `
      SELECT 
        bid_segment_id as segment_id,
        name,
        class,
        subclass,
        ST_ASGEOJSON(geometry) as geom_json,
        length_meters,
        length_miles,
        merged_segments_count,
        original_segment_ids,
        'deduplicated' as dedup_status,
        
        -- Overall metrics
        COUNT(*) OVER() as total_segments,
        SUM(length_meters) OVER() as total_length_m,
        SUM(length_miles) OVER() as total_length_miles,
        SUM(length_meters) OVER() * 3.28084 as total_length_ft,
        
        -- Per-class metrics
        COUNT(*) OVER(PARTITION BY class) as class_count,
        SUM(length_meters) OVER(PARTITION BY class) as class_length_m,
        SUM(length_miles) OVER(PARTITION BY class) as class_length_miles,
        SUM(length_meters) OVER(PARTITION BY class) * 3.28084 as class_length_ft
        
      FROM \`${segmentsTable}\`
      WHERE bid_id = @bid_id 
        AND class IN UNNEST(@selected_classes)
      ORDER BY class, length_meters DESC
    ` : `
      SELECT 
        bid_segment_id as segment_id,
        name,
        class,
        subclass,
        ST_ASGEOJSON(geometry) as geom_json,
        length_meters,
        length_miles,
        is_boundary_segment,
        clip_percentage,
        1 as merged_segments_count,
        'original' as dedup_status,
        
        -- Overall metrics  
        COUNT(*) OVER() as total_segments,
        SUM(length_meters) OVER() as total_length_m,
        SUM(length_miles) OVER() as total_length_miles,
        SUM(length_meters) OVER() * 3.28084 as total_length_ft,
        
        -- Per-class metrics
        COUNT(*) OVER(PARTITION BY class) as class_count,
        SUM(length_meters) OVER(PARTITION BY class) as class_length_m,
        SUM(length_miles) OVER(PARTITION BY class) as class_length_miles,
        SUM(length_meters) OVER(PARTITION BY class) * 3.28084 as class_length_ft
        
      FROM \`${segmentsTable}\`
      WHERE bid_id = @bid_id 
        AND class IN UNNEST(@selected_classes)
      ORDER BY class, length_meters DESC
    `;

    // Fetch places data
    const placesSql = `
      SELECT 
        bid_place_id as place_id,
        name,
        category,
        subcategory,
        ST_ASGEOJSON(geometry) as geom_json,
        confidence_score,
        
        -- Overall metrics
        COUNT(*) OVER() as total_places,
        COUNT(*) OVER(PARTITION BY category) as category_count
        
      FROM \`ginkgo-map-data.overture_na.bid_places\`
      WHERE bid_id = @bid_id
      ORDER BY category, name
    `;

    // Execute queries in parallel
    const [
      [segmentsRows],
      [placesRows]
    ] = await Promise.all([
      bigquery.query({
        query: segmentsSql,
        params: { bid_id: bidId, selected_classes: selectedClasses },
      }),
      bigquery.query({
        query: placesSql,
        params: { bid_id: bidId },
      })
    ]);

    // Process segments data
    const segments = segmentsRows.map(row => ({
      segment_id: row.segment_id,
      name: row.name,
      class: row.class,
      subclass: row.subclass,
      geom_json: row.geom_json,
      length_meters: row.length_meters,
      length_miles: row.length_miles,
      is_boundary_segment: row.is_boundary_segment,
      clip_percentage: row.clip_percentage,
      merged_count: row.merged_segments_count || 1,
      dedup_status: row.dedup_status,
      original_segment_ids: row.original_segment_ids,
      
      // Include overall metrics from window functions
      total_segments: row.total_segments,
      total_length_m: row.total_length_m,
      total_length_miles: row.total_length_miles,
      total_length_ft: row.total_length_ft,
      class_count: row.class_count,
      class_length_m: row.class_length_m,
      class_length_miles: row.class_length_miles,
      class_length_ft: row.class_length_ft
    }));

    // Process places data
    const places = placesRows.map(row => ({
      place_id: row.place_id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      geom_json: row.geom_json,
      confidence_score: row.confidence_score,
      total_places: row.total_places,
      category_count: row.category_count
    }));

    // Create GeoJSON FeatureCollections
    const segmentsGeoJSON = {
      type: 'FeatureCollection',
      features: segments.map(seg => ({
        type: 'Feature',
        properties: {
          segment_id: seg.segment_id,
          name: seg.name,
          class: seg.class,
          subclass: seg.subclass,
          length_meters: seg.length_meters,
          length_miles: seg.length_miles,
          merged_count: seg.merged_count,
          dedup_status: seg.dedup_status
        },
        geometry: JSON.parse(seg.geom_json)
      }))
    };

    const placesGeoJSON = {
      type: 'FeatureCollection', 
      features: places.map(place => ({
        type: 'Feature',
        properties: {
          place_id: place.place_id,
          name: place.name,
          category: place.category,
          subcategory: place.subcategory,
          confidence_score: place.confidence_score
        },
        geometry: JSON.parse(place.geom_json)
      }))
    };

    // Calculate summary metrics
    const segmentMetrics = segments.length > 0 ? {
      total_segments: segments[0].total_segments,
      total_length_m: segments[0].total_length_m,
      total_length_miles: parseFloat(segments[0].total_length_miles?.toFixed(2) || 0),
      total_length_ft: segments[0].total_length_ft,
      
      // Deduplication metrics
      merged_segments: segments.filter(s => s.merged_count > 1).length,
      total_original_segments: segments.reduce((sum, s) => sum + s.merged_count, 0),
      
      // Class breakdown
      classes: Array.from(new Set(segments.map(s => s.class))).map(cls => {
        const classSegs = segments.filter(s => s.class === cls);
        return {
          class: cls,
          count: classSegs.length > 0 ? classSegs[0].class_count : 0,
          length_meters: classSegs.length > 0 ? classSegs[0].class_length_m : 0,
          length_miles: classSegs.length > 0 ? parseFloat(classSegs[0].class_length_miles?.toFixed(2) || 0) : 0,
          length_feet: classSegs.length > 0 ? classSegs[0].class_length_ft : 0
        };
      })
    } : null;

    const placeMetrics = places.length > 0 ? {
      total_places: places[0].total_places,
      categories: Array.from(new Set(places.map(p => p.category))).map(cat => {
        const catPlaces = places.filter(p => p.category === cat);
        return {
          category: cat,
          count: catPlaces.length > 0 ? catPlaces[0].category_count : 0
        };
      })
    } : null;

    // Return comprehensive BID data
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
          location: `${bidInfo.city}, ${bidInfo.state}`,
          area_sq_miles: bidInfo.area_sq_miles,
          annual_budget_usd: bidInfo.annual_budget_usd,
          established_year: bidInfo.established_date ? new Date(bidInfo.established_date).getFullYear() : null
        },
        
        // Data parameters used
        query_params: {
          deduplication: useDedup,
          selected_classes: selectedClasses
        },
        
        // Metrics
        segments: segmentMetrics,
        places: placeMetrics,
        
        // Raw data
        segments_data: segments,
        places_data: places,
        
        // GeoJSON for mapping
        segments_geojson: segmentsGeoJSON,
        places_geojson: placesGeoJSON,
        
        // Metadata
        generated_at: new Date().toISOString(),
        data_source: 'pre_calculated_bid_data'
      }),
    };

  } catch (error) {
    console.error('Error fetching BID data:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch BID data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};