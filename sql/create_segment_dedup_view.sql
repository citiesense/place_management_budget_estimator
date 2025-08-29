-- Boulevard Deduplication View for Road Segments
-- This view handles parallel road centerlines (like divided highways and boulevards)
-- by clustering nearby segments and creating unified geometries
-- 
-- Author: Claude
-- Date: 2025-08-29
-- Project: BID Budget Estimator - Road Segments Integration Phase 2

-- Drop existing view if it exists
-- DROP VIEW IF EXISTS `ginkgo-map-data.overture_na.segment_view_dedup`;

-- Create deduplicated segments view
CREATE OR REPLACE VIEW `ginkgo-map-data.overture_na.segment_view_dedup` AS
WITH 
-- Step 1: Get base segments with buffer zones
buffered_segments AS (
  SELECT 
    segment_id,
    name,
    class,
    subclass,
    geometry,
    length_meters,
    -- Create 15-meter buffer around each segment for clustering
    ST_BUFFER(geometry, 15) AS buffer_geom,
    -- Get centroid for clustering
    ST_CENTROID(geometry) AS centroid
  FROM `ginkgo-map-data.overture_na.segment_view`
  WHERE geometry IS NOT NULL
),

-- Step 2: Find parallel road pairs using spatial intersection
parallel_pairs AS (
  SELECT 
    s1.segment_id AS segment_id_1,
    s2.segment_id AS segment_id_2,
    s1.class,
    s1.name,
    -- Check if segments are parallel (similar class and name)
    CASE 
      WHEN s1.class = s2.class 
        AND (
          (s1.name = s2.name AND s1.name IS NOT NULL)
          OR (s1.name IS NULL AND s2.name IS NULL)
        )
      THEN TRUE
      ELSE FALSE
    END AS is_parallel_pair,
    s1.geometry AS geom1,
    s2.geometry AS geom2,
    s1.length_meters AS length1,
    s2.length_meters AS length2
  FROM buffered_segments s1
  JOIN buffered_segments s2
    ON ST_INTERSECTS(s1.buffer_geom, s2.buffer_geom)
    AND s1.segment_id < s2.segment_id  -- Avoid duplicates
  WHERE 
    -- Only consider segments of the same class
    s1.class = s2.class
    -- Focus on major roads where boulevards are common
    AND s1.class IN ('motorway', 'trunk', 'primary', 'secondary')
),

-- Step 3: Create clusters of parallel segments
segment_clusters AS (
  SELECT 
    segment_id_1 AS segment_id,
    -- Use the first segment ID as the cluster representative
    MIN(segment_id_1) OVER (PARTITION BY class, name) AS cluster_id,
    class,
    name,
    geom1 AS geometry,
    length1 AS length_meters
  FROM parallel_pairs
  WHERE is_parallel_pair = TRUE
  
  UNION ALL
  
  SELECT 
    segment_id_2 AS segment_id,
    MIN(segment_id_1) OVER (PARTITION BY class, name) AS cluster_id,
    class,
    name,
    geom2 AS geometry,
    length2 AS length_meters
  FROM parallel_pairs
  WHERE is_parallel_pair = TRUE
),

-- Step 4: Deduplicate by taking one representative per cluster
deduplicated AS (
  SELECT 
    cluster_id AS segment_id,
    ANY_VALUE(name) AS name,
    ANY_VALUE(class) AS class,
    ANY_VALUE(subclass) AS subclass,
    -- Create a unified centerline by merging geometries
    ST_UNION_AGG(geometry) AS geometry,
    -- Sum the lengths (for divided highways, this represents total lane length)
    SUM(length_meters) AS length_meters,
    COUNT(*) AS merged_count
  FROM (
    -- Include clustered segments
    SELECT 
      cluster_id,
      name,
      class,
      'merged' AS subclass,
      geometry,
      length_meters
    FROM segment_clusters
    
    UNION ALL
    
    -- Include non-clustered segments (not part of any boulevard pair)
    SELECT 
      segment_id AS cluster_id,
      name,
      class,
      subclass,
      geometry,
      length_meters
    FROM `ginkgo-map-data.overture_na.segment_view` s
    WHERE NOT EXISTS (
      SELECT 1 
      FROM segment_clusters sc 
      WHERE sc.segment_id = s.segment_id
    )
  )
  GROUP BY cluster_id
)

-- Final output with metadata
SELECT 
  segment_id,
  name,
  class,
  subclass,
  geometry,
  length_meters,
  merged_count,
  -- Add metadata flag for deduplicated segments
  CASE 
    WHEN merged_count > 1 THEN CONCAT('deduplicated_', CAST(merged_count AS STRING), '_segments')
    ELSE 'original'
  END AS dedup_status
FROM deduplicated;

-- Create a simpler version for polygon queries (without the metadata)
CREATE OR REPLACE VIEW `ginkgo-map-data.overture_na.segment_view_dedup_simple` AS
SELECT 
  segment_id,
  name,
  class,
  subclass,
  geometry,
  length_meters
FROM `ginkgo-map-data.overture_na.segment_view_dedup`;