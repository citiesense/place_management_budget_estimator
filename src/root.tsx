import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from "geojson";
import { EnhancedReportPanel } from "./components/EnhancedReportPanel";
import { LocationSearchModal } from "./components/LocationSearchModal";
import {
  GinkgoPanel,
  GinkgoButton,
  GinkgoTitle,
  GinkgoText,
  GinkgoBadge,
} from "./components/GinkgoStyledPanel";
import { ginkgoTheme } from "./styles/ginkgoTheme";
import { CATEGORY_COLORS } from "./constants/categoryColors";
import { 
  addSmartSegmentsLayers, 
  removeAllSegmentLayers, 
  toggleSegmentLayerVisibility,
  addSegmentInteractions,
  logPerformanceMetrics,
  testMVTEndpoint
} from "./utils/mvtIntegration";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE as string; // e.g. mapbox://styles/citiesense/ckc6fzel218uv1jrj6qsnsbw2

// Road class options for filtering
const ROAD_CLASS_OPTIONS = [
  { value: 'motorway', label: 'Motorways', color: '#E63946', description: 'Major highways' },
  { value: 'trunk', label: 'Trunk Roads', color: '#F77F00', description: 'Major arterials' },
  { value: 'primary', label: 'Primary Roads', color: '#FF6B6B', description: 'Main roads' },
  { value: 'secondary', label: 'Secondary Roads', color: '#4ECDC4', description: 'Important local roads' },
  { value: 'tertiary', label: 'Tertiary Roads', color: '#06FFA5', description: 'Local connector roads' },
  { value: 'residential', label: 'Residential Streets', color: '#95E77E', description: 'Neighborhood streets' },
  { value: 'service', label: 'Service Roads', color: '#A8E6CF', description: 'Parking lots, service roads' },
  { value: 'unclassified', label: 'Unclassified Roads', color: '#B4B4B4', description: 'Other roads' },
];

type FeatureCollection = GeoJSON.FeatureCollection;

export default function Root() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [polygon, setPolygon] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [placeCount, setPlaceCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [segmentsData, setSegmentsData] = useState<FeatureCollection | null>(null);
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [showSegments, setShowSegments] = useState(true);
  const [selectedRoadClasses, setSelectedRoadClasses] = useState<string[]>([
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified'
  ]);
  const [useMetricUnits, setUseMetricUnits] = useState(true);
  const [segmentsGeoJSON, setSegmentsGeoJSON] = useState<any>(null);
  const [useMVTTiles, setUseMVTTiles] = useState(false);
  const [currentLayerType, setCurrentLayerType] = useState<'mvt' | 'geojson' | 'none'>('none');
  const [mvtEndpointAvailable, setMvtEndpointAvailable] = useState(false);
  
  // Buildings state
  const [buildingsData, setBuildingsData] = useState<FeatureCollection | null>(null);
  const [buildingsMetrics, setBuildingsMetrics] = useState<any>(null);
  const [showBuildings, setShowBuildings] = useState(true);

  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: "map",
      style: MAPBOX_STYLE,
      center: [-97.5, 39.8],
      zoom: 3.8,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = map;

    // Test MVT endpoint availability on startup
    testMVTEndpoint().then(available => {
      setMvtEndpointAvailable(available);
    });

    // Enhanced polygon drawing with better UX
    let pts: mapboxgl.LngLat[] = [];
    let isDrawing = false;

    function setupDrawingLayers() {
      // Drawing polygon layer
      if (!map.getSource("drawing-poly")) {
        map.addSource("drawing-poly", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "drawing-poly-fill",
          type: "fill",
          source: "drawing-poly",
          paint: { "fill-color": "#ababab", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "drawing-poly-line",
          type: "line",
          source: "drawing-poly",
          paint: {
            "line-color": "#EE7B2C",
            "line-width": 1,
            "line-opacity": 0.5,
          },
        });
      }

      // Drawing points layer
      if (!map.getSource("drawing-points")) {
        map.addSource("drawing-points", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "drawing-points",
          type: "circle",
          source: "drawing-points",
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "isFirst"], true],
              6, // First point larger
              4, // Other points smaller
            ],
            "circle-color": [
              "case",
              ["==", ["get", "isFirst"], true],
              "#f37129", // First point orange (Ginkgo orange)
              "#EE7B2C", // Other points use same orange as border
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.8,
          },
        });
      }

      // Hover effect for first point when polygon can be closed
      if (!map.getSource("first-point-hover")) {
        map.addSource("first-point-hover", {
          type: "geojson",
          data: emptyFC(),
        });
        map.addLayer({
          id: "first-point-hover",
          type: "circle",
          source: "first-point-hover",
          paint: {
            "circle-radius": 10,
            "circle-color": "#f37129",
            "circle-opacity": 0.2,
          },
        });
      }
    }

    function updateDrawing() {
      setupDrawingLayers();

      // Update points
      const pointFeatures = pts.map((pt, index) => ({
        type: "Feature" as const,
        properties: {
          isFirst: index === 0,
          index,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [pt.lng, pt.lat],
        },
      }));

      (map.getSource("drawing-points") as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: pointFeatures,
      });

      // Update polygon/line
      if (pts.length >= 3) {
        // Show closed polygon
        const data = polygonFC(pts);
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(data);
      } else if (pts.length === 2) {
        // Show line between two points
        const lineData = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: pts.map((p) => [p.lng, p.lat]),
              },
            },
          ],
        };
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(
          lineData
        );
      } else {
        // Clear polygon/line
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(
          emptyFC()
        );
      }
    }

    function isClickOnFirstPoint(clickPoint: mapboxgl.LngLat): boolean {
      if (pts.length < 3) return false;
      const firstPoint = pts[0];

      // Use screen pixel distance instead of geographic distance for consistent UX
      const firstPointScreen = map.project(firstPoint);
      const clickPointScreen = map.project(clickPoint);

      const pixelDistance = Math.sqrt(
        Math.pow(firstPointScreen.x - clickPointScreen.x, 2) +
          Math.pow(firstPointScreen.y - clickPointScreen.y, 2)
      );

      // Much more generous: 25 pixel radius
      return pixelDistance < 25;
    }

    function clearDrawing() {
      if (!isDrawing) return;

      isDrawing = false;
      pts = [];
      map.getCanvas().style.cursor = "";

      // Clear all drawing layers
      if (map.getSource("drawing-poly")) {
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(
          emptyFC()
        );
      }
      if (map.getSource("drawing-points")) {
        (map.getSource("drawing-points") as mapboxgl.GeoJSONSource).setData(
          emptyFC()
        );
      }
      if (map.getSource("first-point-hover")) {
        (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData(
          emptyFC()
        );
      }
    }

    function onClick(e: mapboxgl.MapMouseEvent & mapboxgl.EventData) {
      if (!isDrawing) {
        // Start drawing
        isDrawing = true;
        pts = [];
        pts.push(e.lngLat);
        updateDrawing();
        map.getCanvas().style.cursor = "crosshair";
        return;
      }

      // Check if clicking on first point to close polygon
      if (isClickOnFirstPoint(e.lngLat)) {
        if (pts.length >= 3) {
          // Close the polygon
          const fc = polygonFC(pts);
          setPolygon(fc);
          isDrawing = false;
          map.getCanvas().style.cursor = "";
          // Clear drawing layers
          (
            map.getSource("first-point-hover") as mapboxgl.GeoJSONSource
          ).setData(emptyFC());
        }
        return;
      }

      // Add new point
      pts.push(e.lngLat);
      updateDrawing();
    }

    function onMouseMove(e: mapboxgl.MapMouseEvent) {
      if (!isDrawing || pts.length < 3) return;

      // Show hover effect on first point when polygon can be closed
      if (isClickOnFirstPoint(e.lngLat)) {
        map.getCanvas().style.cursor = "pointer";
        (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [pts[0].lng, pts[0].lat],
              },
            },
          ],
        });
      } else {
        map.getCanvas().style.cursor = "crosshair";
        (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData(
          emptyFC()
        );
      }
    }

    // Prevent double-click zoom when drawing
    function onDblClick(e: mapboxgl.MapMouseEvent & mapboxgl.EventData) {
      if (isDrawing) {
        e.preventDefault();
      }
    }

    // Right-click to clear drawing
    function onContextMenu(e: mapboxgl.MapMouseEvent & mapboxgl.EventData) {
      if (isDrawing) {
        e.preventDefault();
        clearDrawing();
      }
    }

    // Escape key to clear drawing
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isDrawing) {
        clearDrawing();
      }
    }

    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    map.on("dblclick", onDblClick);
    map.on("contextmenu", onContextMenu);

    // Setup drawing layers when map is ready
    map.on("load", () => {
      setupDrawingLayers();
    });

    // Add keyboard listener to document
    document.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMouseMove);
      map.off("dblclick", onDblClick);
      map.off("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      map.remove();
    };
  }, []);

  // Simple client-side deduplication for parallel roads

  async function fetchSegments() {
    if (!polygon) return;
    try {
      // Use dedup view if deduplication is enabled
      const baseTable = import.meta.env.VITE_SEGMENTS_TABLE || "ginkgo-map-data.overture_na.segment_view";
      const segmentsTable = baseTable; // Use regular table for now
      
      
      // Query to get road segments within polygon
      const sql = `
        WITH poly AS (
          SELECT ST_GEOGFROMGEOJSON(@polygon_geojson) AS g
        ),
        segments_in_poly AS (
          SELECT
            segment_id,
            name,
            class,
            subclass,
            geometry,
            length_meters
          FROM \`${segmentsTable}\`, poly
          WHERE ST_INTERSECTS(geometry, poly.g)
            AND geometry IS NOT NULL
            AND class IN UNNEST(@selected_classes)
          LIMIT 5000
        )
        SELECT
          segment_id,
          name,
          class,
          subclass,
          ST_ASGEOJSON(geometry) AS geom_json,
          length_meters,
          -- Overall metrics
          COUNT(*) OVER() AS total_segments,
          SUM(length_meters) OVER() AS total_length_m,
          SUM(length_meters) OVER() / 1609.34 AS total_length_miles,
          SUM(length_meters) OVER() * 3.28084 AS total_length_ft,
          -- Per-class metrics
          COUNT(*) OVER(PARTITION BY class) AS class_count,
          SUM(length_meters) OVER(PARTITION BY class) AS class_length_m,
          SUM(length_meters) OVER(PARTITION BY class) / 1609.34 AS class_length_miles,
          SUM(length_meters) OVER(PARTITION BY class) * 3.28084 AS class_length_ft
        FROM segments_in_poly
      `;

      const r = await fetch(import.meta.env.VITE_SQL_PROXY || "/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sql,
          params: {
            polygon_geojson: JSON.stringify(polygon.features[0].geometry),
            selected_classes: selectedRoadClasses,
          },
        }),
      });

      const data = await r.json();
      
      
      if (!r.ok)
        throw new Error(data?.error || `Segments query failed with status ${r.status}`);
      
      // Check if response is already in GeoJSON format
      let fc: FeatureCollection;
      let totalSegments = 0;
      
      if (data.geojson) {
        // SQL proxy auto-converted to GeoJSON
        fc = data.geojson;
        totalSegments = data.count || fc.features.length;
        
        // Extract metrics from the first feature if available
        if (fc.features.length > 0 && fc.features[0].properties) {
          totalSegments = fc.features[0].properties.total_segments || totalSegments;
        }
      } else {
        // Raw rows format
        const rows = data.rows || [];
        
        // Convert to GeoJSON
        const features = rows.map((row: any) => ({
          type: "Feature",
          properties: {
            id: row.segment_id,
            name: row.name,
            class: row.class,
            subclass: row.subclass,
            length_m: row.length_meters,
          },
          geometry: JSON.parse(row.geom_json),
        }));

        fc = {
          type: "FeatureCollection",
          features,
        };
        
        totalSegments = rows[0]?.total_segments || 0;
      }
      
      setSegmentsData(fc);
      setSegmentCount(totalSegments);
      setSegmentsGeoJSON(fc); // Store for export functionality
      
      // Process enhanced metrics data if we have segments
      if (fc.features.length > 0) {
        const firstFeature = fc.features[0].properties;
        
        // Build detailed class breakdowns from all segments
        const classMetrics = new Map();
        fc.features.forEach((feature: any) => {
          const props = feature.properties;
          const className = props.class;
          if (className && !classMetrics.has(className)) {
            classMetrics.set(className, {
              class: className,
              count: props.class_count || 0,
              lengthM: props.class_length_m || 0,
              lengthMiles: props.class_length_miles || 0,
              lengthFt: props.class_length_ft || 0,
              color: ROAD_CLASS_OPTIONS.find(opt => opt.value === className)?.color || '#999999'
            });
          }
        });
        
        const totalLengthM = firstFeature?.total_length_m || 0;
        const totalLengthMiles = firstFeature?.total_length_miles || 0;
        
        // Create segments array from features for RoadsAnalytics component
        let segmentsArray = fc.features.map((feature: any) => ({
          segment_id: feature.properties.segment_id,
          name: feature.properties.name,
          class: feature.properties.class,
          subclass: feature.properties.subclass,
          length_meters: feature.properties.length_meters,
          merged_count: feature.properties.merged_count || 1,
          dedup_status: feature.properties.dedup_status || 'original',
          geometry: feature.geometry,
          ...feature.properties
        }));


        // Recalculate metrics based on potentially deduplicated segments
        const actualTotal = segmentsArray.length;
        const actualTotalLengthM = segmentsArray.reduce((sum, seg) => sum + seg.length_meters, 0);
        const actualTotalLengthMiles = actualTotalLengthM / 1609.34;
        const actualTotalLengthFt = actualTotalLengthM * 3.28084;

        // Recalculate class breakdowns with deduplicated data
        const actualClassMetrics = new Map();
        segmentsArray.forEach((segment: any) => {
          const className = segment.class;
          if (className) {
            if (!actualClassMetrics.has(className)) {
              actualClassMetrics.set(className, {
                class: className,
                count: 0,
                lengthM: 0,
                lengthMiles: 0,
                lengthFt: 0,
                color: ROAD_CLASS_OPTIONS.find(opt => opt.value === className)?.color || '#999999'
              });
            }
            const metrics = actualClassMetrics.get(className);
            metrics.count += 1;
            metrics.lengthM += segment.length_meters;
            metrics.lengthMiles += segment.length_meters / 1609.34;
            metrics.lengthFt += segment.length_meters * 3.28084;
          }
        });

        const enhancedSegmentsData = {
          // Metrics data (using actual deduplicated values)
          total: actualTotal,
          totalLengthM: actualTotalLengthM,
          totalLengthMiles: actualTotalLengthMiles,
          totalLengthFt: actualTotalLengthFt,
          classByClass: Array.from(actualClassMetrics.values()),
          // Calculate density (using estimated area if not available from places)
          densityPerKm2: reportData?.areaKm2 ? actualTotalLengthM / (reportData.areaKm2 * 1000) : 0,
          densityPerMile2: reportData?.areaKm2 ? (actualTotalLengthMiles * 5280) / (reportData.areaKm2 * 0.386102) : 0,
          // Raw segments array for RoadsAnalytics component
          segments: segmentsArray
        };
        
        
        // Update report data with enhanced segments metrics
        if (reportData) {
          setReportData({
            ...reportData,
            segments: enhancedSegmentsData
          });
        } else {
          setReportData({
            segments: enhancedSegmentsData,
            // Add default values required by budget calculations
            totalPlaces: 0,
            areaAcres: 0,
            categoryBreakdown: {}
          });
        }
      }
      
      // Use smart layer selection (MVT vs GeoJSON)
      const startTime = Date.now();
      const map = mapRef.current!;
      const layerType = addSmartSegmentsLayers(
        map,
        fc,
        totalSegments,
        selectedRoadClasses,
        showSegments
      );
      const loadTime = Date.now() - startTime;
      
      setCurrentLayerType(layerType);
      logPerformanceMetrics(layerType, totalSegments, loadTime);
      
      // Add interaction handlers if layer was created
      if (layerType !== 'none') {
        addSegmentInteractions(mapRef.current!, layerType);
      }
    } catch (e: any) {
      // Handle error silently in production
      setError(e.message);
    }
  }

  async function fetchAllData() {
    if (!polygon) return;
    setLoading(true);
    setError(null);
    
    try {
      // Fetch segments first, then buildings, then places (so places render on top)
      await fetchSegments();
      await fetchBuildings();
      await fetchPlaces();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlaces() {
    if (!polygon) return;
    try {

      // Use the SQL proxy endpoint with the proper query
      const placesTable =
        import.meta.env.VITE_PLACES_TABLE || "overture_na.place_view";

      // Enhanced query to get both individual places and aggregated data for reports
      const sql = `
        WITH poly AS (
          SELECT ST_GEOGFROMGEOJSON(@polygon_geojson) AS g
        ),
        places_in_poly AS (
          SELECT
            place_id AS id,
            category,
            name,
            ST_X(geometry) AS lng,
            ST_Y(geometry) AS lat,
            geometry
          FROM \`${placesTable}\`, poly
          WHERE ST_INTERSECTS(geometry, poly.g)
          LIMIT 10000
        )
        SELECT
          -- Individual place data
          id,
          category,
          name,
          lng,
          lat,
          -- Aggregated metrics for reports
          COUNT(*) OVER() AS total_places,
          ST_AREA(poly.g) / 1000000 AS area_km2,
          ST_AREA(poly.g) / 4046.86 AS area_acres,
          ST_PERIMETER(poly.g) * 3.28084 AS perimeter_ft,
          COUNT(*) OVER() / (ST_AREA(poly.g) / 1000000) AS density_per_km2,
          -- Detailed category counts for new budget model
          COUNT(*) OVER(PARTITION BY category) AS category_count,
          COUNT(CASE WHEN LOWER(category) IN ('retail', 'shopping', 'store') THEN 1 END) OVER() AS retail_count,
          COUNT(CASE WHEN LOWER(category) IN ('restaurant', 'food', 'food_and_drink', 'cafe', 'bar') THEN 1 END) OVER() AS food_count,
          COUNT(CASE WHEN LOWER(category) IN ('service', 'services', 'professional') THEN 1 END) OVER() AS service_count,
          COUNT(CASE WHEN LOWER(category) IN ('entertainment', 'recreation', 'leisure', 'nightlife') THEN 1 END) OVER() AS entertainment_count,
          COUNT(CASE WHEN LOWER(category) IN ('hotel', 'lodging', 'accommodation') THEN 1 END) OVER() AS lodging_count,
          COUNT(CASE WHEN category IS NULL OR category = '' THEN 1 END) OVER() AS unknown_count
        FROM places_in_poly, poly
        ORDER BY category, name
      `;

      const r = await fetch(import.meta.env.VITE_SQL_PROXY || "/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sql,
          params: {
            polygon_geojson: JSON.stringify(polygon.features[0].geometry),
          },
        }),
      });

      const data = await r.json();

      if (!r.ok)
        throw new Error(data?.error || `Query failed with status ${r.status}`);

      const rows = data.rows || [];

      // Convert rows to GeoJSON FeatureCollection
      const features = rows.map((row: any) => ({
        type: "Feature",
        properties: {
          id: row.id,
          name: row.name,
          category: row.category,
        },
        geometry: {
          type: "Point",
          coordinates: [row.lng, row.lat],
        },
      }));

      const fc: FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      // Extract aggregated metrics from first row (same across all rows due to window functions)
      const firstRow = rows[0];
      if (firstRow) {
        // Build complete category breakdown from actual data
        const categoryMap = new Map<string, number>();
        rows.forEach((row: any) => {
          if (row.category) {
            const cat = row.category.toLowerCase();
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
          }
        });

        const metrics = {
          totalPlaces: firstRow.total_places || 0,
          areaKm2: firstRow.area_km2 || 0,
          areaAcres: firstRow.area_acres || 0,
          perimeterFt: firstRow.perimeter_ft || 0,
          densityPerKm2: firstRow.density_per_km2 || 0,
          categoryBreakdown: {
            retail: firstRow.retail_count || 0,
            food: firstRow.food_count || 0,
            restaurant: firstRow.food_count || 0, // Alias for compatibility
            service: firstRow.service_count || 0,
            entertainment: firstRow.entertainment_count || 0,
            lodging: firstRow.lodging_count || 0,
            unknown: firstRow.unknown_count || 0,
            // Add any other categories found
            ...Object.fromEntries(categoryMap),
          },
          places: features, // Store individual places for detailed analysis
        };
        // Preserve existing segments data if it exists
        setReportData(prevData => ({
          ...metrics,
          ...(prevData?.segments && { segments: prevData.segments })
        }));
      }

      addPlacesLayer(fc);
      setPlaceCount(fc.features.length);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function fetchBuildings() {
    if (!polygon) return;
    try {
      const buildingsTable = import.meta.env.VITE_BUILDINGS_TABLE || "ginkgo-map-data.overture_na.building_view";
      
      // Query with the correct column names from your table structure
      const sql = `
        SELECT 
          building_id,
          ST_AREA(geometry) AS footprint_area_sqm,
          height,
          level,
          ST_ASGEOJSON(ST_SIMPLIFY(geometry, 1)) AS geom_json
        FROM \`${buildingsTable}\`
        WHERE ST_INTERSECTS(geometry, ST_GEOGFROMGEOJSON(@polygon_geojson))
        ORDER BY ST_AREA(geometry) DESC
        LIMIT 1000
      `;

      // Also get the BID area for coverage calculations
      const bidAreaSql = `
        SELECT ST_AREA(ST_GEOGFROMGEOJSON(@polygon_geojson)) AS bid_area_sqm
      `;

      // Fetch building data
      const buildingsResponse = await fetch(import.meta.env.VITE_SQL_PROXY || "/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sql,
          params: {
            polygon_geojson: JSON.stringify(polygon.features[0].geometry),
          },
        }),
      });
      
      const buildingsData = await buildingsResponse.json();
      console.log("Buildings API response:", buildingsData);
      
      if (!buildingsResponse.ok) {
        throw new Error(buildingsData?.error || `Buildings query failed with status ${buildingsResponse.status}`);
      }

      // Fetch BID area
      const areaResponse = await fetch(import.meta.env.VITE_SQL_PROXY || "/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: bidAreaSql,
          params: {
            polygon_geojson: JSON.stringify(polygon.features[0].geometry),
          },
        }),
      });
      
      const areaData = await areaResponse.json();
      console.log("BID area response:", areaData);
      
      if (!areaResponse.ok) {
        throw new Error(areaData?.error || `BID area query failed with status ${areaResponse.status}`);
      }

      const bidAreaSqm = areaData.rows?.[0]?.bid_area_sqm || 0;
      
      // Check if response is already GeoJSON format (auto-converted by SQL proxy)
      let buildingRows = [];
      let buildingsGeoJSON = null;
      
      if (buildingsData.geojson && buildingsData.geojson.features) {
        // Response is already GeoJSON format
        buildingsGeoJSON = buildingsData.geojson;
        buildingRows = buildingsGeoJSON.features.map((feature: any) => ({
          building_id: feature.properties.building_id,
          footprint_area_sqm: feature.properties.footprint_area_sqm,
          height: feature.properties.height,
          level: feature.properties.level,
          geom_json: JSON.stringify(feature.geometry)
        }));
      } else if (buildingsData.rows) {
        // Response is in rows format
        buildingRows = buildingsData.rows || [];
      }
      
      console.log(`Found ${buildingRows.length} buildings in polygon`);
      console.log("Sample building data:", buildingRows[0]);
      
      // Calculate metrics client-side
      const buildingCount = buildingRows.length;
      const totalFootprintSqm = buildingRows.reduce((sum: number, row: any) => sum + (row.footprint_area_sqm || 0), 0);
      const avgFootprintSqm = buildingCount > 0 ? totalFootprintSqm / buildingCount : 0;
      const coveragePercentage = bidAreaSqm > 0 ? (totalFootprintSqm / bidAreaSqm) * 100 : 0;
      const bidAreaHectares = bidAreaSqm / 10000;
      const buildingDensityPerHectare = bidAreaHectares > 0 ? buildingCount / bidAreaHectares : 0;

      // Calculate size distribution
      const sizeDistribution = buildingRows.reduce((dist: any, row: any) => {
        const area = row.footprint_area_sqm || 0;
        if (area < 50) dist.small_buildings++;
        else if (area < 200) dist.medium_buildings++;
        else if (area < 1000) dist.large_buildings++;
        else dist.very_large_buildings++;
        return dist;
      }, { small_buildings: 0, medium_buildings: 0, large_buildings: 0, very_large_buildings: 0 });

      // Calculate height statistics from direct columns
      const buildingsWithHeight = buildingRows.filter((row: any) => row.height && row.height > 0).length;
      const avgHeightMeters = buildingsWithHeight > 0 ? 
        buildingRows.reduce((sum: number, row: any) => sum + (parseFloat(row.height) || 0), 0) / buildingsWithHeight : 0;

      const buildingsWithLevels = buildingRows.filter((row: any) => row.level && row.level > 0).length;
      const avgLevels = buildingsWithLevels > 0 ?
        buildingRows.reduce((sum: number, row: any) => sum + (parseInt(row.level) || 0), 0) / buildingsWithLevels : 0;

      // Create metrics object
      const metrics = {
        building_count: buildingCount,
        total_footprint_sqm: totalFootprintSqm,
        coverage_percentage: coveragePercentage,
        building_density_per_hectare: buildingDensityPerHectare,
        avg_footprint_sqm: avgFootprintSqm,
        bid_area_sqm: bidAreaSqm,
        bid_area_acres: bidAreaSqm / 4047,
        ...sizeDistribution,
        buildings_with_height: buildingsWithHeight,
        avg_height_meters: avgHeightMeters,
        buildings_with_levels: buildingsWithLevels,
        avg_levels: avgLevels
      };
      
      console.log("Calculated building metrics:", metrics);
      setBuildingsMetrics(metrics);
      
      // Use existing GeoJSON or create from rows
      let fc: FeatureCollection;
      
      if (buildingsGeoJSON) {
        // Use the GeoJSON that came from the SQL proxy
        fc = buildingsGeoJSON;
        // Update properties to match our expected format
        fc.features.forEach((feature: any) => {
          feature.properties.name = 'Building';
          feature.properties.area_sqm = feature.properties.footprint_area_sqm;
          feature.properties.height_meters = feature.properties.height;
          feature.properties.levels = feature.properties.level;
          feature.properties.building_class = null;
        });
      } else {
        // Convert from rows to GeoJSON
        const features = buildingRows.map((row: any) => ({
          type: "Feature",
          properties: {
            building_id: row.building_id,
            name: 'Building',
            area_sqm: row.footprint_area_sqm,
            height_meters: row.height,
            levels: row.level,
            building_class: null
          },
          geometry: JSON.parse(row.geom_json),
        }));

        fc = {
          type: "FeatureCollection",
          features,
        };
      }

      console.log("Created buildings GeoJSON with", fc.features.length, "features");
      console.log("Sample feature:", fc.features[0]);
      
      setBuildingsData(fc);
      addBuildingsLayer(fc);
      
      console.log("Added buildings layer to map");
      
    } catch (e: any) {
      setError(e.message);
    }
  }

  function addSegmentsLayer(fc: FeatureCollection) {
    const map = mapRef.current!;
    
    // Define colors for different road classes
    const segmentColors: any[] = [
      "match",
      ["get", "class"],
      "motorway", "#E63946",      // Dark red for motorways
      "trunk", "#F77F00",         // Orange for trunk roads
      "primary", "#FF6B6B",       // Red for primary roads
      "secondary", "#4ECDC4",     // Teal for secondary roads
      "tertiary", "#06FFA5",      // Green for tertiary
      "residential", "#95E77E",   // Light green for residential
      "service", "#A8E6CF",       // Pale green for service roads
      "unclassified", "#B4B4B4",  // Gray for unclassified
      "motorway_link", "#E63946", // Same as motorway
      "trunk_link", "#F77F00",    // Same as trunk
      "primary_link", "#FF6B6B",  // Same as primary
      "secondary_link", "#4ECDC4", // Same as secondary
      "tertiary_link", "#06FFA5", // Same as tertiary
      "#999999"                   // Default gray
    ];
    
    // Add segments source and layer
    if (!map.getSource("segments")) {
      map.addSource("segments", { type: "geojson", data: fc });
      
      // Add line layer for segments
      map.addLayer({
        id: "segments-lines",
        type: "line",
        source: "segments",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": segmentColors,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 1,
            14, 2,
            18, 4,
          ],
          "line-opacity": 0.7,
        },
      });
      
      // Add hover popup
      map.on("mouseenter", "segments-lines", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      
      map.on("mouseleave", "segments-lines", () => {
        map.getCanvas().style.cursor = "";
      });
      
      map.on("click", "segments-lines", (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px;">
              <strong>${props.name || "Unnamed Road"}</strong><br/>
              <span>Class: ${props.class || "Unknown"}</span><br/>
              ${props.subclass ? `<span>Subclass: ${props.subclass}</span><br/>` : ""}
              <span>Length: ${props.length_m ? Math.round(props.length_m) + "m" : "N/A"}</span>
            </div>
          `)
          .addTo(map);
      });
    } else {
      (map.getSource("segments") as mapboxgl.GeoJSONSource).setData(fc);
    }
  }

  function addPlacesLayer(fc: FeatureCollection) {
    const map = mapRef.current!;
    // build categorical match expression using unified colors
    const matchExp: any[] = [
      "match",
      ["coalesce", ["downcase", ["get", "category"]], "other"],
    ];
    Object.entries(CATEGORY_COLORS).forEach(([cat, hex]) => {
      matchExp.push(cat, hex);
    });
    matchExp.push(CATEGORY_COLORS.other);

    // source
    if (!map.getSource("places")) {
      map.addSource("places", { type: "geojson", data: fc });
      map.addLayer({
        id: "places-circles",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            1,   // Very small at low zoom
            10,
            2,   // Small at medium zoom  
            14,
            3,   // Still small at high zoom
          ],
          "circle-color": matchExp,
          "circle-opacity": 0.85,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.5,
        },
      });
    } else {
      (map.getSource("places") as mapboxgl.GeoJSONSource).setData(fc);
    }
  }

  function addBuildingsLayer(fc: FeatureCollection) {
    const map = mapRef.current!;
    
    if (!map.getSource("buildings")) {
      map.addSource("buildings", { type: "geojson", data: fc });
      
      // Add building fill layer with light blue-gray color
      map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: "buildings",
        paint: {
          "fill-color": "#DFEBEF",
          "fill-opacity": 0.9,
        },
      });
      
      // Add building outline layer with dark navy border
      map.addLayer({
        id: "buildings-outline",
        type: "line",
        source: "buildings", 
        paint: {
          "line-color": "#162E54",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0,   // No border below zoom 13
            13, 0.5, // Thin border at zoom 13+
            16, 1    // Slightly thicker at higher zoom
          ],
          "line-opacity": [
            "interpolate", 
            ["linear"],
            ["zoom"],
            12, 0,   // No border below zoom 13
            13, 0.8, // Visible border at zoom 13+
            16, 1
          ],
        },
      });
      
      // Add building labels (name/size info)
      map.addLayer({
        id: "buildings-labels",
        type: "symbol",
        source: "buildings",
        layout: {
          "text-field": ["concat", ["to-string", ["round", ["get", "area_sqm"]]], " m²"],
          "text-font": ["Open Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"], 
            ["zoom"],
            15, 8,
            18, 10
          ],
          "text-offset": [0, -0.5],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "symbol-placement": "point"
        },
        paint: {
          "text-color": "#858585",
          "text-halo-color": "#FFFFFF", 
          "text-halo-width": 1,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 0,   // No labels below zoom 15
            15, 0.8, // Fade in labels
            18, 1
          ]
        },
        minzoom: 15
      });
      
      // Position buildings below places but above road segments
      if (map.getLayer("places-circles")) {
        map.moveLayer("buildings-fill", "places-circles");
        map.moveLayer("buildings-outline", "places-circles"); 
        map.moveLayer("buildings-labels", "places-circles");
      }
    } else {
      (map.getSource("buildings") as mapboxgl.GeoJSONSource).setData(fc);
    }
  }

  function clearAll() {
    const map = mapRef.current!;

    // Clear places results
    if (map.getSource("places")) {
      map.removeLayer("places-circles");
      map.removeSource("places");
    }

    // Clear buildings results
    if (map.getSource("buildings")) {
      map.removeLayer("buildings-fill");
      map.removeLayer("buildings-outline");
      map.removeLayer("buildings-labels");
      map.removeSource("buildings");
    }
    
    // Clear all segment layers (both MVT and GeoJSON)
    removeAllSegmentLayers(map);

    // Clear drawing layers
    if (map.getSource("drawing-poly")) {
      (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(
        emptyFC()
      );
    }
    if (map.getSource("drawing-points")) {
      (map.getSource("drawing-points") as mapboxgl.GeoJSONSource).setData(
        emptyFC()
      );
    }
    if (map.getSource("first-point-hover")) {
      (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData(
        emptyFC()
      );
    }

    // Reset cursor
    map.getCanvas().style.cursor = "";

    setPolygon(null);
    setPlaceCount(null);
    setSegmentsData(null);
    setSegmentCount(null);
    setBuildingsData(null);
    setBuildingsMetrics(null);
    setSelectedRoadClasses(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified']);
    setCurrentLayerType('none');
    setError(null);
    setReportData(null);
    setShowReport(false);
  }

  // Handle location selection from search modal
  const handleLocationSelected = (location: any) => {
    const map = mapRef.current;
    if (!map) return;

    // Determine zoom level based on location type
    let zoom = 10; // Default zoom
    const placeTypes = location.place_type || [];

    if (placeTypes.includes("address")) {
      zoom = 16; // High zoom for addresses
    } else if (
      placeTypes.includes("neighborhood") ||
      placeTypes.includes("locality")
    ) {
      zoom = 14; // Medium-high zoom for neighborhoods/towns
    } else if (placeTypes.includes("place")) {
      zoom = 12; // Medium zoom for cities
    } else if (placeTypes.includes("region")) {
      zoom = 8; // Lower zoom for states/regions
    } else if (placeTypes.includes("country")) {
      zoom = 6; // Lowest zoom for countries
    }

    // Fly to the selected location
    map.flyTo({
      center: location.center,
      zoom: zoom,
      duration: 2000,
      essential: true,
    });

    // Store current location name for display
    setCurrentLocation(location.place_name);
  };

  // Handle opening location search
  const handleOpenLocationSearch = () => {
    setShowLocationSearch(true);
  };

  // Center map on polygon bounds
  const centerMapOnPolygon = () => {
    if (!polygon || !polygon.features.length) return;

    const map = mapRef.current;
    if (!map) return;

    const coords = polygon.features[0].geometry.coordinates[0];

    // Calculate bounds from polygon coordinates
    let minLng = coords[0][0],
      maxLng = coords[0][0];
    let minLat = coords[0][1],
      maxLat = coords[0][1];

    coords.forEach(([lng, lat]: number[]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    // Fit bounds with padding
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 50,
        duration: 1000,
      }
    );
  };

  return (
    <div
      className="app"
      style={{ height: "100vh", width: "100vw", position: "relative" }}
    >
      <div
        id="map"
        style={{
          height: "100%",
          width: showReport ? (showFullReport ? "0%" : "50%") : "100%",
          transition: "width 0.3s ease",
          overflow: "hidden",
        }}
      />

      {/* Left-Edge Sidebar Toggle Tab */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        style={{
          position: "absolute",
          top: "50%",
          left: "0px",
          transform: "translateY(-50%)",
          zIndex: 2000,
          padding: "16px 8px",
          backgroundColor: ginkgoTheme.colors.primary.orange,
          color: "white",
          border: "none",
          borderRadius: "0 12px 12px 0",
          cursor: "pointer",
          fontSize: "18px",
          fontWeight: 600,
          fontFamily: ginkgoTheme.typography.fontFamily.body,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
          transition: "all 0.3s ease",
          width: "16px",
          height: "60px",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#0feaa6"; // Green hover
          e.currentTarget.style.width = "48px";
          e.currentTarget.style.padding = "16px 12px";
          e.currentTarget.style.boxShadow =
            "4px 0 12px rgba(15, 234, 166, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor =
            ginkgoTheme.colors.primary.orange;
          e.currentTarget.style.width = "16px";
          e.currentTarget.style.padding = "16px 8px";
          e.currentTarget.style.boxShadow = "2px 0 8px rgba(0,0,0,0.15)";
        }}
        title={showSidebar ? "Hide Panel" : "Show Panel"}
      >
        {showSidebar ? "‹" : "›"}
      </button>

      {/* Sidebar Panel - Conditionally Rendered */}
      {showSidebar && (
        <GinkgoPanel>
          {/* Ginkgo Logo Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "20px",
              paddingBottom: "16px",
              borderBottom: `2px solid ${ginkgoTheme.colors.primary.orange}`,
            }}
          >
            <img
              src="/assets/GinkgoWordmark_Orange.svg"
              alt="Ginkgo"
              style={{
                height: "32px",
                width: "auto",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "16px",
            }}
          >
            <div>
              <GinkgoTitle level={2}>BID Budget Estimator</GinkgoTitle>
              {currentLocation && (
                <GinkgoText
                  style={{
                    fontSize: "12px",
                    color: ginkgoTheme.colors.primary.navy,
                    fontWeight: 500,
                    marginTop: "4px",
                  }}
                >
                  {currentLocation}
                </GinkgoText>
              )}
            </div>
            <GinkgoButton
              onClick={handleOpenLocationSearch}
              variant="secondary"
              style={{ padding: "8px 12px", fontSize: "12px" }}
            >
              Search Location
            </GinkgoButton>
          </div>
          <GinkgoText muted>
            Draw a polygon to analyze your district. Click to add points, click
            the first point to close.
          </GinkgoText>

          {polygon ? (
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <GinkgoButton
                disabled={loading}
                onClick={fetchAllData}
                variant="primary"
              >
                Analyze District
              </GinkgoButton>
              <GinkgoButton onClick={clearAll} variant="secondary">
                Clear
              </GinkgoButton>
            </div>
          ) : (
            <GinkgoBadge variant="default">Draw a polygon to begin</GinkgoBadge>
          )}

          {loading && (
            <div style={{ marginTop: "12px" }}>
              <GinkgoBadge variant="warning">Analyzing...</GinkgoBadge>
            </div>
          )}

          {error && (
            <div style={{ marginTop: "12px" }}>
              <GinkgoBadge variant="error">Error: {error}</GinkgoBadge>
            </div>
          )}

          {(placeCount !== null || segmentCount !== null) && (
            <div style={{ marginTop: "16px" }}>
              {placeCount !== null && (
                <GinkgoText>
                  <strong style={{ color: ginkgoTheme.colors.primary.navy }}>
                    {placeCount.toLocaleString()}
                  </strong>{" "}
                  businesses found
                </GinkgoText>
              )}
              {segmentCount !== null && (
                <div style={{ marginTop: "8px" }}>
                  <GinkgoText>
                    <strong style={{ color: ginkgoTheme.colors.primary.navy }}>
                      {segmentCount.toLocaleString()}
                    </strong>{" "}
                    road segments found
                  </GinkgoText>
                  {currentLayerType !== 'none' && (
                    <GinkgoText style={{ 
                      fontSize: "11px", 
                      color: ginkgoTheme.colors.text.light,
                      marginTop: "2px"
                    }}>
                      Rendered with {currentLayerType === 'mvt' ? 'vector tiles' : 'GeoJSON'}
                      {currentLayerType === 'mvt' && ' ⚡'}
                    </GinkgoText>
                  )}
                </div>
              )}
              
              {/* Toggle for showing/hiding segments */}
              <div style={{ marginTop: "12px" }}>
                <label style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: ginkgoTheme.colors.primary.navy
                }}>
                  <input 
                    type="checkbox"
                    checked={showSegments}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowSegments(checked);
                      const map = mapRef.current;
                      if (map && currentLayerType !== 'none') {
                        toggleSegmentLayerVisibility(map, checked, currentLayerType);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  Show road segments
                </label>
              </div>
              
              
            </div>
          )}

          {reportData && (
            <GinkgoButton
              onClick={() => {
                setShowReport(true);
                setShowSidebar(false); // Auto-close sidebar when opening report
                setTimeout(() => centerMapOnPolygon(), 100); // Center map after report opens
              }}
              variant="primary"
              style={{ marginTop: "12px", width: "100%" }}
            >
              View Full Report
            </GinkgoButton>
          )}
        </GinkgoPanel>
      )}

      {/* Location Search Modal */}
      <LocationSearchModal
        isOpen={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onLocationSelected={handleLocationSelected}
        mapboxToken={MAPBOX_TOKEN}
      />

      {/* Enhanced Sliding Report Panel */}
      {showReport && reportData && (
        <EnhancedReportPanel
          data={reportData}
          onClose={() => {
            setShowReport(false);
            setShowFullReport(false);
            setShowSidebar(true); // Auto-restore sidebar when closing report
          }}
          mapVisible={true}
          onFullReportToggle={(isFullReport) => setShowFullReport(isFullReport)}
          polygon={polygon}
          mapboxToken={MAPBOX_TOKEN}
          selectedRoadClasses={selectedRoadClasses}
          setSelectedRoadClasses={setSelectedRoadClasses}
          onApplyRoadFilters={() => {
            if (polygon && selectedRoadClasses.length > 0) {
              fetchSegments();
            }
          }}
          useMetricUnits={useMetricUnits}
          setUseMetricUnits={setUseMetricUnits}
          segmentsGeoJSON={segmentsGeoJSON}
          buildingsMetrics={buildingsMetrics}
          showBuildings={showBuildings}
          setShowBuildings={setShowBuildings}
        />
      )}
    </div>
  );
}

function emptyFC(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function polygonFC(pts: mapboxgl.LngLat[]): FeatureCollection {
  const ring = [...pts.map((p) => [p.lng, p.lat]), [pts[0].lng, pts[0].lat]];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] } as any,
      },
    ],
  };
}
