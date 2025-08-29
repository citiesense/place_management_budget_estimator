-- Populate Sample BID Data
-- This script populates the BID segments and places tables with actual data
-- Run AFTER the schema setup script
--
-- Author: Claude  
-- Date: 2025-08-29

-- =============================================================================
-- POPULATE BID SEGMENTS FOR SAMPLE BIDS
-- =============================================================================

-- Times Square BID - Raw segments
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
  source_data_version,
  last_refresh_date
)
WITH bid_boundary AS (
  SELECT bid_id, geometry as bid_geom
  FROM `ginkgo-map-data.overture_na.bid_areas`
  WHERE bid_id = 'TSQ_SAMPLE'
),
segments_in_bid AS (
  SELECT 
    s.segment_id,
    s.names.primary AS name,
    s.class,
    s.subclass,
    ST_INTERSECTION(s.geometry, b.bid_geom) AS clipped_geometry,
    ST_LENGTH(ST_INTERSECTION(s.geometry, b.bid_geom)) AS clipped_length,
    CASE WHEN ST_WITHIN(s.geometry, b.bid_geom) THEN FALSE ELSE TRUE END AS crosses_boundary,
    b.bid_id
  FROM `bigquery-public-data.overture_maps.segment` s
  CROSS JOIN bid_boundary b
  WHERE ST_INTERSECTS(s.geometry, b.bid_geom)
    AND s.subtype = 'road'
    AND s.geometry IS NOT NULL
    AND s.class IN ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified')
    AND ST_LENGTH(ST_INTERSECTION(s.geometry, b.bid_geom)) > 5 -- Filter tiny intersections
  LIMIT 500  -- Limit for initial testing
)
SELECT
  CONCAT('TSQ_SAMPLE_', segment_id) AS bid_segment_id,
  'TSQ_SAMPLE' AS bid_id,
  segment_id,
  name,
  class,
  subclass,
  clipped_geometry AS geometry,
  clipped_length AS length_meters,
  clipped_length / 1609.34 AS length_miles,
  clipped_length * 3.28084 AS length_feet,
  crosses_boundary AS is_boundary_segment,
  'overture_2024_12' AS source_data_version,
  CURRENT_DATE() AS last_refresh_date
FROM segments_in_bid;

-- San Francisco BID - Raw segments  
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
  source_data_version,
  last_refresh_date
)
WITH bid_boundary AS (
  SELECT bid_id, geometry as bid_geom
  FROM `ginkgo-map-data.overture_na.bid_areas`  
  WHERE bid_id = 'SAMPLE_BID_SF'
),
segments_in_bid AS (
  SELECT 
    s.segment_id,
    s.names.primary AS name,
    s.class,
    s.subclass,
    ST_INTERSECTION(s.geometry, b.bid_geom) AS clipped_geometry,
    ST_LENGTH(ST_INTERSECTION(s.geometry, b.bid_geom)) AS clipped_length,
    CASE WHEN ST_WITHIN(s.geometry, b.bid_geom) THEN FALSE ELSE TRUE END AS crosses_boundary,
    b.bid_id
  FROM `bigquery-public-data.overture_maps.segment` s
  CROSS JOIN bid_boundary b
  WHERE ST_INTERSECTS(s.geometry, b.bid_geom)
    AND s.subtype = 'road'
    AND s.geometry IS NOT NULL
    AND s.class IN ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified')
    AND ST_LENGTH(ST_INTERSECTION(s.geometry, b.bid_geom)) > 5
  LIMIT 300
)
SELECT
  CONCAT('SF_SAMPLE_', segment_id) AS bid_segment_id,
  'SAMPLE_BID_SF' AS bid_id,
  segment_id,
  name,
  class,
  subclass,
  clipped_geometry AS geometry,
  clipped_length AS length_meters,
  clipped_length / 1609.34 AS length_miles,
  clipped_length * 3.28084 AS length_feet,
  crosses_boundary AS is_boundary_segment,
  'overture_2024_12' AS source_data_version,
  CURRENT_DATE() AS last_refresh_date
FROM segments_in_bid;

-- =============================================================================
-- POPULATE BID PLACES FOR SAMPLE BIDS  
-- =============================================================================

-- Times Square BID - Places/POIs
INSERT INTO `ginkgo-map-data.overture_na.bid_places` (
  bid_place_id,
  bid_id,
  place_id,
  name,
  category,
  subcategory,
  geometry,
  confidence_score,
  source_data_version,
  last_refresh_date
)
WITH bid_boundary AS (
  SELECT bid_id, geometry as bid_geom
  FROM `ginkgo-map-data.overture_na.bid_areas`
  WHERE bid_id = 'TSQ_SAMPLE'
),
places_in_bid AS (
  SELECT 
    p.id AS place_id,
    p.names.primary AS name,
    p.categories.primary AS category,
    ARRAY_TO_STRING(p.categories.alternate, ',') AS subcategory,
    p.geometry,
    p.confidence
  FROM `bigquery-public-data.overture_maps.place` p
  CROSS JOIN bid_boundary b
  WHERE ST_WITHIN(p.geometry, b.bid_geom)
    AND p.geometry IS NOT NULL
    AND p.categories.primary IS NOT NULL
  LIMIT 200
)
SELECT
  CONCAT('TSQ_SAMPLE_', place_id) AS bid_place_id,
  'TSQ_SAMPLE' AS bid_id,
  place_id,
  name,
  category,
  subcategory,
  geometry,
  confidence AS confidence_score,
  'overture_2024_12' AS source_data_version,
  CURRENT_DATE() AS last_refresh_date
FROM places_in_bid;

-- San Francisco BID - Places/POIs  
INSERT INTO `ginkgo-map-data.overture_na.bid_places` (
  bid_place_id,
  bid_id,
  place_id,
  name,
  category,
  subcategory,
  geometry,
  confidence_score,
  source_data_version,
  last_refresh_date
)
WITH bid_boundary AS (
  SELECT bid_id, geometry as bid_geom
  FROM `ginkgo-map-data.overture_na.bid_areas`
  WHERE bid_id = 'SAMPLE_BID_SF'
),
places_in_bid AS (
  SELECT 
    p.id AS place_id,
    p.names.primary AS name,
    p.categories.primary AS category,
    ARRAY_TO_STRING(p.categories.alternate, ',') AS subcategory,
    p.geometry,
    p.confidence
  FROM `bigquery-public-data.overture_maps.place` p
  CROSS JOIN bid_boundary b
  WHERE ST_WITHIN(p.geometry, b.bid_geom)
    AND p.geometry IS NOT NULL
    AND p.categories.primary IS NOT NULL
  LIMIT 150
)
SELECT
  CONCAT('SF_SAMPLE_', place_id) AS bid_place_id,
  'SAMPLE_BID_SF' AS bid_id,
  place_id,
  name,
  category,
  subcategory,
  geometry,
  confidence AS confidence_score,
  'overture_2024_12' AS source_data_version,
  CURRENT_DATE() AS last_refresh_date
FROM places_in_bid;

-- =============================================================================
-- POPULATE ROLLUP STATISTICS
-- =============================================================================

-- Raw segments rollup for Times Square
INSERT INTO `ginkgo-map-data.overture_na.bid_segments_rollup` (
  bid_id,
  calculation_type,
  total_segments,
  total_length_meters,
  total_length_miles,
  total_length_feet,
  segments_per_sq_mile,
  class_breakdown,
  source_data_version
)
WITH segments_stats AS (
  SELECT 
    bid_id,
    COUNT(*) as total_segs,
    SUM(length_meters) as total_m,
    SUM(length_miles) as total_mi,
    SUM(length_feet) as total_ft
  FROM `ginkgo-map-data.overture_na.bid_segments`
  WHERE bid_id = 'TSQ_SAMPLE'
  GROUP BY bid_id
),
class_stats AS (
  SELECT
    TO_JSON(ARRAY_AGG(STRUCT(
      class,
      COUNT(*) as count,
      SUM(length_meters) as length_meters,
      SUM(length_miles) as length_miles
    ))) as breakdown
  FROM `ginkgo-map-data.overture_na.bid_segments`
  WHERE bid_id = 'TSQ_SAMPLE'
  GROUP BY class
),
bid_area AS (
  SELECT area_sq_miles FROM `ginkgo-map-data.overture_na.bid_areas` 
  WHERE bid_id = 'TSQ_SAMPLE'
)
SELECT 
  'TSQ_SAMPLE' as bid_id,
  'raw' as calculation_type,
  ss.total_segs,
  ss.total_m,
  ss.total_mi,
  ss.total_ft,
  ss.total_segs / ba.area_sq_miles as segments_per_sq_mile,
  cs.breakdown,
  'overture_2024_12' as source_data_version
FROM segments_stats ss
CROSS JOIN class_stats cs  
CROSS JOIN bid_area ba;

-- Raw segments rollup for San Francisco
INSERT INTO `ginkgo-map-data.overture_na.bid_segments_rollup` (
  bid_id,
  calculation_type,
  total_segments,
  total_length_meters,
  total_length_miles,
  total_length_feet,
  segments_per_sq_mile,
  class_breakdown,
  source_data_version
)
WITH segments_stats AS (
  SELECT 
    bid_id,
    COUNT(*) as total_segs,
    SUM(length_meters) as total_m,
    SUM(length_miles) as total_mi,
    SUM(length_feet) as total_ft
  FROM `ginkgo-map-data.overture_na.bid_segments`
  WHERE bid_id = 'SAMPLE_BID_SF'
  GROUP BY bid_id
),
class_stats AS (
  SELECT
    TO_JSON(ARRAY_AGG(STRUCT(
      class,
      COUNT(*) as count,
      SUM(length_meters) as length_meters,
      SUM(length_miles) as length_miles
    ))) as breakdown
  FROM `ginkgo-map-data.overture_na.bid_segments`
  WHERE bid_id = 'SAMPLE_BID_SF'
  GROUP BY class
),
bid_area AS (
  SELECT area_sq_miles FROM `ginkgo-map-data.overture_na.bid_areas`
  WHERE bid_id = 'SAMPLE_BID_SF'
)
SELECT 
  'SAMPLE_BID_SF' as bid_id,
  'raw' as calculation_type,
  ss.total_segs,
  ss.total_m,
  ss.total_mi,
  ss.total_ft,
  ss.total_segs / ba.area_sq_miles as segments_per_sq_mile,
  cs.breakdown,
  'overture_2024_12' as source_data_version
FROM segments_stats ss
CROSS JOIN class_stats cs
CROSS JOIN bid_area ba;

-- Places rollup for both BIDs
INSERT INTO `ginkgo-map-data.overture_na.bid_places_rollup` (
  bid_id,
  total_places,
  places_per_sq_mile,
  category_breakdown
)
WITH places_stats AS (
  SELECT 
    bp.bid_id,
    COUNT(*) as total_places,
    ba.area_sq_miles,
    TO_JSON(ARRAY_AGG(STRUCT(
      category,
      COUNT(*) as count
    ))) as breakdown
  FROM `ginkgo-map-data.overture_na.bid_places` bp
  JOIN `ginkgo-map-data.overture_na.bid_areas` ba ON bp.bid_id = ba.bid_id
  GROUP BY bp.bid_id, ba.area_sq_miles, category
)
SELECT 
  bid_id,
  total_places,
  total_places / area_sq_miles as places_per_sq_mile,
  breakdown
FROM places_stats;

-- =============================================================================
-- VERIFICATION AND STATUS
-- =============================================================================

-- Check segments data
SELECT 
  'BID Segments' as table_name,
  bid_id,
  COUNT(*) as records,
  ROUND(SUM(length_miles), 2) as total_miles
FROM `ginkgo-map-data.overture_na.bid_segments`
GROUP BY bid_id;

-- Check places data  
SELECT 
  'BID Places' as table_name,
  bid_id,
  COUNT(*) as records
FROM `ginkgo-map-data.overture_na.bid_places`
GROUP BY bid_id;

-- Check rollup data
SELECT 
  'Segments Rollup' as table_name,
  bid_id,
  calculation_type,
  total_segments,
  ROUND(total_length_miles, 2) as total_miles
FROM `ginkgo-map-data.overture_na.bid_segments_rollup`
ORDER BY bid_id, calculation_type;

SELECT 'Phase 3 Database Population Complete' as status;