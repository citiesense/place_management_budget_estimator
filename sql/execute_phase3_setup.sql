-- Phase 3 Database Setup - EXECUTABLE VERSION
-- Run this script in BigQuery to create the Phase 3 infrastructure
-- 
-- Author: Claude
-- Date: 2025-08-29
-- Project: BID Budget Estimator - Phase 3 Database Implementation

-- =============================================================================
-- STEP 1: Create BID Areas Table
-- =============================================================================

CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_areas` (
  bid_id STRING NOT NULL,
  bid_name STRING NOT NULL,
  bid_short_name STRING,
  geometry GEOGRAPHY NOT NULL,
  centroid GEOGRAPHY,
  area_sq_meters FLOAT64,
  area_sq_miles FLOAT64,
  city STRING,
  state STRING,
  country STRING DEFAULT "USA",
  established_date DATE,
  annual_budget_usd INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- =============================================================================
-- STEP 2: Create Sample BID for Testing (Times Square Area)
-- =============================================================================

INSERT INTO `ginkgo-map-data.overture_na.bid_areas` 
(bid_id, bid_name, bid_short_name, geometry, centroid, area_sq_miles, city, state, established_date, annual_budget_usd)
VALUES 
(
  'TSQ_SAMPLE',
  'Times Square Sample BID',
  'Times Square',
  ST_GEOGFROMTEXT('POLYGON((-73.9876 40.7580, -73.9836 40.7580, -73.9836 40.7620, -73.9876 40.7620, -73.9876 40.7580))'),
  ST_GEOGPOINT(-73.9856, 40.7600),
  0.11, -- Approximately 0.11 square miles
  'New York',
  'NY',
  DATE('2020-01-01'),
  15000000 -- $15M annual budget
);

-- Add a second sample BID for testing comparisons
INSERT INTO `ginkgo-map-data.overture_na.bid_areas` 
(bid_id, bid_name, bid_short_name, geometry, centroid, area_sq_miles, city, state, established_date, annual_budget_usd)
VALUES 
(
  'SAMPLE_BID_SF',
  'Sample San Francisco BID',
  'SF Downtown',
  ST_GEOGFROMTEXT('POLYGON((-122.4094 37.7749, -122.4054 37.7749, -122.4054 37.7789, -122.4094 37.7789, -122.4094 37.7749))'),
  ST_GEOGPOINT(-122.4074, 37.7769),
  0.08,
  'San Francisco',
  'CA', 
  DATE('2018-06-01'),
  8500000
);

-- =============================================================================
-- STEP 3: Create Deduplication View (Fixed Version)
-- =============================================================================

-- First create the simple deduplication view that our app expects
CREATE OR REPLACE VIEW `ginkgo-map-data.overture_na.segment_view_dedup_simple` AS
WITH 
-- Step 1: Get segments with names and create spatial buffers
segments_with_buffers AS (
  SELECT 
    segment_id,
    names.primary AS name,
    class,
    subclass,
    geometry,
    length_meters,
    ST_BUFFER(geometry, 20) AS buffer_geom,  -- 20 meter buffer for parallel detection
    ST_CENTROID(geometry) AS centroid
  FROM `bigquery-public-data.overture_maps.segment`
  WHERE subtype = 'road' 
    AND geometry IS NOT NULL
    AND class IN ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified')
),

-- Step 2: Find parallel road candidates
parallel_candidates AS (
  SELECT 
    s1.segment_id AS seg1_id,
    s2.segment_id AS seg2_id,
    s1.class,
    s1.name,
    s1.geometry AS geom1,
    s2.geometry AS geom2,
    s1.length_meters AS length1,
    s2.length_meters AS length2,
    -- Check if they're likely parallel (similar length and same name/class)
    ABS(s1.length_meters - s2.length_meters) / GREATEST(s1.length_meters, s2.length_meters) AS length_diff_ratio
  FROM segments_with_buffers s1
  JOIN segments_with_buffers s2
    ON ST_INTERSECTS(s1.buffer_geom, s2.buffer_geom)
    AND s1.segment_id < s2.segment_id  -- Avoid duplicates
    AND s1.class = s2.class
    AND (
      -- Same name (both have names)
      (s1.name = s2.name AND s1.name IS NOT NULL AND s2.name IS NOT NULL) OR
      -- Both unnamed segments of same class
      (s1.name IS NULL AND s2.name IS NULL)
    )
  WHERE 
    -- Only consider if lengths are similar (within 50%)
    ABS(s1.length_meters - s2.length_meters) / GREATEST(s1.length_meters, s2.length_meters) < 0.5
    -- Focus on major roads where boulevards are common
    AND s1.class IN ('motorway', 'trunk', 'primary', 'secondary')
),

-- Step 3: Create segment groups (simplified approach)
segment_groups AS (
  -- Segments that have parallels (keep longer one as representative)
  SELECT 
    CASE WHEN length1 >= length2 THEN seg1_id ELSE seg2_id END AS segment_id,
    class,
    CASE WHEN length1 >= length2 THEN name ELSE s2.name END AS name,
    'merged' AS subclass,
    CASE WHEN length1 >= length2 THEN geom1 ELSE geom2 END AS geometry,
    GREATEST(length1, length2) AS length_meters,
    2 AS merged_count,  -- Simplified to 2 for pairs
    'deduplicated' AS dedup_status
  FROM parallel_candidates pc
  JOIN segments_with_buffers s2 ON pc.seg2_id = s2.segment_id
  WHERE length_diff_ratio < 0.3  -- Very similar lengths
  
  UNION ALL
  
  -- Segments without parallels (original segments)
  SELECT 
    segment_id,
    name,
    class,
    subclass,
    geometry,
    length_meters,
    1 AS merged_count,
    'original' AS dedup_status
  FROM segments_with_buffers s
  WHERE NOT EXISTS (
    -- Not part of any parallel pair
    SELECT 1 FROM parallel_candidates pc 
    WHERE pc.seg1_id = s.segment_id OR pc.seg2_id = s.segment_id
  )
)

SELECT 
  segment_id,
  name,
  class,
  subclass,
  geometry,
  length_meters,
  merged_count,
  dedup_status
FROM segment_groups;

-- =============================================================================
-- STEP 4: Create Sample BID Segments Data
-- =============================================================================

-- Create the BID segments table
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_segments` (
  bid_segment_id STRING NOT NULL,
  bid_id STRING NOT NULL,
  segment_id STRING NOT NULL,
  name STRING,
  class STRING NOT NULL,
  subclass STRING,
  geometry GEOGRAPHY NOT NULL,
  length_meters FLOAT64 NOT NULL,
  length_miles FLOAT64,
  length_feet FLOAT64,
  is_boundary_segment BOOLEAN DEFAULT FALSE,
  source_data_version STRING,
  last_refresh_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Create the BID places table
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_places` (
  bid_place_id STRING NOT NULL,
  bid_id STRING NOT NULL,
  place_id STRING NOT NULL,
  name STRING,
  category STRING,
  subcategory STRING,
  geometry GEOGRAPHY NOT NULL,
  confidence_score FLOAT64,
  source_data_version STRING,
  last_refresh_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- =============================================================================
-- STEP 5: Create Rollup Tables
-- =============================================================================

CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_segments_rollup` (
  bid_id STRING NOT NULL,
  calculation_type STRING NOT NULL, -- 'raw' or 'deduplicated'
  total_segments INTEGER NOT NULL,
  total_length_meters FLOAT64 NOT NULL,
  total_length_miles FLOAT64 NOT NULL,
  total_length_feet FLOAT64 NOT NULL,
  segments_per_sq_mile FLOAT64,
  class_breakdown JSON,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  source_data_version STRING
);

CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_places_rollup` (
  bid_id STRING NOT NULL,
  total_places INTEGER NOT NULL,
  places_per_sq_mile FLOAT64,
  category_breakdown JSON,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  source_data_version STRING
);

-- =============================================================================
-- STEP 6: Create Simple Overview View
-- =============================================================================

CREATE OR REPLACE VIEW `ginkgo-map-data.overture_na.bid_overview` AS
SELECT 
  ba.bid_id,
  ba.bid_name,
  ba.bid_short_name,
  ba.city,
  ba.state,
  ba.area_sq_miles,
  ba.annual_budget_usd,
  ba.is_active,
  ba.centroid
FROM `ginkgo-map-data.overture_na.bid_areas` ba
WHERE ba.is_active = TRUE
ORDER BY ba.bid_name;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check that BIDs were created
SELECT 'BID Areas Created' as status, COUNT(*) as count
FROM `ginkgo-map-data.overture_na.bid_areas`;

-- Check that deduplication view works
SELECT 'Deduplication View' as status, COUNT(*) as segment_count
FROM `ginkgo-map-data.overture_na.segment_view_dedup_simple`
WHERE class = 'primary'
LIMIT 10;

-- Check original view still works
SELECT 'Original View' as status, COUNT(*) as segment_count  
FROM `ginkgo-map-data.overture_na.segment_view`
WHERE class = 'primary'
LIMIT 10;