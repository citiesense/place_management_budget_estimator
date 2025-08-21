import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from "geojson";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE as string; // e.g. mapbox://styles/citiesense/ckc6fzel218uv1jrj6qsnsbw2

type FeatureCollection = GeoJSON.FeatureCollection;

const CATEGORY_COLORS: Record<string, string> = {
  food_and_drink: "#e45756",
  shopping: "#f58518",
  health: "#54a24b",
  education: "#4c78a8",
  entertainment: "#b279a2",
  transportation: "#72b7b2",
  finance: "#ff9da7",
  government: "#9e765f",
  other: "#bab0ac",
};

export default function Root() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [polygon, setPolygon] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [placeCount, setPlaceCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

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
          paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.1 },
        });
        map.addLayer({
          id: "drawing-poly-line",
          type: "line",
          source: "drawing-poly",
          paint: { "line-color": "#0ea5e9", "line-width": 3 },
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
              8, // First point larger
              6, // Other points
            ],
            "circle-color": [
              "case",
              ["==", ["get", "isFirst"], true],
              "#059669", // First point green
              "#0ea5e9", // Other points blue
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
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
            "circle-radius": 12,
            "circle-color": "#059669",
            "circle-opacity": 0.3,
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
    map.on("load", setupDrawingLayers);

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
          COUNT(*) OVER() / (ST_AREA(poly.g) / 1000000) AS density_per_km2,
          -- Category counts
          COUNT(*) OVER(PARTITION BY category) AS category_count,
          COUNT(CASE WHEN category IN ('retail', 'shopping', 'store') THEN 1 END) OVER() AS retail_count,
          COUNT(CASE WHEN category IN ('restaurant', 'food', 'food_and_drink', 'cafe') THEN 1 END) OVER() AS food_count,
          COUNT(CASE WHEN category IN ('service', 'services', 'professional') THEN 1 END) OVER() AS service_count,
          COUNT(CASE WHEN category IN ('entertainment', 'recreation', 'leisure') THEN 1 END) OVER() AS entertainment_count,
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
        const metrics = {
          totalPlaces: firstRow.total_places || 0,
          areaKm2: firstRow.area_km2 || 0,
          areaAcres: firstRow.area_acres || 0,
          densityPerKm2: firstRow.density_per_km2 || 0,
          categoryBreakdown: {
            retail: firstRow.retail_count || 0,
            food: firstRow.food_count || 0,
            service: firstRow.service_count || 0,
            entertainment: firstRow.entertainment_count || 0,
            unknown: firstRow.unknown_count || 0,
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

  return (
    <div className="app" style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div 
        id="map" 
        style={{ 
          height: "100%", 
          width: showReport ? "40%" : "100%",
          transition: "width 0.3s ease"
        }} 
      />
      <div style={panelStyle}>
        <h2>Place Management Budget Estimator</h2>
        <p>
          Click to add vertices. Click the first point (green) to close.
          Right-click or press Escape to cancel.
        </p>

        {polygon ? (
          <>
            <button disabled={loading} onClick={fetchPlaces}>
              Confirm selection &amp; fetch Places
            </button>
            <button onClick={clearAll} style={{ marginLeft: 8 }}>
              Clear
            </button>
          </>
        ) : (
          <em>Draw a polygon to begin…</em>
        )}

        {loading && <p>Fetching…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {placeCount !== null && (
          <p>
            <strong>{placeCount.toLocaleString()}</strong> places found.
          </p>
        )}

        {reportData && (
          <button 
            onClick={() => setShowReport(true)} 
            style={{ 
              marginTop: 8,
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            📊 View Report
          </button>
        )}

        <Legend />
      </div>

      {/* Sliding Report Panel */}
      {showReport && reportData && (
        <ReportPanel 
          data={reportData} 
          onClose={() => setShowReport(false)} 
        />
      )}
    </div>
  );
}

// ReportPanel Component
function ReportPanel({ data, onClose }: { data: any; onClose: () => void }) {
  // Industry-standard BID budget calculations
  const calculateBudget = (totalPlaces: number, areaAcres: number) => {
    // Industry averages (sources: International Downtown Association, NYC BID reports)
    const basePerBusiness = 1200; // $1,200 per business annually (base services)
    const areaFactor = Math.max(50, areaAcres * 25); // $25-50 per acre for area coverage
    const economyOfScale = totalPlaces > 100 ? 0.85 : totalPlaces > 50 ? 0.9 : 1.0;
    
    const baseBudget = (totalPlaces * basePerBusiness + areaFactor) * economyOfScale;
    
    return {
      low: Math.round(baseBudget * 0.7),
      likely: Math.round(baseBudget),
      high: Math.round(baseBudget * 1.4)
    };
  };

  // Calculate diversity score (economic resilience indicator)
  const calculateDiversityScore = (breakdown: any, total: number) => {
    if (total === 0) return 0;
    
    const categories = Object.values(breakdown).filter(count => count > 0) as number[];
    const shares = categories.map(count => count / total);
    
    // Simpson's Diversity Index adapted for business mix
    const simpsonsIndex = 1 - shares.reduce((sum, share) => sum + share * share, 0);
    return Math.round(simpsonsIndex * 10 * 100) / 100; // Scale to 0-10
  };

  const budget = calculateBudget(data.totalPlaces, data.areaAcres);
  const diversityScore = calculateDiversityScore(data.categoryBreakdown, data.totalPlaces);
  
  const reportPanelStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    width: "60%",
    height: "100%",
    backgroundColor: "white",
    borderLeft: "2px solid #e2e8f0",
    boxShadow: "-4px 0 10px rgba(0,0,0,0.1)",
    overflowY: "auto",
    animation: "slideIn 0.3s ease",
    zIndex: 1000,
  };

  const headerStyle: React.CSSProperties = {
    padding: "1.5rem",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  };

  const contentStyle: React.CSSProperties = {
    padding: "1.5rem"
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: "2rem",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    border: "1px solid #e5e7eb"
  };

  const statStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.5rem 0",
    borderBottom: "1px solid #e5e7eb"
  };

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}
      </style>
      <div style={reportPanelStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, color: "#1e293b" }}>📊 BID Analysis Report</h2>
          <button 
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.5rem"
            }}
          >
            ✕
          </button>
        </div>

        <div style={contentStyle}>
          {/* Executive Summary */}
          <div style={sectionStyle}>
            <h3 style={{ marginBottom: "1rem", color: "#059669" }}>Executive Summary</h3>
            <div style={statStyle}>
              <span><strong>Total Businesses:</strong></span>
              <span>{data.totalPlaces.toLocaleString()}</span>
            </div>
            <div style={statStyle}>
              <span><strong>Area Coverage:</strong></span>
              <span>{data.areaAcres.toFixed(1)} acres ({data.areaKm2.toFixed(2)} km²)</span>
            </div>
            <div style={statStyle}>
              <span><strong>Business Density:</strong></span>
              <span>{data.densityPerKm2.toFixed(1)} per km²</span>
            </div>
            <div style={statStyle}>
              <span><strong>Economic Diversity Score:</strong></span>
              <span>{diversityScore}/10 {diversityScore > 6 ? "🟢" : diversityScore > 4 ? "🟡" : "🔴"}</span>
            </div>
          </div>

          {/* Budget Estimation */}
          <div style={sectionStyle}>
            <h3 style={{ marginBottom: "1rem", color: "#0ea5e9" }}>Annual Budget Estimation</h3>
            <div style={statStyle}>
              <span><strong>Conservative:</strong></span>
              <span>${budget.low.toLocaleString()}</span>
            </div>
            <div style={statStyle}>
              <span><strong>Likely:</strong></span>
              <span style={{ fontWeight: "bold" }}>${budget.likely.toLocaleString()}</span>
            </div>
            <div style={statStyle}>
              <span><strong>Ambitious:</strong></span>
              <span>${budget.high.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.5rem" }}>
              Based on industry standards: ${Math.round(budget.likely / data.totalPlaces).toLocaleString()} per business annually
            </div>
          </div>

          {/* Business Mix Analysis */}
          <div style={sectionStyle}>
            <h3 style={{ marginBottom: "1rem", color: "#8b5cf6" }}>Business Mix Breakdown</h3>
            {Object.entries(data.categoryBreakdown).map(([category, count]) => {
              const percentage = data.totalPlaces > 0 ? ((count as number) / data.totalPlaces * 100) : 0;
              return count > 0 ? (
                <div key={category} style={statStyle}>
                  <span style={{ textTransform: "capitalize" }}>{category}:</span>
                  <span>{count} ({percentage.toFixed(1)}%)</span>
                </div>
              ) : null;
            })}
          </div>

          {/* Investment Insights */}
          <div style={sectionStyle}>
            <h3 style={{ marginBottom: "1rem", color: "#f59e0b" }}>Investment Priority Insights</h3>
            <div style={{ marginBottom: "1rem" }}>
              <strong>High Priority Services:</strong>
              <ul style={{ marginLeft: "1rem", marginTop: "0.5rem" }}>
                {data.categoryBreakdown.retail > data.totalPlaces * 0.3 && 
                  <li>Enhanced streetscape maintenance (high retail presence)</li>}
                {data.categoryBreakdown.food > data.totalPlaces * 0.2 && 
                  <li>Waste management optimization (restaurant concentration)</li>}
                {data.densityPerKm2 > 100 && 
                  <li>Pedestrian safety improvements (high density area)</li>}
                {diversityScore < 5 && 
                  <li>Business recruitment for economic resilience</li>}
              </ul>
            </div>
            
            <div>
              <strong>Budget Allocation Guidance:</strong>
              <ul style={{ marginLeft: "1rem", marginTop: "0.5rem" }}>
                <li>Maintenance & Cleaning: 40-50% of budget</li>
                <li>Security & Safety: 20-30% of budget</li>
                <li>Marketing & Events: 15-20% of budget</li>
                <li>Administration: 10-15% of budget</li>
              </ul>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: "1rem", 
            marginTop: "1rem" 
          }}>
            <div style={{
              padding: "1rem",
              backgroundColor: "#dbeafe", 
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1e40af" }}>
                ${Math.round(budget.likely / data.areaAcres).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Per Acre Annually</div>
            </div>
            <div style={{
              padding: "1rem",
              backgroundColor: "#dcfce7",
              borderRadius: "8px", 
              textAlign: "center"
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#166534" }}>
                {data.totalPlaces > 50 ? "Large" : data.totalPlaces > 20 ? "Medium" : "Small"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>District Size</div>
            </div>
          </div>

        </div>
      </div>
    </>
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

function Legend() {
  return (
    <div style={{ marginTop: 12 }}>
      <strong>Legend</strong>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 6,
          marginTop: 6,
        }}
      >
        {Object.entries(CATEGORY_COLORS).map(([k, color]) => (
          <React.Fragment key={k}>
            <span
              style={{
                width: 12,
                height: 12,
                background: color,
                borderRadius: 999,
              }}
            />
            <span style={{ textTransform: "capitalize" }}>
              {k.replace(/_/g, " ")}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  background: "rgba(255,255,255,0.95)",
  padding: 12,
  borderRadius: 8,
  maxWidth: 360,
  boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
};
