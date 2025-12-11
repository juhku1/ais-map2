/**
 * Vessel Track Management
 * Shows vessel's position 24 hours ago
 */

const active24hMarkers = new Map(); // mmsi -> { marker, element }

async function fetch24hAgoPosition(mmsi) {
  try {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const url = `https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${mmsi}&from=${twentyFourHoursAgo}`;
    
    console.log(`[24H] Fetching position from 24h ago for MMSI ${mmsi}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const features = data.features || [];
    
    console.log(`[24H] Received ${features.length} features for MMSI ${mmsi}`);
    
    if (features.length > 0) {
      const position = features[0];
      console.log(`[24H] Position timestamp:`, new Date(position.properties.timestampExternal));
      return position;
    }
    
    return null;
  } catch (error) {
    console.error(`[24H] Failed to fetch 24h position for MMSI ${mmsi}:`, error);
    return null;
  }
}

function show24hAgoMarker(mmsi, currentPosition, color = '#00eaff') {
  if (active24hMarkers.has(mmsi)) {
    console.log(`[24H] Marker already visible for MMSI ${mmsi}`);
    return;
  }

  const mapInstance = window.map;
  if (!mapInstance) {
    console.error('[24H] Map not initialized yet');
    return;
  }

  fetch24hAgoPosition(mmsi).then(oldPosition => {
    if (!oldPosition) {
      console.warn(`[24H] No 24h ago data for MMSI ${mmsi}`);
      alert('No historical position data available from 24 hours ago.');
      return;
    }

    const oldCoords = oldPosition.geometry.coordinates;
    const oldLat = oldCoords[1];
    const oldLon = oldCoords[0];
    const oldTime = new Date(oldPosition.properties.timestampExternal);
    
    console.log(`[24H] 24h ago position: [${oldLon}, ${oldLat}] at ${oldTime}`);

    // Create marker element
    const el = document.createElement('div');
    el.className = 'historical-marker';
    el.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="12" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 2" opacity="0.6"/>
        <circle cx="16" cy="16" r="4" fill="${color}" opacity="0.8"/>
        <text x="16" y="26" font-size="9" fill="${color}" text-anchor="middle" font-family="monospace">24h</text>
      </svg>
    `;

    // Add marker to map
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([oldLon, oldLat])
      .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div class="vessel-popup">
          <div class="popup-header">
            <div class="popup-title">24 Hours Ago</div>
            <div class="popup-subtitle">MMSI ${mmsi}</div>
          </div>
          <div class="popup-section">
            <div class="popup-row"><span class="label">Time:</span><span class="value">${oldTime.toLocaleString()}</span></div>
            <div class="popup-row"><span class="label">Position:</span><span class="value">${oldLat.toFixed(5)}, ${oldLon.toFixed(5)}</span></div>
          </div>
        </div>
      `))
      .addTo(mapInstance);

    // Draw line from old position to current
    if (currentPosition) {
      const lineId = `track-line-${mmsi}`;
      const sourceId = `track-source-${mmsi}`;
      
      mapInstance.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [oldCoords, currentPosition]
          }
        }
      });

      mapInstance.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': color,
          'line-width': 2,
          'line-opacity': 0.4,
          'line-dasharray': [4, 4]
        }
      });

      active24hMarkers.set(mmsi, {
        marker,
        element: el,
        lineId,
        sourceId
      });
    } else {
      active24hMarkers.set(mmsi, {
        marker,
        element: el
      });
    }

    console.log(`[24H] ✓ 24h marker displayed for MMSI ${mmsi}`);
  }).catch(error => {
    console.error(`[24H] Error displaying 24h marker for MMSI ${mmsi}:`, error);
  });
}

function hide24hAgoMarker(mmsi) {
  const data = active24hMarkers.get(mmsi);
  if (!data) return;

  const mapInstance = window.map;
  if (!mapInstance) return;

  // Remove marker
  if (data.marker) {
    data.marker.remove();
  }

  // Remove line if exists
  if (data.lineId && mapInstance.getLayer(data.lineId)) {
    mapInstance.removeLayer(data.lineId);
  }
  if (data.sourceId && mapInstance.getSource(data.sourceId)) {
    mapInstance.removeSource(data.sourceId);
  }

  active24hMarkers.delete(mmsi);
  console.log(`[24H] Marker removed for MMSI ${mmsi}`);
}

function toggle24hAgoMarker(mmsi, currentPosition, color) {
  if (active24hMarkers.has(mmsi)) {
    hide24hAgoMarker(mmsi);
    return false; // Now hidden
  } else {
    show24hAgoMarker(mmsi, currentPosition, color);
    return true; // Now visible
  }
}

function is24hMarkerVisible(mmsi) {
  return active24hMarkers.has(mmsi);
}
