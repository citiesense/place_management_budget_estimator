import React, { useEffect, useRef, useState } from "react";
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
  GinkgoLegend 
} from "./components/GinkgoStyledPanel";
import { ginkgoTheme } from "./styles/ginkgoTheme";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE as string; // e.g. mapbox://styles/citiesense/ckc6fzel218uv1jrj6qsnsbw2

type FeatureCollection = GeoJSON.FeatureCollection;

const CATEGORY_COLORS: Record<string, string> = {
  // === Base Categories ===
  food_and_drink: "#f37129",     // Ginkgo orange
  shopping: "#0feaa6",            // Ginkgo green
  health: "#034744",              // Ginkgo dark teal
  education: "#162e54",           // Ginkgo navy
  entertainment: "#ec4899",       // Pink for better visibility
  transportation: "#06b6d4",      // Cyan for better visibility
  finance: "#8b5cf6",             // Purple for better visibility
  government: "#9e765f",          // Brown
  other: "#6b7280",               // Gray for uncategorized
  retail: "#0feaa6",              // Map retail to green
  restaurant: "#f37129",          // Map restaurant to orange
  service: "#034744",             // Map service to dark teal
  
  // === All Categories from Pie Chart ===
  "beauty_salon": "#e11d48",           // Rose
  "professional_services": "#3b82f6", // Blue  
  "tattoo_and_piercing": "#a855f7",   // Purple
  "community_services_non_profits": "#22c55e", // Green
  "landmark_and_historical_building": "#8b5cf6", // Violet
  "automotive_repair": "#047857",       // Dark green
  "coffee_shop": "#78350f",            // Dark brown
  "counseling_and_mental_health": "#831843", // Dark pink
  "gym": "#047857",                    // Emerald
  "art_gallery": "#fb923c",            // Light orange
  "beauty_and_spa": "#db2777",         // Pink
  caterer: "#f97316",                  // Orange
  bakery: "#ea580c",                   // Dark orange
  "advertising_agency": "#f59e0b",     // Amber
  brewery: "#ca8a04",                  // Amber
  "bicycle_shop": "#9333ea",           // Violet
  "carpet_store": "#7c3aed",           // Purple
  chiropractor: "#4338ca",             // Indigo
  massage: "#15803d",                  // Green
  plumbing: "#365314",                 // Olive
  "printing_services": "#6366f1",      // Indigo
  "real_estate_agent": "#422006",      // Dark brown
  "thai_restaurant": "#7c2d12",        // Rust
  "asian_restaurant": "#db2777",       // Pink
  "bank_credit_union": "#c026d3",      // Fuchsia
  distillery: "#1e40af",               // Blue
  "engineering_services": "#1e3a8a",   // Navy
  "fashion_accessories_store": "#0c4a6e", // Dark blue
  "flowers_and_gifts_shop": "#075985", // Sky blue
  "furniture_store": "#0e7490",        // Dark cyan
  "grocery_store": "#0d9488",          // Teal
  
  // === Additional Common Categories ===
  bar: "#dc2626",                      // Red
  winery: "#7c2d12",                   // Brown
  contractor: "#0891b2",               // Dark cyan
  electrician: "#0e7490",              // Teal
  "appliance_repair_service": "#059669", // Emerald
  "auto_glass_service": "#10b981",     // Green
  "hardware_store": "#84cc16",         // Lime
  theatre: "#ec4899",                  // Pink
  "topic_concert_venue": "#f43f5e",    // Rose
  "naturopathic_holistic": "#14b8a6",  // Teal
  "event_photography": "#f87171",      // Light red
  acupuncture: "#c084fc",              // Light purple
  "arts_and_crafts": "#fbbf24",        // Yellow
  bartender: "#a78bfa",                // Light violet
  "building_supply_store": "#94a3b8",  // Slate
  "clothing_store": "#93c5fd",         // Light blue
  "construction_services": "#6ee7b7",  // Light green
  "fast_food_restaurant": "#fed7aa",   // Light orange
  
  // === More Common Business Types ===
  doctor: "#8b5cf6",                   // Violet
  spas: "#be123c",                     // Crimson
  "american_restaurant": "#ea580c",    // Dark orange
  "chinese_restaurant": "#dc2626",     // Red
  "sushi_restaurant": "#0891b2",       // Cyan
  "wig_store": "#a855f7",              // Purple
  "antique_store": "#92400e",          // Dark orange
  apartments: "#6b7280",               // Gray
  "property_management": "#374151",    // Dark gray
  "mattress_store": "#7c3aed",         // Purple
  hotel: "#ec4899",                    // Pink
  "funeral_services_and_cemeteries": "#4b5563", // Gray
  "cannabis_clinic": "#22c55e",        // Green
  "cannabis_dispensary": "#16a34a",    // Dark green
  "child_care_and_day_care": "#fbbf24", // Yellow
  "clothing_rental": "#d946ef",        // Magenta
  "community_services_non_profit": "#10b981", // Green (variation)
  arms: "#991b1b",                     // Dark red
  "boxing_class": "#dc2626",           // Red
  "buffet_restaurant": "#f97316",      // Orange
  cafe: "#78350f",                     // Dark brown
  
  // === Generic Fallbacks ===
  bank: "#1f2937",                     // Dark gray
  "credit_union": "#374151",           // Gray
  spa: "#be123c",                      // Crimson
  repair: "#0891b2",                   // Cyan
  shop: "#10b981",                     // Green
  store: "#84cc16",                    // Lime
  services: "#3b82f6",                 // Blue
};

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
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);

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
          paint: { "line-color": "#EE7B2C", "line-width": 1, "line-opacity": 0.5 },
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
            "circle-opacity": 0.8
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

  async function fetchPlaces() {
    if (!polygon) return;
    try {
      setLoading(true);
      setError(null);

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
            ...Object.fromEntries(categoryMap)
          },
          places: features, // Store individual places for detailed analysis
        };
        setReportData(metrics);
      }

      addPlacesLayer(fc);
      setPlaceCount(fc.features.length);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function addPlacesLayer(fc: FeatureCollection) {
    const map = mapRef.current!;
    // build categorical match expression
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
            2,
            10,
            4,
            14,
            6,
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

  function clearAll() {
    const map = mapRef.current!;

    // Clear places results
    if (map.getSource("places")) {
      map.removeLayer("places-circles");
      map.removeSource("places");
    }

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
    
    if (placeTypes.includes('address')) {
      zoom = 16; // High zoom for addresses
    } else if (placeTypes.includes('neighborhood') || placeTypes.includes('locality')) {
      zoom = 14; // Medium-high zoom for neighborhoods/towns
    } else if (placeTypes.includes('place')) {
      zoom = 12; // Medium zoom for cities
    } else if (placeTypes.includes('region')) {
      zoom = 8; // Lower zoom for states/regions
    } else if (placeTypes.includes('country')) {
      zoom = 6; // Lowest zoom for countries
    }

    // Fly to the selected location
    map.flyTo({
      center: location.center,
      zoom: zoom,
      duration: 2000,
      essential: true
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
    let minLng = coords[0][0], maxLng = coords[0][0];
    let minLat = coords[0][1], maxLat = coords[0][1];
    
    coords.forEach(([lng, lat]: number[]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    // Fit bounds with padding
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: 50,
        duration: 1000
      }
    );
  };


  return (
    <div className="app" style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div 
        id="map" 
        style={{ 
          height: "100%", 
          width: showReport ? (showFullReport ? "0%" : "50%") : "100%",
          transition: "width 0.3s ease",
          overflow: 'hidden'
        }} 
      />
      
      {/* Left-Edge Sidebar Toggle Tab */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        style={{
          position: 'absolute',
          top: '50%',
          left: '0px',
          transform: 'translateY(-50%)',
          zIndex: 2000,
          padding: '16px 8px',
          backgroundColor: ginkgoTheme.colors.primary.orange,
          color: 'white',
          border: 'none',
          borderRadius: '0 12px 12px 0',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 600,
          fontFamily: ginkgoTheme.typography.fontFamily.body,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          transition: 'all 0.3s ease',
          width: '16px',
          height: '60px',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#0feaa6'; // Green hover
          e.currentTarget.style.width = '48px';
          e.currentTarget.style.padding = '16px 12px';
          e.currentTarget.style.boxShadow = '4px 0 12px rgba(15, 234, 166, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.orange;
          e.currentTarget.style.width = '16px';
          e.currentTarget.style.padding = '16px 8px';
          e.currentTarget.style.boxShadow = '2px 0 8px rgba(0,0,0,0.15)';
        }}
        title={showSidebar ? "Hide Panel" : "Show Panel"}
      >
        {showSidebar ? '‹' : '›'}
      </button>
      
      {/* Sidebar Panel - Conditionally Rendered */}
      {showSidebar && (
        <GinkgoPanel>
        {/* Ginkgo Logo Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${ginkgoTheme.colors.primary.orange}`
        }}>
          <img 
            src="/assets/GinkgoWordmark_Orange.svg" 
            alt="Ginkgo"
            style={{ 
              height: '32px',
              width: 'auto'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <GinkgoTitle level={2}>BID Budget Estimator</GinkgoTitle>
            {currentLocation && (
              <GinkgoText style={{ 
                fontSize: '12px', 
                color: ginkgoTheme.colors.primary.navy, 
                fontWeight: 500,
                marginTop: '4px'
              }}>
                {currentLocation}
              </GinkgoText>
            )}
          </div>
          <GinkgoButton 
            onClick={handleOpenLocationSearch}
            variant="secondary"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            Search Location
          </GinkgoButton>
        </div>
        <GinkgoText muted>
          Draw a polygon to analyze your district. Click to add points, click the first point to close.
        </GinkgoText>

        {polygon ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <GinkgoButton 
              disabled={loading} 
              onClick={fetchPlaces}
              variant="primary"
            >
              Analyze District
            </GinkgoButton>
            <GinkgoButton 
              onClick={clearAll}
              variant="secondary"
            >
              Clear
            </GinkgoButton>
          </div>
        ) : (
          <GinkgoBadge variant="default">
            Draw a polygon to begin
          </GinkgoBadge>
        )}

        {loading && (
          <div style={{ marginTop: '12px' }}>
            <GinkgoBadge variant="warning">Analyzing...</GinkgoBadge>
          </div>
        )}
        
        {error && (
          <div style={{ marginTop: '12px' }}>
            <GinkgoBadge variant="error">Error: {error}</GinkgoBadge>
          </div>
        )}
        
        {placeCount !== null && (
          <div style={{ marginTop: '16px' }}>
            <GinkgoText>
              <strong style={{ color: ginkgoTheme.colors.primary.navy }}>
                {placeCount.toLocaleString()}
              </strong> businesses found
            </GinkgoText>
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
            style={{ marginTop: '12px', width: '100%' }}
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

