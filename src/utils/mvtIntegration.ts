/**
 * Phase 4: MVT Integration Utilities
 * Adds vector tile support to the existing GeoJSON-based segments rendering
 */

import mapboxgl from 'mapbox-gl';

// MVT tile server configuration  
const MVT_TILE_ENDPOINT = '/.netlify/functions/mvt-tiles';
const PERFORMANCE_THRESHOLD_FEATURES = 2000; // Switch to MVT when more than 2k segments

// Road class colors (consistent with existing implementation)
export const SEGMENT_COLORS = {
  motorway: '#E63946',
  trunk: '#F77F00', 
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  tertiary: '#06FFA5',
  residential: '#95E77E',
  service: '#A8E6CF',
  unclassified: '#B4B4B4',
  motorway_link: '#E63946',
  trunk_link: '#F77F00',
  primary_link: '#FF6B6B',
  secondary_link: '#4ECDC4', 
  tertiary_link: '#06FFA5'
};

// Generate Mapbox color expression for segments
function generateSegmentColorExpression() {
  const colorExpression: any[] = ['match', ['get', 'class']];
  
  Object.entries(SEGMENT_COLORS).forEach(([roadClass, color]) => {
    colorExpression.push(roadClass, color);
  });
  
  colorExpression.push('#999999'); // Default color
  return colorExpression;
}

// Generate line width expression based on road class and zoom
function generateSegmentWidthExpression() {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8, [
      'match',
      ['get', 'class'],
      ['motorway', 'trunk'], 2,
      ['primary', 'secondary'], 1.5,
      ['tertiary', 'residential'], 1,
      ['service', 'unclassified'], 0.5,
      0.5
    ],
    12, [
      'match', 
      ['get', 'class'],
      ['motorway', 'trunk'], 4,
      ['primary', 'secondary'], 3,
      ['tertiary', 'residential'], 2,
      ['service', 'unclassified'], 1,
      1
    ],
    18, [
      'match',
      ['get', 'class'],
      ['motorway', 'trunk'], 8,
      ['primary', 'secondary'], 6,
      ['tertiary', 'residential'], 4,
      ['service', 'unclassified'], 2,
      2
    ]
  ];
}

/**
 * Add vector tile source and layers for road segments
 */
export function addMVTSegmentsLayers(
  map: mapboxgl.Map,
  roadClasses: string[] = []
): void {
  const sourceId = 'segments-mvt';
  const layerId = 'segments-mvt-layer';
  
  // Remove existing MVT layers if they exist
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
  
  // Build tile URL with query parameters
  const params = new URLSearchParams();
  if (roadClasses.length > 0) params.set('classes', roadClasses.join(','));
  
  const tileUrl = `${MVT_TILE_ENDPOINT}/{z}/{x}/{y}.mvt?${params.toString()}`;
  
  // Add vector tile source
  map.addSource(sourceId, {
    type: 'vector',
    tiles: [tileUrl],
    minzoom: 8,
    maxzoom: 18,
    attribution: 'Road data from Overture Maps'
  });
  
  // Add vector tile layer with styling
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    'source-layer': 'road_segments', // Layer name from MVT generation
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': generateSegmentColorExpression(),
      'line-width': generateSegmentWidthExpression(),
      'line-opacity': 0.8
    }
  });
  
  // Try to position layer before labels if they exist
  try {
    if (map.getLayer('settlement-subdivision-label')) {
      map.moveLayer(layerId, 'settlement-subdivision-label');
    }
  } catch (e) {
    // Layer ordering is not critical, continue without error
    // Layer positioning not critical
  }
}

/**
 * Add GeoJSON-based segments layers (existing implementation)
 */
export function addGeoJSONSegmentsLayers(
  map: mapboxgl.Map,
  segmentsData: GeoJSON.FeatureCollection,
  showSegments: boolean = true
): void {
  const sourceId = 'segments-geojson';
  const layerId = 'segments-geojson-layer';
  
  // Remove existing GeoJSON layers
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
  
  // Add GeoJSON source
  map.addSource(sourceId, {
    type: 'geojson',
    data: segmentsData
  });
  
  // Add GeoJSON layer
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
      'visibility': showSegments ? 'visible' : 'none'
    },
    paint: {
      'line-color': generateSegmentColorExpression(),
      'line-width': generateSegmentWidthExpression(), 
      'line-opacity': 0.8
    }
  });
  
  // Try to position layer before labels if they exist
  try {
    if (map.getLayer('settlement-subdivision-label')) {
      map.moveLayer(layerId, 'settlement-subdivision-label');
    }
  } catch (e) {
    // Layer ordering is not critical, continue without error
    // Layer positioning not critical
  }
}

/**
 * Smart layer selection: Use MVT for large datasets, GeoJSON for smaller ones
 */
export function addSmartSegmentsLayers(
  map: mapboxgl.Map,
  segmentsData: GeoJSON.FeatureCollection | null,
  featureCount: number,
  roadClasses: string[] = [],
  showSegments: boolean = true
): 'mvt' | 'geojson' | 'none' {
  
  // Check if map is properly initialized
  if (!map || !map.getLayer || !map.getSource) {
    // Map not ready
    return 'none';
  }
  
  // Remove any existing segment layers first
  removeAllSegmentLayers(map);
  
  if (!showSegments || featureCount === 0) {
    return 'none';
  }
  
  // Use MVT for large datasets
  if (featureCount > PERFORMANCE_THRESHOLD_FEATURES) {
    // Using MVT tiles for performance
    addMVTSegmentsLayers(map, roadClasses);
    return 'mvt';
  }
  
  // Use GeoJSON for smaller datasets
  if (segmentsData && segmentsData.features.length > 0) {
    // Using GeoJSON rendering
    addGeoJSONSegmentsLayers(map, segmentsData, showSegments);
    return 'geojson';
  }
  
  return 'none';
}

/**
 * Remove all segment layers from map
 */
export function removeAllSegmentLayers(map: mapboxgl.Map): void {
  // Check if map is properly initialized
  if (!map || !map.getLayer || !map.getSource) {
    // Map not ready for cleanup
    return;
  }

  const layerIds = ['segments-mvt-layer', 'segments-geojson-layer', 'segments'];
  
  layerIds.forEach(layerId => {
    try {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    } catch (error) {
      // Layer removal failed silently
    }
  });
  
  const sourceIds = ['segments-mvt', 'segments-geojson', 'segments'];
  sourceIds.forEach(sourceId => {
    try {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (error) {
      // Source removal failed silently
    }
  });
}

/**
 * Toggle segment layer visibility
 */
export function toggleSegmentLayerVisibility(
  map: mapboxgl.Map, 
  visible: boolean, 
  layerType: 'mvt' | 'geojson' = 'geojson'
): void {
  const layerId = layerType === 'mvt' ? 'segments-mvt-layer' : 'segments-geojson-layer';
  
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

/**
 * Add click event handlers for segment interaction
 */
export function addSegmentInteractions(
  map: mapboxgl.Map,
  layerType: 'mvt' | 'geojson' = 'geojson'
): void {
  const layerId = layerType === 'mvt' ? 'segments-mvt-layer' : 'segments-geojson-layer';
  
  // Add click event for segment details
  map.on('click', layerId, (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const props = feature.properties;
      
      // Create popup with segment details
      const popup = new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: Inter, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px;">
              ${props?.name || 'Unnamed Road'}
            </h3>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Class:</strong> ${props?.class || 'Unknown'}
            </p>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Length:</strong> ${Math.round(props?.length_m || 0)} m 
              (${Math.round((props?.length_m || 0) * 3.28084)} ft)
            </p>
            ${layerType === 'mvt' ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">Vector Tile</p>` : ''}
          </div>
        `)
        .addTo(map);
    }
  });
  
  // Change cursor on hover
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

/**
 * Performance monitoring for MVT vs GeoJSON
 */
export function logPerformanceMetrics(
  layerType: 'mvt' | 'geojson',
  featureCount: number,
  loadTimeMs: number
): void {
  // Performance metrics tracked silently
}

/**
 * Test MVT endpoint connectivity
 */
export async function testMVTEndpoint(): Promise<boolean> {
  try {
    const testUrl = `${MVT_TILE_ENDPOINT}/14/4829/6160.mvt?format=json`;
    const response = await fetch(testUrl);
    return response.ok;
  } catch (error) {
    // MVT endpoint test failed silently
    return false;
  }
}