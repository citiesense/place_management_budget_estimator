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
              ["==", ["get", "isFirst"], true], 8, // First point larger
              6, // Other points
            ],
            "circle-color": [
              "case",
              ["==", ["get", "isFirst"], true], "#059669", // First point green
              "#0ea5e9", // Other points blue
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      // Hover effect for first point when polygon can be closed
      if (!map.getSource("first-point-hover")) {
        map.addSource("first-point-hover", { type: "geojson", data: emptyFC() });
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
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(lineData);
      } else {
        // Clear polygon/line
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(emptyFC());
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
        (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(emptyFC());
      }
      if (map.getSource("drawing-points")) {
        (map.getSource("drawing-points") as mapboxgl.GeoJSONSource).setData(emptyFC());
      }
      if (map.getSource("first-point-hover")) {
        (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData(emptyFC());
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
          (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData(
            emptyFC()
          );
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
      if (e.key === 'Escape' && isDrawing) {
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
        import.meta.env.VITE_PLACES_TABLE || "overture_na.place";
      const sql = `
        WITH poly AS (
          SELECT ST_GEOGFROMGEOJSON(@polygon_geojson) AS g
        )
        SELECT
          id,
          categories[SAFE_OFFSET(0)] AS category,
          names.primary AS name,
          ST_X(geometry) AS lng,
          ST_Y(geometry) AS lat
        FROM \`${placesTable}\`, poly
        WHERE ST_INTERSECTS(geometry, poly.g)
        LIMIT 10000
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

      // Convert rows to GeoJSON FeatureCollection
      const features = (data.rows || []).map((row: any) => ({
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
      (map.getSource("drawing-poly") as mapboxgl.GeoJSONSource).setData(emptyFC());
    }
    if (map.getSource("drawing-points")) {
      (map.getSource("drawing-points") as mapboxgl.GeoJSONSource).setData(emptyFC());
    }
    if (map.getSource("first-point-hover")) {
      (map.getSource("first-point-hover") as mapboxgl.GeoJSONSource).setData(emptyFC());
    }
    
    // Reset cursor
    map.getCanvas().style.cursor = "";
    
    setPolygon(null);
    setPlaceCount(null);
    setError(null);
  }

  return (
    <div className="app" style={{ height: "100vh", width: "100vw" }}>
      <div id="map" style={{ height: "100%", width: "100%" }} />
      <div style={panelStyle}>
        <h2>Place Management Budget Estimator</h2>
        <p>Click to add vertices. Click the first point (green) to close. Right-click or press Escape to cancel.</p>

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

        <Legend />
      </div>
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
