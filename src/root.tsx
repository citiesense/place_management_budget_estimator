import React, { useMemo, useState, useEffect } from 'react'
import DeckGL from '@deck.gl/react'
import { CartoLayer } from '@deck.gl/carto'
import { EditableGeoJsonLayer } from '@nebula.gl/layers'
import { DrawPolygonMode } from '@nebula.gl/edit-modes'

const INITIAL_VIEW_STATE = { longitude: -73.9855, latitude: 40.7484, zoom: 12, pitch: 0, bearing: 0 }

const SQL_PROXY = import.meta.env.VITE_SQL_PROXY
const SQL_BASE = import.meta.env.VITE_CARTO_SQL_BASE
const CONN = import.meta.env.VITE_CARTO_CONN
const API_KEY = import.meta.env.VITE_CARTO_API_KEY
const PLACES = import.meta.env.VITE_PLACES_TABLE
const SEGS = import.meta.env.VITE_SEGMENTS_TABLE
const BLDGS = import.meta.env.VITE_BUILDINGS_TABLE

async function cartoQuery(sql: string){
  if (SQL_PROXY) {
    const r = await fetch(SQL_PROXY, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ q: sql }) })
    if(!r.ok) throw new Error(await r.text())
    return r.json()
  }
  const url = `${SQL_BASE}/${CONN}/query`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ q: sql })
  })
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}

export default function Root(){
  const [poly, setPoly] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [coeffs, setCoeffs] = useState({ alpha:700, beta:1500, gamma:60000, delta:8000, base:80000 })
  const [budget, setBudget] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if(!poly || !PLACES || !SEGS || !BLDGS) return
    const run = async () => {
      setLoading(true)
      setErrorMsg(null)
      const gj = JSON.stringify({ type:'Feature', geometry: poly })
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
        UNION ALL
        SELECT ST_ENDPOINT(geometry)   AS node FROM segs
      ),
      nodes AS (SELECT ST_SNAPTOGRID(node, 1e-6) AS node FROM endpoints),
      counts AS (SELECT node, COUNT(*) AS deg FROM nodes GROUP BY node)
      SELECT * FROM counts WHERE deg >= 3
    )) AS intersections,
    ST_AREA(p)/1e6 AS area_km2,
    (SELECT COALESCE(SUM(ST_AREA(geometry))/10000.0, 0) FROM \`${BLDGS}\` WHERE ST_INTERSECTS(geometry, p)) AS gfa_10k_m2
)
SELECT * FROM metrics;
`
      const res = await cartoQuery(sql)
      const row = res?.rows?.[0] || {}
      setMetrics(row)
      const likely = Math.round(coeffs.base + coeffs.alpha*row.businesses + coeffs.beta*row.intersections + coeffs.gamma*row.area_km2 + coeffs.delta*row.gfa_10k_m2)
      setBudget({ likely, low: Math.round(likely*0.8), high: Math.round(likely*1.2) })
      setLoading(false)
    }
    run().catch(e => { console.error(e); setErrorMsg(String(e)); setLoading(false) })
  }, [poly, coeffs, PLACES, SEGS, BLDGS])

  const layers = useMemo(() => {
    const draw = new EditableGeoJsonLayer({
      id: 'draw',
      data: poly
        ? { type: 'FeatureCollection', features: [{ type:'Feature', geometry: poly, properties:{} }] }
        : { type: 'FeatureCollection', features: [] },
      mode: DrawPolygonMode,               // ← pass the mode class
      onEdit: ({ updatedData }: any) => {
        const f = updatedData?.features?.[0]
        setPoly(f?.geometry || null)
      },
      getLineColor: [243, 113, 41],
      getFillColor: [243, 113, 41, 40]
    })

    const places = new CartoLayer({
      id: 'places',
      connection: CONN || 'bigquery',
      type: 'query',
      sql: poly ? `DECLARE p GEOGRAPHY DEFAULT ST_GEOGFROMGEOJSON('${JSON.stringify({type:'Feature', geometry: poly})}');
                   SELECT geometry FROM \`${PLACES}\` WHERE ST_INTERSECTS(geometry, p) LIMIT 5000` : `SELECT geometry FROM \`${PLACES}\` LIMIT 0`,
      getFillColor: [0, 0, 0, 0],
      getLineColor: [0, 0, 0, 0]
    })

    return [places, draw]
  }, [poly, PLACES, CONN])

  return (
    <div style={{height:'100%'}}>
      <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={true} layers={layers} />
      <div className="panel">
        <div className="row" style={{justifyContent:'space-between'}}>
          <strong>Place Management Budget Estimator (proxy)</strong>
          <button onClick={() => setPoly(null)}>Clear</button>
        </div>
        <div style={{marginTop:8}}>
          {loading && <div>Computing…</div>}
          {errorMsg && <div style={{color:'#b00'}}>Error: {errorMsg}</div>}
          {metrics && budget && (
            <>
              <div className="kpis">
                <div className="kpi"><div>Businesses</div><strong>{metrics.businesses}</strong></div>
                <div className="kpi"><div>Intersections</div><strong>{metrics.intersections}</strong></div>
                <div className="kpi"><div>Area (km²)</div><strong>{metrics.area_km2?.toFixed(3)}</strong></div>
                <div className="kpi"><div>GFA (×10k m²)</div><strong>{metrics.gfa_10k_m2?.toFixed(1)}</strong></div>
              </div>
              <div className="kpis" style={{marginTop:8}}>
                <div className="kpi"><div>Likely</div><strong>${budget.likely.toLocaleString()}</strong></div>
                <div className="kpi"><div>Range</div><strong>${budget.low.toLocaleString()}–${budget.high.toLocaleString()}</strong></div>
              </div>
            </>
          )}
          {!poly && <div style={{marginTop:8}}>Use the polygon tool to draw your proposed district.</div>}
        </div>
        <details>
          <summary>Advanced (coefficients)</summary>
          <div className="kpis" style={{marginTop:8}}>
            <label className="kpi">α per business<br/>
              <input type="number" value={coeffs.alpha} onChange={e=>setCoeffs({...coeffs, alpha: Number(e.target.value)})} />
            </label>
            <label className="kpi">β per intersection<br/>
              <input type="number" value={coeffs.beta} onChange={e=>setCoeffs({...coeffs, beta: Number(e.target.value)})} />
            </label>
            <label className="kpi">γ per km²<br/>
              <input type="number" value={coeffs.gamma} onChange={e=>setCoeffs({...coeffs, gamma: Number(e.target.value)})} />
            </label>
            <label className="kpi">δ per 10k m²<br/>
              <input type="number" value={coeffs.delta} onChange={e=>setCoeffs({...coeffs, delta: Number(e.target.value)})} />
            </label>
            <label className="kpi">Base<br/>
              <input type="number" value={coeffs.base} onChange={e=>setCoeffs({...coeffs, base: Number(e.target.value)})} />
            </label>
          </div>
        </details>
      </div>
    </div>
  )
}
