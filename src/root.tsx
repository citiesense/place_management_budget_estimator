import React, { useMemo, useState, useEffect, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { EditableGeoJsonLayer } from '@nebula.gl/layers'
import { DrawPolygonMode, ModifyMode } from '@nebula.gl/edit-modes'
import Map from 'react-map-gl'

// View & env
const INITIAL_VIEW_STATE = { longitude: -73.9855, latitude: 40.7484, zoom: 12, pitch: 0, bearing: 0 }

const SQL_PROXY = '/api/sql' // always use the Netlify function in prod
const PLACES = import.meta.env.VITE_PLACES_TABLE
const SEGS = import.meta.env.VITE_SEGMENTS_TABLE
const BLDGS = import.meta.env.VITE_BUILDINGS_TABLE

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12'

type Coeffs = { alpha: number; beta: number; gamma: number; delta: number; base: number }

async function cartoQuery(sql: string) {
  const r = await fetch(SQL_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: sql }) })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`SQL ${r.status}: ${t}`)
  }
  return r.json()
}

export default function Root() {
  const [drawMode, setDrawMode] = useState<'draw'|'modify'>('draw')
  const [workingFc, setWorkingFc] = useState<any>({ type: 'FeatureCollection', features: [] })
  const [confirmedPoly, setConfirmedPoly] = useState<any>(null)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<any>(null)
  const [coeffs, setCoeffs] = useState<Coeffs>({ alpha: 700, beta: 1500, gamma: 60000, delta: 8000, base: 80000 })
  const [budget, setBudget] = useState<any>(null)

  const [contact, setContact] = useState({ name:'', email:'', crm:'' })

  // Build draw layer
  const layers = useMemo(() => {
    return [
      new EditableGeoJsonLayer({
        id: 'draw-layer',
        data: workingFc,
        mode: drawMode === 'draw' ? DrawPolygonMode : ModifyMode,
        selectedFeatureIndexes: [0],
        onEdit: ({ updatedData }: any) => {
          setErrorMsg(null)
          setBudget(null)
          setMetrics(null)
          setConfirmedPoly(null) // any edit invalidates confirmation
          setWorkingFc(updatedData)
        },
        getLineColor: [243, 113, 41],
        getFillColor: [243, 113, 41, 40],
        getPointRadius: 8
      })
    ]
  }, [workingFc, drawMode])

  // Confirm polygon: ensure we have exactly 1 polygon with >= 3 vertices
  const confirmPolygon = useCallback(() => {
    const f = workingFc?.features?.[0]
    const geom = f?.geometry
    if (!geom || geom.type !== 'Polygon') {
      setErrorMsg('Please draw a closed polygon before confirming.')
      return
    }
    const ring = geom.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length < 4) {
      setErrorMsg('Polygon needs at least 3 vertices.')
      return
    }
    setErrorMsg(null)
    setConfirmedPoly(geom)
    setDrawMode('modify') // allow refine post-confirm
  }, [workingFc])

  // Fetch estimate only when user clicks
  const fetchEstimate = useCallback(async () => {
    if (!PLACES || !SEGS || !BLDGS) {
      setErrorMsg('Missing table configuration. Check env vars for VITE_PLACES_TABLE, VITE_SEGMENTS_TABLE, VITE_BUILDINGS_TABLE.')
      return
    }
    if (!confirmedPoly) {
      setErrorMsg('Confirm your polygon first.')
      return
    }

    const gj = JSON.stringify({ type: 'Feature', geometry: confirmedPoly })
    const sql = `
DECLARE p GEOGRAPHY DEFAULT ST_GEOGFROMGEOJSON('${gj}');
WITH metrics AS (
  SELECT
    (SELECT COUNT(*) FROM \`${PLACES}\`
      WHERE ST_INTERSECTS(geometry, p)
      AND (categories.primary IN ("restaurant","retail","cafe","shop","services"))) AS businesses,
    (SELECT COUNT(*) FROM (
      WITH segs AS (
        SELECT geometry FROM \`${SEGS}\`
        WHERE subtype='road' AND ST_INTERSECTS(geometry, p)
      ),
      endpoints AS (
        SELECT ST_STARTPOINT(geometry) AS node FROM segs
        UNION ALL SELECT ST_ENDPOINT(geometry) AS node FROM segs
      ),
      nodes AS (SELECT ST_SNAPTOGRID(node, 1e-6) AS node FROM endpoints),
      counts AS (SELECT node, COUNT(*) AS deg FROM nodes GROUP BY node)
      SELECT * FROM counts WHERE deg >= 3
    )) AS intersections,
    ST_AREA(p)/1e6 AS area_km2,
    (SELECT COALESCE(SUM(ST_AREA(geometry))/10000.0, 0) FROM \`${BLDGS}\`
      WHERE ST_INTERSECTS(geometry, p)) AS gfa_10k_m2
)
SELECT * FROM metrics;`

    try {
      setLoading(true)
      setErrorMsg(null)
      const res = await cartoQuery(sql)
      const row = res?.rows?.[0] || {}
      setMetrics(row)
      const likely = Math.round(
        coeffs.base +
        coeffs.alpha * (row.businesses || 0) +
        coeffs.beta * (row.intersections || 0) +
        coeffs.gamma * (row.area_km2 || 0) +
        coeffs.delta * (row.gfa_10k_m2 || 0)
      )
      setBudget({ likely, low: Math.round(likely * 0.8), high: Math.round(likely * 1.2) })
    } catch (e: any) {
      setErrorMsg(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [confirmedPoly, coeffs, PLACES, SEGS, BLDGS])

  const clearAll = () => {
    setWorkingFc({ type: 'FeatureCollection', features: [] })
    setConfirmedPoly(null)
    setMetrics(null)
    setBudget(null)
    setErrorMsg(null)
    setDrawMode('draw')
  }

  return (
    <div style={{ height: '100%' }}>
      <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={true} layers={layers}>
        <Map reuseMaps mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAPBOX_STYLE} />
      </DeckGL>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Place Management Budget Estimator</strong>
          <div>
            <button onClick={() => setDrawMode('draw')} disabled={drawMode==='draw'}>Draw</button>
            <button onClick={() => setDrawMode('modify')} disabled={drawMode==='modify'} style={{marginLeft:6}}>Refine</button>
            <button onClick={clearAll} style={{marginLeft:6}}>Clear</button>
          </div>
        </div>

        {!confirmedPoly ? (
          <>
            <div style={{ marginTop: 8 }}>
              Draw your area. When you’re happy, click <b>Confirm polygon</b>. You can still refine after confirming.
            </div>
            <button style={{ marginTop: 8 }} onClick={confirmPolygon} disabled={workingFc?.features?.length === 0}>
              Confirm polygon
            </button>
          </>
        ) : (
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <span>Polygon confirmed.</span>
            <button onClick={fetchEstimate} disabled={loading}>{loading ? 'Fetching…' : 'Fetch estimate'}</button>
          </div>
        )}

        {errorMsg && <div style={{ color: '#b00', whiteSpace: 'pre-wrap', marginTop: 8 }}>Error: {errorMsg}</div>}

        {metrics && budget && (
          <>
            <div className="kpis" style={{ marginTop: 10 }}>
              <div className="kpi"><div>Businesses</div><strong>{metrics.businesses}</strong></div>
              <div className="kpi"><div>Intersections</div><strong>{metrics.intersections}</strong></div>
              <div className="kpi"><div>Area (km²)</div><strong>{Number(metrics.area_km2).toFixed(3)}</strong></div>
              <div className="kpi"><div>GFA (×10k m²)</div><strong>{Number(metrics.gfa_10k_m2).toFixed(1)}</strong></div>
            </div>
            <div className="kpis" style={{ marginTop: 8 }}>
              <div className="kpi"><div>Likely</div><strong>${budget.likely?.toLocaleString?.() ?? '—'}</strong></div>
              <div className="kpi"><div>Range</div><strong>{`$${budget.low.toLocaleString()}–$${budget.high.toLocaleString()}`}</strong></div>
            </div>
          </>
        )}

        <details style={{ marginTop: 10 }}>
          <summary>Advanced (coefficients)</summary>
          <div className="kpis" style={{ marginTop: 8 }}>
            <label className="kpi">α per business<br />
              <input type="number" value={coeffs.alpha} onChange={e => setCoeffs({ ...coeffs, alpha: Number(e.target.value) })} />
            </label>
            <label className="kpi">β per intersection<br />
              <input type="number" value={coeffs.beta} onChange={e => setCoeffs({ ...coeffs, beta: Number(e.target.value) })} />
            </label>
            <label className="kpi">γ per km²<br />
              <input type="number" value={coeffs.gamma} onChange={e => setCoeffs({ ...coeffs, gamma: Number(e.target.value) })} />
            </label>
            <label className="kpi">δ per 10k m²<br />
              <input type="number" value={coeffs.delta} onChange={e => setCoeffs({ ...coeffs, delta: Number(e.target.value) })} />
            </label>
            <label className="kpi">Base<br />
              <input type="number" value={coeffs.base} onChange={e => setCoeffs({ ...coeffs, base: Number(e.target.value) })} />
            </label>
          </div>
        </details>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>© Map data © Mapbox & OpenStreetMap contributors</div>
      </div>
    </div>
  )
}
