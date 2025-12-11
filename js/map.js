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
    [30.3, 66.0]    // Northeast corner [lng, lat] - eastern limit at St. Petersburg (30.31°E)
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
  // Add territorial sea boundary (12 nautical miles) from Traficom
  // Official maritime boundaries from Finnish Transport and Communications Agency
  map.addSource('territorial-waters', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [] // Will be populated from WFS
    }
  });
  
  // Fetch territorial waters boundary from Traficom WFS
  fetchTerritorialWaters();
});

async function fetchTerritorialWaters() {
  try {
    // OpenStreetMap Overpass API - maritime boundaries for Baltic Sea
    // Uses boundary=maritime + border_type=territorial tags
    // License: ODbL (Open Database License) - requires attribution and share-alike
    // More accurate and up-to-date than Natural Earth
    
    // Overpass query for territorial waters in Baltic Sea region
    const bbox = '57.0,17.0,67.0,31.0'; // south,west,north,east
    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["boundary"="maritime"]["border_type"="territorial"](${bbox});
        relation["boundary"="maritime"]["border_type"="territorial"](${bbox});
      );
      out geom;
    `;
    
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: overpassQuery
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch maritime boundaries from OpenStreetMap');
      return;
    }
    
    const osmData = await response.json();
    
    // Convert OSM data to GeoJSON
    const features = osmData.elements
      .filter(el => el.geometry || el.members)
      .map(element => {
        let coordinates;
        
        if (element.type === 'way' && element.geometry) {
          // Simple way - convert nodes to coordinate array
          coordinates = element.geometry.map(node => [node.lon, node.lat]);
          
          return {
            type: 'Feature',
            properties: {
              name: element.tags?.name || 'Maritime boundary',
              border_type: element.tags?.border_type,
              admin_level: element.tags?.admin_level
            },
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          };
        } else if (element.type === 'relation' && element.members) {
          // Relation - collect all way geometries
          const allCoords = [];
          for (const member of element.members) {
            if (member.geometry) {
              allCoords.push(member.geometry.map(node => [node.lon, node.lat]));
            }
          }
          
          if (allCoords.length > 0) {
            return {
              type: 'Feature',
              properties: {
                name: element.tags?.name || 'Maritime boundary',
                border_type: element.tags?.border_type,
                admin_level: element.tags?.admin_level
              },
              geometry: {
                type: 'MultiLineString',
                coordinates: allCoords
              }
            };
          }
        }
        
        return null;
      })
      .filter(f => f !== null);
    
    const geojson = {
      type: 'FeatureCollection',
      features: features
    };
    
    console.log('OSM maritime boundaries received:', geojson.features?.length, 'features in Baltic region');
    
    // Update source with fetched data
    if (map.getSource('territorial-waters')) {
      map.getSource('territorial-waters').setData(geojson);
      
      // Add line layer for territorial waters boundary
      // Layer added early so it appears UNDER vessel/buoy markers
      if (!map.getLayer('territorial-waters-line')) {
        // Find the first symbol layer to insert boundary lines before it
        const layers = map.getStyle().layers;
        let firstSymbolId;
        for (const layer of layers) {
          if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
          }
        }
        
        map.addLayer({
          id: 'territorial-waters-line',
          type: 'line',
          source: 'territorial-waters',
          paint: {
            'line-color': '#00eaff',
            'line-width': 2,
            'line-opacity': 0.6,
            'line-dasharray': [4, 2]
          }
        }, firstSymbolId); // Insert before first symbol layer (labels, markers will be on top)
      }
      
      console.log('Territorial waters boundary layer added (under markers)');
    }
  } catch (error) {
    console.error('Error loading territorial waters:', error);
  }
}

// Export map instance
export function initMap() {
  return map;
}
