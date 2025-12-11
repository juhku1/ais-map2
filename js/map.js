/**
 * MapLibre GL map initialization
 * Provides base map setup and exports map instance
 */

// ============================================================================
// Map Setup
// ============================================================================

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [24.9, 60.0],  // Gulf of Finland, centered more north towards Helsinki
  zoom: 8,
  pitch: 60,
  bearing: 340,  // Northwest direction towards Helsinki
  attributionControl: false,
  maxBounds: [
    [18.0, 58.5],   // Southwest corner [lng, lat] - western limit at Stockholm (18.06°E)
    [35.0, 66.0]    // Northeast corner [lng, lat] - covers Baltic Sea region
  ]
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Disable rotation
map.dragRotate.disable();
if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) {
  map.touchZoomRotate.disableRotation();
}

// ============================================================================
// Territorial Waters Boundary Layer
// ============================================================================

map.on('load', () => {
  // Add territorial sea boundary (12 nautical miles) from Maanmittauslaitos
  // Using WMS service as GeoJSON source
  map.addSource('territorial-waters', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [] // Will be populated from WMS or static GeoJSON
    }
  });
  
  // Fetch territorial waters boundary from Maanmittauslaitos WFS
  fetchTerritorialWaters();
});

async function fetchTerritorialWaters() {
  try {
    // Maanmittauslaitos WFS service for territorial sea baseline
    const wfsUrl = 'https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wfs';
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'rajoitusalueet:aluevesi_12mpk', // 12 nautical miles territorial waters
      outputFormat: 'application/json',
      srsName: 'EPSG:4326'
    });
    
    const response = await fetch(`${wfsUrl}?${params}`);
    if (!response.ok) {
      console.warn('Failed to fetch territorial waters, using fallback');
      return;
    }
    
    const geojson = await response.json();
    
    // Update source with fetched data
    if (map.getSource('territorial-waters')) {
      map.getSource('territorial-waters').setData(geojson);
      
      // Add line layer for territorial waters boundary
      if (!map.getLayer('territorial-waters-line')) {
        map.addLayer({
          id: 'territorial-waters-line',
          type: 'line',
          source: 'territorial-waters',
          paint: {
            'line-color': '#00eaff',
            'line-width': 2,
            'line-opacity': 0.6,
            'line-dasharray': [3, 2]
          }
        });
      }
      
      console.log('Territorial waters boundary loaded');
    }
  } catch (error) {
    console.error('Error loading territorial waters:', error);
  }
}

// Export map instance
export function initMap() {
  return map;
}
