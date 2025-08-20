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

    // lightweight polygon draw (no external lib): click to add vertices, dblclick to close
    let pts: mapboxgl.LngLat[] = [];
    let isDrawing = false;

    function redraw() {
      if (!map.getSource("poly")) {
        map.addSource("poly", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "poly-line",
          type: "line",
          source: "poly",
          paint: { "line-color": "#0ea5e9", "line-width": 3 },
        });
        map.addLayer({
          id: "poly-fill",
          type: "fill",
          source: "poly",
          paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.1 },
        });
      }
      const data = pts.length >= 3 ? polygonFC(pts) : emptyFC();
      (map.getSource("poly") as mapboxgl.GeoJSONSource).setData(data);
    }

    function onClick(e: mapboxgl.MapMouseEvent & mapboxgl.EventData) {
      if (!isDrawing) {
        isDrawing = true;
        pts = [];
      }
      pts.push(e.lngLat);
      redraw();
    }

    function onDblClick() {
      if (pts.length >= 3) {
        const fc = polygonFC(pts);
        setPolygon(fc);
      }
      isDrawing = false;
    }

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    map.on("load", redraw);

    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
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
    if (map.getSource("places")) {
      map.removeLayer("places-circles");
      map.removeSource("places");
    }
    if (map.getSource("poly")) {
      (map.getSource("poly") as mapboxgl.GeoJSONSource).setData(emptyFC());
    }
    setPolygon(null);
    setPlaceCount(null);
    setError(null);
  }

  return (
    <div className="app" style={{ height: "100vh", width: "100vw" }}>
      <div id="map" style={{ height: "100%", width: "100%" }} />
      <div style={panelStyle}>
        <h2>Place Management Budget Estimator</h2>
        <p>Click to add polygon vertices, double‑click to close the polygon.</p>

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
