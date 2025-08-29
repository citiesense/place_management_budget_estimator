-- Phase 3: BID Data Refresh Procedures
-- This file contains the procedures to populate and refresh the pre-calculated
-- BID boundaries and segments data for optimal query performance
-- 
-- Author: Claude
-- Date: 2025-08-29
-- Project: BID Budget Estimator - Phase 3 Data Refresh

-- =============================================================================
-- 1. REFRESH BID SEGMENTS DATA (Raw)
-- =============================================================================

-- Procedure to refresh raw segments data for a specific BID
-- This should be run nightly or when Overture data is updated

CREATE OR REPLACE PROCEDURE `ginkgo-map-data.overture_na.refresh_bid_segments`(
  IN target_bid_id STRING,
  IN source_data_version STRING DEFAULT NULL
)
BEGIN
  DECLARE refresh_date DATE DEFAULT CURRENT_DATE();
  DECLARE start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP();
  DECLARE segments_processed INT64;
  
  -- Clear existing data for this BID
  DELETE FROM `ginkgo-map-data.overture_na.bid_segments` 
  WHERE bid_id = target_bid_id;
  
  -- Insert fresh segments data
  INSERT INTO `ginkgo-map-data.overture_na.bid_segments` (
    bid_segment_id,
    bid_id,
    segment_id,
    name,
    class,
    subclass,
    geometry,
    length_meters,
    length_miles,
    length_feet,
    is_boundary_segment,
    clip_percentage,
    source_data_version,
    last_refresh_date
  )
  WITH bid_boundary AS (
    SELECT bid_id, geometry as bid_geom
    FROM `ginkgo-map-data.overture_na.bid_areas`
    WHERE bid_id = target_bid_id AND is_active = TRUE
  ),
  segments_in_bid AS (
    SELECT 
      s.segment_id,
      s.name,
      s.class,
      s.subclass,
      s.geometry as original_geometry,
      s.length_meters as original_length,
      
      -- Clip segment to BID boundary
      ST_INTERSECTION(s.geometry, b.bid_geom) as clipped_geometry,
      ST_LENGTH(ST_INTERSECTION(s.geometry, b.bid_geom)) as clipped_length,
      
      -- Check if segment crosses boundary
      CASE 
        WHEN ST_WITHIN(s.geometry, b.bid_geom) THEN FALSE 
        ELSE TRUE 
      END as crosses_boundary,
      
      -- Calculate clipping percentage  
      ST_LENGTH(ST_INTERSECTION(s.geometry, b.bid_geom)) / s.length_meters as clip_pct,
      
      b.bid_id
    FROM `ginkgo-map-data.overture_na.segment_view` s
    CROSS JOIN bid_boundary b
    WHERE ST_INTERSECTS(s.geometry, b.bid_geom)
      AND s.geometry IS NOT NULL
      AND s.class IN ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 
                      'residential', 'service', 'unclassified', 'motorway_link', 
                      'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link')
  )
  SELECT
    CONCAT(target_bid_id, '_', segment_id, '_', GENERATE_UUID()) as bid_segment_id,
    target_bid_id,
    segment_id,
    name,
    class,
    subclass,
    clipped_geometry,
    clipped_length,
    clipped_length / 1609.34, -- miles
    clipped_length * 3.28084,  -- feet
    crosses_boundary,
    clip_pct,
    COALESCE(source_data_version, 'unknown'),
    refresh_date
  FROM segments_in_bid
  WHERE clipped_length > 1; -- Filter out very small clips (< 1 meter)
  
  SET segments_processed = @@row_count;
  
  -- Log the refresh operation
  INSERT INTO `ginkgo-map-data.overture_na.data_refresh_log` (
    bid_id, 
    operation_type, 
    records_processed, 
    duration_seconds,
    source_data_version,
    refresh_date
  )
  VALUES (
    target_bid_id,
    'refresh_segments_raw',
    segments_processed,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND),
    COALESCE(source_data_version, 'unknown'),
    refresh_date
  );
  
END;

-- =============================================================================
-- 2. REFRESH BID SEGMENTS DATA (Deduplicated)
-- =============================================================================

CREATE OR REPLACE PROCEDURE `ginkgo-map-data.overture_na.refresh_bid_segments_dedup`(
  IN target_bid_id STRING
)
BEGIN
  DECLARE start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP();
  DECLARE dedup_groups_processed INT64;
  
  -- Clear existing deduplicated data
  DELETE FROM `ginkgo-map-data.overture_na.bid_segments_dedup`
  WHERE bid_id = target_bid_id;
  
  -- Create deduplicated segments
  INSERT INTO `ginkgo-map-data.overture_na.bid_segments_dedup` (
    bid_segment_id,
    bid_id,
    dedup_group_id,
    name,
    class,
    subclass,
    geometry,
    length_meters,
    length_miles,
    length_feet,
    merged_segments_count,
    original_segment_ids
  )
  WITH segments_for_dedup AS (
    SELECT 
      bid_segment_id,
      segment_id,
      name,
      class,
      subclass,
      geometry,
      length_meters,
      ST_BUFFER(geometry, 15) as buffer_geom
    FROM `ginkgo-map-data.overture_na.bid_segments`
    WHERE bid_id = target_bid_id
      AND class IN ('motorway', 'trunk', 'primary', 'secondary') -- Focus on major roads
  ),
  parallel_candidates AS (
    SELECT 
      s1.bid_segment_id as seg1_id,
      s1.segment_id as seg1_orig_id,
      s2.bid_segment_id as seg2_id,
      s2.segment_id as seg2_orig_id,
      s1.class,
      s1.name,
      s1.geometry as geom1,
      s2.geometry as geom2,
      s1.length_meters as length1,
      s2.length_meters as length2
    FROM segments_for_dedup s1
    JOIN segments_for_dedup s2 
      ON ST_INTERSECTS(s1.buffer_geom, s2.buffer_geom)
      AND s1.class = s2.class
      AND s1.bid_segment_id < s2.bid_segment_id -- Avoid duplicates
      AND (
        (s1.name = s2.name AND s1.name IS NOT NULL) OR 
        (s1.name IS NULL AND s2.name IS NULL)
      )
  ),
  dedup_groups AS (
    SELECT 
      seg1_id,
      seg1_orig_id,
      class,
      name,
      geom1 as geometry,
      length1 as length_meters,
      GENERATE_UUID() as group_id
    FROM parallel_candidates
    
    UNION ALL
    
    SELECT 
      seg2_id,
      seg2_orig_id, 
      class,
      name,
      geom2 as geometry,
      length2 as length_meters,
      GENERATE_UUID() as group_id
    FROM parallel_candidates
  ),
  merged_groups AS (
    SELECT 
      MIN(group_id) as dedup_group_id,
      ANY_VALUE(name) as name,
      ANY_VALUE(class) as class,
      'merged' as subclass,
      ST_UNION_AGG(geometry) as geometry,
      SUM(length_meters) as total_length_meters,
      COUNT(*) as segment_count,
      ARRAY_AGG(seg1_orig_id) as original_ids
    FROM dedup_groups
    GROUP BY class, name
    HAVING COUNT(*) > 1 -- Only groups with multiple segments
    
    UNION ALL
    
    -- Include non-grouped segments
    SELECT 
      bid_segment_id as dedup_group_id,
      name,
      class,
      subclass,
      geometry,
      length_meters as total_length_meters,
      1 as segment_count,
      [segment_id] as original_ids
    FROM `ginkgo-map-data.overture_na.bid_segments` s
    WHERE bid_id = target_bid_id
      AND NOT EXISTS (
        SELECT 1 FROM dedup_groups dg 
        WHERE dg.seg1_id = s.bid_segment_id
      )
  )
  SELECT 
    CONCAT(target_bid_id, '_dedup_', dedup_group_id) as bid_segment_id,
    target_bid_id,
    dedup_group_id,
    name,
    class,
    subclass,
    geometry,
    total_length_meters,
    total_length_meters / 1609.34, -- miles
    total_length_meters * 3.28084, -- feet
    segment_count,
    original_ids
  FROM merged_groups;
  
  SET dedup_groups_processed = @@row_count;
  
  -- Log the deduplication operation
  INSERT INTO `ginkgo-map-data.overture_na.data_refresh_log` (
    bid_id,
    operation_type,
    records_processed,
    duration_seconds,
    refresh_date
  )
  VALUES (
    target_bid_id,
    'refresh_segments_dedup',
    dedup_groups_processed,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND),
    CURRENT_DATE()
  );
  
END;

-- =============================================================================
-- 3. REFRESH ROLLUP STATISTICS  
-- =============================================================================

CREATE OR REPLACE PROCEDURE `ginkgo-map-data.overture_na.refresh_bid_rollups`(
  IN target_bid_id STRING
)
BEGIN
  DECLARE bid_area_sq_miles FLOAT64;
  DECLARE start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP();
  
  -- Get BID area for density calculations
  SELECT area_sq_miles INTO bid_area_sq_miles
  FROM `ginkgo-map-data.overture_na.bid_areas`
  WHERE bid_id = target_bid_id;
  
  -- Clear existing rollups
  DELETE FROM `ginkgo-map-data.overture_na.bid_segments_rollup`
  WHERE bid_id = target_bid_id;
  
  -- Insert raw segments rollup
  INSERT INTO `ginkgo-map-data.overture_na.bid_segments_rollup` (
    bid_id,
    calculation_type,
    total_segments,
    total_length_meters,
    total_length_miles,
    total_length_feet,
    segments_per_sq_mile,
    meters_per_sq_mile,
    class_breakdown,
    segments_clipped_to_boundary,
    boundary_segments,
    calculation_duration_seconds
  )
  WITH raw_stats AS (
    SELECT 
      COUNT(*) as total_segs,
      SUM(length_meters) as total_m,
      SUM(length_miles) as total_mi,
      SUM(length_feet) as total_ft,
      SUM(CASE WHEN is_boundary_segment THEN 1 ELSE 0 END) as boundary_segs,
      SUM(CASE WHEN clip_percentage < 1.0 THEN 1 ELSE 0 END) as clipped_segs
    FROM `ginkgo-map-data.overture_na.bid_segments`
    WHERE bid_id = target_bid_id
  ),
  class_stats AS (
    SELECT 
      TO_JSON(STRUCT(
        ARRAY_AGG(STRUCT(
          class,
          COUNT(*) as count,
          SUM(length_meters) as length_meters,
          SUM(length_miles) as length_miles
        )) as classes
      )) as breakdown
    FROM `ginkgo-map-data.overture_na.bid_segments`
    WHERE bid_id = target_bid_id
    GROUP BY class
  )
  SELECT 
    target_bid_id,
    'raw',
    rs.total_segs,
    rs.total_m,
    rs.total_mi,
    rs.total_ft,
    CASE WHEN bid_area_sq_miles > 0 THEN rs.total_segs / bid_area_sq_miles ELSE NULL END,
    CASE WHEN bid_area_sq_miles > 0 THEN rs.total_m / bid_area_sq_miles ELSE NULL END,
    cs.breakdown,
    rs.clipped_segs,
    rs.boundary_segs,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND)
  FROM raw_stats rs
  CROSS JOIN class_stats cs;
  
  -- Insert deduplicated segments rollup  
  INSERT INTO `ginkgo-map-data.overture_na.bid_segments_rollup` (
    bid_id,
    calculation_type,
    total_segments,
    total_length_meters,
    total_length_miles,
    total_length_feet,
    segments_per_sq_mile,
    meters_per_sq_mile,
    class_breakdown,
    calculation_duration_seconds
  )
  WITH dedup_stats AS (
    SELECT 
      COUNT(*) as total_segs,
      SUM(length_meters) as total_m,
      SUM(length_miles) as total_mi,
      SUM(length_feet) as total_ft
    FROM `ginkgo-map-data.overture_na.bid_segments_dedup`
    WHERE bid_id = target_bid_id
  ),
  dedup_class_stats AS (
    SELECT 
      TO_JSON(STRUCT(
        ARRAY_AGG(STRUCT(
          class,
          COUNT(*) as count,
          SUM(length_meters) as length_meters,
          SUM(length_miles) as length_miles,
          SUM(merged_segments_count) as original_segments_merged
        )) as classes
      )) as breakdown
    FROM `ginkgo-map-data.overture_na.bid_segments_dedup`
    WHERE bid_id = target_bid_id
    GROUP BY class
  )
  SELECT 
    target_bid_id,
    'deduplicated',
    ds.total_segs,
    ds.total_m,
    ds.total_mi,
    ds.total_ft,
    CASE WHEN bid_area_sq_miles > 0 THEN ds.total_segs / bid_area_sq_miles ELSE NULL END,
    CASE WHEN bid_area_sq_miles > 0 THEN ds.total_m / bid_area_sq_miles ELSE NULL END,
    dcs.breakdown,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND)
  FROM dedup_stats ds
  CROSS JOIN dedup_class_stats dcs;
  
END;

-- =============================================================================
-- 4. COMPLETE BID REFRESH (All Data)
-- =============================================================================

CREATE OR REPLACE PROCEDURE `ginkgo-map-data.overture_na.refresh_bid_complete`(
  IN target_bid_id STRING,
  IN source_data_version STRING DEFAULT NULL
)
BEGIN
  DECLARE start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP();
  
  -- Validate BID exists
  IF NOT EXISTS(SELECT 1 FROM `ginkgo-map-data.overture_na.bid_areas` WHERE bid_id = target_bid_id AND is_active = TRUE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = CONCAT('BID not found or inactive: ', target_bid_id);
  END IF;
  
  -- Step 1: Refresh raw segments
  CALL `ginkgo-map-data.overture_na.refresh_bid_segments`(target_bid_id, source_data_version);
  
  -- Step 2: Refresh deduplicated segments
  CALL `ginkgo-map-data.overture_na.refresh_bid_segments_dedup`(target_bid_id);
  
  -- Step 3: Refresh rollup statistics
  CALL `ginkgo-map-data.overture_na.refresh_bid_rollups`(target_bid_id);
  
  -- Log the complete refresh
  INSERT INTO `ginkgo-map-data.overture_na.data_refresh_log` (
    bid_id,
    operation_type,
    records_processed,
    duration_seconds,
    source_data_version,
    refresh_date
  )
  VALUES (
    target_bid_id,
    'complete_refresh',
    NULL, -- Will be calculated from individual operations
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND),
    COALESCE(source_data_version, 'unknown'),
    CURRENT_DATE()
  );
  
END;

-- =============================================================================
-- 5. BATCH REFRESH ALL ACTIVE BIDS
-- =============================================================================

CREATE OR REPLACE PROCEDURE `ginkgo-map-data.overture_na.refresh_all_bids`(
  IN source_data_version STRING DEFAULT NULL
)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE current_bid_id STRING;
  DECLARE bid_cursor CURSOR FOR 
    SELECT bid_id FROM `ginkgo-map-data.overture_na.bid_areas` 
    WHERE is_active = TRUE 
    ORDER BY bid_name;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN bid_cursor;
  
  read_loop: LOOP
    FETCH bid_cursor INTO current_bid_id;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- Refresh this BID (with error handling)
    BEGIN
      DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
      BEGIN
        INSERT INTO `ginkgo-map-data.overture_na.data_refresh_log` (
          bid_id, operation_type, records_processed, refresh_date
        ) VALUES (
          current_bid_id, 'refresh_error', -1, CURRENT_DATE()
        );
      END;
      
      CALL `ginkgo-map-data.overture_na.refresh_bid_complete`(current_bid_id, source_data_version);
    END;
    
  END LOOP;
  
  CLOSE bid_cursor;
  
END;

-- =============================================================================
-- 6. DATA REFRESH LOG TABLE
-- =============================================================================

CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.data_refresh_log` (
  log_id STRING DEFAULT GENERATE_UUID(),
  bid_id STRING,
  operation_type STRING, -- 'refresh_segments_raw', 'refresh_segments_dedup', 'refresh_rollups', 'complete_refresh'
  records_processed INTEGER,
  duration_seconds FLOAT64,
  source_data_version STRING,
  refresh_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- =============================================================================
-- 7. UTILITY QUERIES FOR MONITORING
-- =============================================================================

-- Check refresh status for all BIDs
CREATE OR REPLACE VIEW `ginkgo-map-data.overture_na.bid_refresh_status` AS
SELECT 
  ba.bid_id,
  ba.bid_name,
  ba.is_active,
  
  -- Latest refresh dates
  MAX(CASE WHEN drl.operation_type = 'complete_refresh' THEN drl.refresh_date END) as last_complete_refresh,
  MAX(CASE WHEN drl.operation_type = 'refresh_segments_raw' THEN drl.refresh_date END) as last_segments_refresh,
  MAX(drl.refresh_date) as last_any_refresh,
  
  -- Data freshness
  DATE_DIFF(CURRENT_DATE(), MAX(drl.refresh_date), DAY) as days_since_last_refresh,
  
  -- Error status
  COUNTIF(drl.operation_type = 'refresh_error' AND drl.refresh_date = CURRENT_DATE()) as errors_today

FROM `ginkgo-map-data.overture_na.bid_areas` ba
LEFT JOIN `ginkgo-map-data.overture_na.data_refresh_log` drl
  ON ba.bid_id = drl.bid_id
WHERE ba.is_active = TRUE
GROUP BY ba.bid_id, ba.bid_name, ba.is_active
ORDER BY last_any_refresh DESC;