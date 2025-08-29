-- Phase 3: BID Boundaries & Pre-calculated Data Schema
-- This file defines the database structure for official BID boundaries
-- and pre-calculated road segments data for improved performance
-- 
-- Author: Claude
-- Date: 2025-08-29
-- Project: BID Budget Estimator - Phase 3 Implementation

-- =============================================================================
-- 1. BID BOUNDARIES TABLES
-- =============================================================================

-- Main BID Areas table with official boundaries
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_areas` (
  bid_id STRING NOT NULL,                    -- Unique BID identifier (e.g., "TSQ", "BID_001")
  bid_name STRING NOT NULL,                  -- Full BID name (e.g., "Times Square Alliance")
  bid_short_name STRING,                     -- Short display name (e.g., "Times Square")
  
  -- Geographic data
  geometry GEOGRAPHY NOT NULL,               -- Official BID boundary polygon
  centroid GEOGRAPHY,                        -- Calculated center point for map display
  area_sq_meters FLOAT64,                    -- Area in square meters
  area_sq_miles FLOAT64,                     -- Area in square miles
  area_acres FLOAT64,                        -- Area in acres
  
  -- Administrative data  
  city STRING,                               -- City (e.g., "New York", "San Francisco")
  state STRING,                              -- State/Province (e.g., "NY", "CA") 
  country STRING DEFAULT "USA",              -- Country
  
  -- BID metadata
  established_date DATE,                     -- When BID was established
  annual_budget_usd INTEGER,                 -- Current annual budget
  management_company STRING,                 -- BID management organization
  website_url STRING,                        -- Official BID website
  
  -- Data management
  data_source STRING,                        -- Source of boundary data
  data_quality_score FLOAT64,               -- Quality assessment (0-1)
  last_verified_date DATE,                   -- When boundary was last verified
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  
  -- Status flags
  is_active BOOLEAN DEFAULT TRUE,            -- Whether BID is currently active
  is_verified BOOLEAN DEFAULT FALSE          -- Whether boundary has been verified
);

-- BID Areas History table for tracking changes over time
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_areas_history` (
  history_id STRING NOT NULL,                -- Unique history record ID
  bid_id STRING NOT NULL,                    -- Reference to bid_areas.bid_id
  
  -- Historical boundary data
  geometry GEOGRAPHY NOT NULL,               -- Historical boundary
  area_sq_meters FLOAT64,                    -- Historical area
  
  -- Change metadata
  change_type STRING,                        -- "boundary_update", "expansion", "contraction"
  change_description STRING,                 -- Description of what changed
  effective_date DATE,                       -- When change took effect
  
  -- Administrative data
  annual_budget_usd INTEGER,                 -- Budget at this time
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  
  -- Status
  replaced_by_history_id STRING             -- Reference to newer version
);

-- =============================================================================
-- 2. PRE-CALCULATED SEGMENTS TABLES
-- =============================================================================

-- Pre-calculated road segments for all BIDs (raw data)
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_segments` (
  bid_segment_id STRING NOT NULL,            -- Unique identifier
  bid_id STRING NOT NULL,                    -- Reference to bid_areas.bid_id
  segment_id STRING NOT NULL,                -- Original segment from Overture
  
  -- Segment data (cached from source)
  name STRING,                               -- Street name
  class STRING NOT NULL,                     -- Road classification
  subclass STRING,                           -- Road subtype
  geometry GEOGRAPHY NOT NULL,               -- Clipped to BID boundary
  length_meters FLOAT64 NOT NULL,            -- Length within BID
  length_miles FLOAT64,                      -- Length in miles
  length_feet FLOAT64,                       -- Length in feet
  
  -- Segment metadata
  is_boundary_segment BOOLEAN DEFAULT FALSE, -- Crosses BID boundary
  clip_percentage FLOAT64,                   -- What % of original segment is in BID
  
  -- Deduplication flags
  is_deduplicated BOOLEAN DEFAULT FALSE,     -- Whether this is a deduplicated segment
  merged_segments_count INTEGER DEFAULT 1,   -- How many original segments merged
  dedup_group_id STRING,                     -- Grouping ID for deduplicated segments
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  
  -- Data freshness
  source_data_version STRING,                -- Version of Overture data used
  last_refresh_date DATE                     -- When data was last refreshed
);

-- Pre-calculated segments with deduplication applied
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_segments_dedup` (
  bid_segment_id STRING NOT NULL,            -- Unique identifier  
  bid_id STRING NOT NULL,                    -- Reference to bid_areas.bid_id
  dedup_group_id STRING NOT NULL,            -- Deduplication group
  
  -- Merged segment data
  name STRING,                               -- Representative street name
  class STRING NOT NULL,                     -- Road classification
  subclass STRING,                           -- Road subtype
  geometry GEOGRAPHY NOT NULL,               -- Unified geometry
  length_meters FLOAT64 NOT NULL,            -- Total merged length
  length_miles FLOAT64,                      -- Length in miles  
  length_feet FLOAT64,                       -- Length in feet
  
  -- Deduplication metadata
  merged_segments_count INTEGER NOT NULL,    -- Number of segments merged
  original_segment_ids ARRAY<STRING>,        -- List of original segment IDs
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- =============================================================================
-- 3. ROLLUP/SUMMARY TABLES
-- =============================================================================

-- Pre-calculated rollup statistics per BID
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_segments_rollup` (
  bid_id STRING NOT NULL,                    -- Reference to bid_areas.bid_id
  calculation_type STRING NOT NULL,          -- "raw" or "deduplicated"
  
  -- Overall metrics
  total_segments INTEGER NOT NULL,           -- Total number of segments
  total_length_meters FLOAT64 NOT NULL,     -- Total length in meters
  total_length_miles FLOAT64 NOT NULL,      -- Total length in miles
  total_length_feet FLOAT64 NOT NULL,       -- Total length in feet
  
  -- Density metrics
  segments_per_sq_mile FLOAT64,             -- Road density metric
  meters_per_sq_mile FLOAT64,               -- Length density metric
  
  -- Per-class breakdown (JSON for flexibility)
  class_breakdown JSON,                      -- {"motorway": {"count": 5, "length_m": 1200}, ...}
  
  -- Calculation metadata
  segments_clipped_to_boundary INTEGER,      -- How many segments were clipped
  boundary_segments INTEGER,                 -- Segments crossing boundary
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  source_data_version STRING,                -- Version of source data
  calculation_duration_seconds FLOAT64       -- How long calculation took
);

-- =============================================================================
-- 4. PLACES DATA (Pre-calculated for BIDs)
-- =============================================================================

-- Pre-calculated places/POI data for BIDs
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_places` (
  bid_place_id STRING NOT NULL,              -- Unique identifier
  bid_id STRING NOT NULL,                    -- Reference to bid_areas.bid_id
  place_id STRING NOT NULL,                  -- Original place from Overture
  
  -- Place data (cached from source)
  name STRING,                               -- Business/place name
  category STRING,                           -- Primary category
  subcategory STRING,                        -- Subcategory
  geometry GEOGRAPHY NOT NULL,               -- Point geometry
  
  -- Place metadata
  confidence_score FLOAT64,                  -- Overture confidence score
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  
  -- Data freshness
  source_data_version STRING,                -- Version of Overture data used
  last_refresh_date DATE                     -- When data was last refreshed
);

-- Pre-calculated places rollup per BID
CREATE OR REPLACE TABLE `ginkgo-map-data.overture_na.bid_places_rollup` (
  bid_id STRING NOT NULL,                    -- Reference to bid_areas.bid_id
  
  -- Overall metrics
  total_places INTEGER NOT NULL,             -- Total number of places
  places_per_sq_mile FLOAT64,               -- Density metric
  
  -- Category breakdown (JSON for flexibility)
  category_breakdown JSON,                   -- {"food_and_drink": {"count": 25}, ...}
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  source_data_version STRING                 -- Version of source data
);

-- =============================================================================
-- 5. INDEXES AND CONSTRAINTS
-- =============================================================================

-- Indexes for performance
-- Note: BigQuery automatically manages clustering and partitioning
-- These are logical constraints that would be enforced in application logic

-- Primary keys (enforced in application)
-- bid_areas: bid_id
-- bid_areas_history: history_id
-- bid_segments: bid_segment_id
-- bid_segments_dedup: bid_segment_id
-- bid_segments_rollup: bid_id + calculation_type
-- bid_places: bid_place_id
-- bid_places_rollup: bid_id

-- Foreign key relationships (enforced in application)
-- bid_areas_history.bid_id -> bid_areas.bid_id
-- bid_segments.bid_id -> bid_areas.bid_id
-- bid_segments_dedup.bid_id -> bid_areas.bid_id
-- bid_segments_rollup.bid_id -> bid_areas.bid_id
-- bid_places.bid_id -> bid_areas.bid_id
-- bid_places_rollup.bid_id -> bid_areas.bid_id

-- =============================================================================
-- 6. SAMPLE DATA INSERTION (for testing)
-- =============================================================================

-- Sample BID for development/testing
INSERT INTO `ginkgo-map-data.overture_na.bid_areas` 
(bid_id, bid_name, bid_short_name, geometry, city, state, established_date, is_active, is_verified)
VALUES 
(
  'SAMPLE_BID_001',
  'Sample Business Improvement District',
  'Sample BID',
  ST_GEOGFROMTEXT('POLYGON((-74.0060 40.7589, -74.0040 40.7589, -74.0040 40.7609, -74.0060 40.7609, -74.0060 40.7589))'), -- Times Square area
  'New York',
  'NY', 
  DATE('2020-01-01'),
  TRUE,
  FALSE -- Not verified - sample data only
);

-- =============================================================================
-- 7. VIEWS FOR EASY QUERYING
-- =============================================================================

-- Convenient view joining BID areas with their metrics
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
  
  -- Road metrics (raw)
  bsr_raw.total_segments as raw_segments,
  bsr_raw.total_length_miles as raw_length_miles,
  bsr_raw.segments_per_sq_mile as raw_segments_per_sq_mile,
  
  -- Road metrics (deduplicated)
  bsr_dedup.total_segments as dedup_segments,
  bsr_dedup.total_length_miles as dedup_length_miles,
  bsr_dedup.segments_per_sq_mile as dedup_segments_per_sq_mile,
  
  -- Places metrics
  bpr.total_places,
  bpr.places_per_sq_mile,
  
  -- Calculation freshness
  bsr_raw.calculated_at as segments_last_calculated,
  bpr.calculated_at as places_last_calculated

FROM `ginkgo-map-data.overture_na.bid_areas` ba
LEFT JOIN `ginkgo-map-data.overture_na.bid_segments_rollup` bsr_raw
  ON ba.bid_id = bsr_raw.bid_id AND bsr_raw.calculation_type = 'raw'
LEFT JOIN `ginkgo-map-data.overture_na.bid_segments_rollup` bsr_dedup  
  ON ba.bid_id = bsr_dedup.bid_id AND bsr_dedup.calculation_type = 'deduplicated'
LEFT JOIN `ginkgo-map-data.overture_na.bid_places_rollup` bpr
  ON ba.bid_id = bpr.bid_id

WHERE ba.is_active = TRUE
ORDER BY ba.bid_name;