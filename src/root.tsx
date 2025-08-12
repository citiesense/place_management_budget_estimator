import React, { useMemo, useState, useEffect } from 'react'
import DeckGL from '@deck.gl/react'
import { EditableGeoJsonLayer } from '@nebula.gl/layers'
import { DrawPolygonMode, ModifyMode } from '@nebula.gl/edit-modes'
import Map from 'react-map-gl'

const INITIAL_VIEW_STATE = { longitude: -73.9855, latitude: 40.7484, zoom: 12, pitch: 0, bearing: 0 }

// Env
const SQL_PROXY = import.meta.env.VITE_SQL_PROXY
const SQL_BASE = import.meta.env.VITE_CARTO_SQL_BASE
const CONN = import.meta.env.VITE_CARTO_CONN
const API_KEY = import.meta.env.VITE_CARTO_API_KEY
const PLACES = import.meta.env.VITE_PLACES_TABLE
const SEGS = import.meta.env.VITE_SEGMENTS_TABLE
const BLDGS = import.meta.env.VITE_BUILDINGS_TABLE


const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12'

async function cartoQuery(sql: string) {
  if (SQL_PROXY) {
    const r = await fetch(SQL_PROXY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: sql })
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  }
  const url = `${SQL_BASE}/${CONN}/query`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    },
    body: JSON.stringify({ q: sql })
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export default function Root() {
  const [mode, setMode] = useState<'draw'|'modify'>('draw')
  const [poly, setPoly] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [coeffs, setCoeffs] = useState({ alpha: 700, beta: 1500, gamma: 60000, delta: 8000, base: 80000 })
  const [budget, setBudget] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [contact, setContact] = useState({ name:'', email:'', crm:'' })
  const canSubmit = !!(contact.email && budget && poly)

  useEffect(() => {
    if (!poly || !PLACES || !SEGS || !BLDGS) return
    const run = async () => {
      setLoading(true); setErrorMsg(null)
      const gj = JSON.stringify({ type: 'Feature', geometry: poly })
      const sql = `
DECLARE p GEOGRAPHY DEFAULT ST_GEOGFROMGEOJSON('${gj}');
WITH metrics AS (
  SELECT
    (SELECT COUNT(*) FROM \`${PLACES}\` WHERE ST_INTERSECTS(geometry, p)
      AND (categories.primary IN ("restaurant","retail","cafe","shop","services"))) AS businesses,
    (SELECT COUNT(*) FROM (
      WITH segs AS (
        SELECT geometry FROM \`${SEGS}\` WHERE subtype='road' AND ST_INTERSECTS(geometry, p)
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
    (SELECT COALESCE(SUM(ST_AREA(geometry))/10000.0, 0) FROM \`${BLDGS}\` WHERE ST_INTERSECTS(geometry, p)) AS gfa_10k_m2
)
SELECT * FROM metrics;`
      try {
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
        console.error(e); setErrorMsg(String(e))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [poly, coeffs, PLACES, SEGS, BLDGS])

  const layers = useMemo(() => {
    const fc = poly
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: poly, properties: {} }] }
      : { type: 'FeatureCollection', features: [] }

    return [
      new EditableGeoJsonLayer({
        id: 'draw',
        data: fc,
        mode: mode === 'draw' ? DrawPolygonMode : ModifyMode,
        onEdit: ({ updatedData }: any) => {
          const f = updatedData?.features?.[0]
          setPoly(f?.geometry || null)
        },
        selectedFeatureIndexes: [0],
        getLineColor: [243, 113, 41],
        getFillColor: [243, 113, 41, 40],
        getPointRadius: 8
      })
    ]
  }, [poly, mode])

  async function submitReport() {
    try {
      const payload = {
        contact,
        polygon: { type: 'Feature', geometry: poly, properties: {} },
        metrics, budget, coeffs,
        context: { placesTable: PLACES, segmentsTable: SEGS, buildingsTable: BLDGS }
      }
      const r = await fetch('/api/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!r.ok) throw new Error(await r.text())
      alert('Thanks! Your report will be emailed shortly.')
    } catch (e: any) {
      alert(`Report error: ${String(e)}`)
    }
  }

  return (
    <div style={{ height: '100%' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        onError={e => { console.error('DeckGL error:', e); setErrorMsg(String(e)) }}
      >
        <Map reuseMaps mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAPBOX_STYLE} />
      </DeckGL>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Place Management Budget Estimator</strong>
          <div>
            <button onClick={() => setMode('draw')} disabled={mode==='draw'}>Draw</button>
            <button onClick={() => setMode('modify')} disabled={mode==='modify'} style={{marginLeft:6}}>Refine</button>
            <button onClick={() => { setPoly(null); setMetrics(null); setBudget(null); setMode('draw') }} style={{marginLeft:6}}>Clear</button>
          </div>
        </div>

        {errorMsg && <div style={{ color: '#b00', whiteSpace: 'pre-wrap', marginTop: 8 }}>Error: {errorMsg}</div>}
        {!poly && <div style={{ marginTop: 8 }}>Use <b>Draw</b> to outline your proposed district. Switch to <b>Refine</b> to drag vertices.</div>}

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

        <div style={{ borderTop: '1px solid #eee', marginTop: 12, paddingTop: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Email me the report</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Full name" value={contact.name} onChange={e=>setContact({...contact, name:e.target.value})} />
            <input placeholder="Email" value={contact.email} onChange={e=>setContact({...contact, email:e.target.value})} />
            <input placeholder="Current CRM (optional)" value={contact.crm} onChange={e=>setContact({...contact, crm:e.target.value})} />
            <button disabled={!canSubmit || loading} onClick={submitReport}>Generate & email</button>
          </div>
          {!budget && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Draw a polygon to unlock the report.</div>}
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>© Map data © Mapbox & OpenStreetMap contributors</div>
      </div>
    </div>
  )
}
