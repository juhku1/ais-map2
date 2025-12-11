/**
 * Map initialization and main logic
 * Handles MapLibre GL setup, vessel markers, and real-time updates
 */

// ============================================================================
// Map Setup
// ============================================================================

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [22.0, 60.2],
  zoom: 6,
  pitch: 60,
  bearing: 0,
  attributionControl: false
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.dragRotate.disable();
if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) {
  map.touchZoomRotate.disableRotation();
}

// ============================================================================
// State Management
// ============================================================================

let loading = false;
const vesselState = {};
const vesselMarkers = {};
let firstCenter = true;

// ============================================================================
// AIS Data Loading and Processing
// ============================================================================

async function loadAis() {
  if (loading) return;
  loading = true;
  try {
    if (!metadataLoaded) await fetchVesselMetadata();

    const data = await fetchAisLocations();

    resetStats();

    const latestByMmsi = {};

    // Process all features and calculate speeds
    data.features.forEach(feature => {
      const props = feature.properties || {};
      const mmsi = props.mmsi || feature.mmsi;
      if (!mmsi) return;
      const lat = feature.geometry.coordinates[1];
      const lon = feature.geometry.coordinates[0];
      const sog = (typeof props.sog === "number" ? props.sog : undefined);
      let calcSpeedKnots = null;
      const tsExt = props.timestampExternal;

      if (typeof tsExt === "number") {
        const prev = vesselState[mmsi];
        if (prev) {
          const dtMs = tsExt - prev.lastTimestampMs;
          const dtS = dtMs / 1000;
          if (dtS > 5 && dtS < 3600) {
            const distM = haversine(prev.lastLat, prev.lastLon, lat, lon);
            if (distM > 1) {
              calcSpeedKnots = distM * 3600 / (1852 * dtS);
            }
          }
        }
        vesselState[mmsi] = {
          lastLat: lat,
          lastLon: lon,
          lastTimestampMs: tsExt,
          lastCalcSpeedKnots: calcSpeedKnots
        };
      }
      latestByMmsi[mmsi] = feature;
    });

    let anyPosition = null;

    // Create or update markers for each vessel
    Object.values(latestByMmsi).forEach(feature => {
      const props = feature.properties || {};
      const mmsi = props.mmsi || feature.mmsi;
      if (!mmsi) return;

      const lat = feature.geometry.coordinates[1];
      const lon = feature.geometry.coordinates[0];
      anyPosition = anyPosition || [lon, lat];

      const meta = vesselMetadataByMmsi[mmsi] || {};
      const sog = (typeof props.sog === "number" ? props.sog : undefined);
      let calcSpeedKnots = (vesselState[mmsi] && typeof vesselState[mmsi].lastCalcSpeedKnots === "number")
        ? vesselState[mmsi].lastCalcSpeedKnots
        : null;

      const speed = (typeof calcSpeedKnots === "number" && isFinite(calcSpeedKnots))
        ? calcSpeedKnots
        : (typeof sog === "number" && isFinite(sog) ? sog : 0);

      let angle = (typeof props.heading === "number" && isFinite(props.heading))
        ? props.heading
        : (typeof props.cog === "number" && isFinite(props.cog) ? props.cog : 0);

      const shipType = meta.shipType;
      const color = shipTypeColor(shipType);

      const visualAngle = angle;
      const svgIcon = vesselSvg(speed, visualAngle, color);
      const name = meta.name || props.name || "Unknown vessel";

      const regCountry = getMmsiCountry(mmsi) || "–";
      const regIso2 = getCountryIso2FromMmsiCountry(regCountry);
      const regFlag = regIso2 ? flagImgTag(regIso2) : "";

      const typeName = shipTypeName(shipType);

      let destLabel = null;
      if (meta.destination) {
        const decoded = decodeDestination(meta.destination);
        destLabel = decoded || meta.destination;
      }

      const { cKey, tKey } = registerVesselForStats(regCountry, typeName, destLabel);

      // Build popup HTML
      let popupHtml = "";
      popupHtml += `<strong>${safe(name)}</strong><br>`;
      popupHtml += `<strong>MMSI:</strong> ${safe(mmsi)}<br>`;
      popupHtml += `<strong>Flag state:</strong> ${regCountry} ${regFlag}<br>`;
      if (meta.imo) popupHtml += `<strong>IMO:</strong> ${meta.imo}<br>`;
      if (meta.callSign) popupHtml += `<strong>Callsign:</strong> ${meta.callSign}<br>`;
      if (meta.destination) {
        if (destLabel && destLabel !== meta.destination) {
          popupHtml += `<strong>Destination:</strong> ${meta.destination} (${destLabel})<br>`;
        } else {
          popupHtml += `<strong>Destination:</strong> ${meta.destination}<br>`;
        }
      }
      if (typeof meta.draught === "number") {
        popupHtml += `<strong>Draft:</strong> ${formatMeters(meta.draught / 10)}<br>`;
      }
      if (shipType !== undefined) {
        popupHtml += `<strong>Ship type:</strong> ${typeName} (${shipType})<br>`;
      }
      popupHtml += `<hr style="margin:4px 0;">`;
      popupHtml += `<strong>Reported SOG:</strong> ${formatKnots(sog)}<br>`;
      popupHtml += `<strong>Calculated speed:</strong> ${formatKnots(calcSpeedKnots)}<br>`;
      if (props.cog !== undefined) popupHtml += `<strong>COG:</strong> ${props.cog}&deg;<br>`;
      if (props.heading !== undefined) popupHtml += `<strong>Heading:</strong> ${props.heading}&deg;<br>`;
      if (props.navStat !== undefined) popupHtml += `<strong>Nav status code:</strong> ${props.navStat}<br>`;
      if (props.posAcc !== undefined) popupHtml += `<strong>Position accuracy:</strong> ${props.posAcc ? "high" : "low"}<br>`;
      if (props.raim !== undefined) popupHtml += `<strong>RAIM:</strong> ${props.raim ? "on" : "off"}<br>`;
      if (props.rot !== undefined) popupHtml += `<strong>ROT:</strong> ${props.rot}<br>`;
      if (typeof props.timestampExternal === "number") {
        popupHtml += `<strong>Last update:</strong> ${formatTimestampMs(props.timestampExternal)}<br>`;
      } else if (props.timestamp !== undefined) {
        popupHtml += `<strong>Timestamp (AIS UTC sec):</strong> ${props.timestamp}<br>`;
      }
      popupHtml += `<strong>Position:</strong> ${formatLatLon(lat, lon)}<br>`;

      // Create or update marker
      let markerData = vesselMarkers[mmsi];
      if (!markerData) {
        const el = document.createElement('div');
        el.className = "vessel-svg-icon";
        el.innerHTML = svgIcon;
        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .setPopup(popup)
          .addTo(map);
        vesselMarkers[mmsi] = {
          marker,
          element: el,
          lastAngle: angle,
          lastSpeed: speed,
          color: color,
          countryKey: cKey,
          typeKey: tKey
        };
      } else {
        markerData.element.innerHTML = svgIcon;
        markerData.marker.setLngLat([lon, lat]);
        if (markerData.marker.getPopup()) {
          markerData.marker.getPopup().setHTML(popupHtml);
        }
        markerData.lastAngle = angle;
        markerData.lastSpeed = speed;
        markerData.color = color;
        markerData.countryKey = cKey;
        markerData.typeKey = tKey;
      }
    });

    updateStatsPanel();
    applyFilters();

    // Center map on first load
    if (firstCenter && anyPosition) {
      map.flyTo({ center: anyPosition, zoom: 8, essential: true, bearing: 0 });
      firstCenter = false;
    }
  } catch (err) {
    console.error('Failed to load AIS data:', err);
  } finally {
    loading = false;
  }
}

// ============================================================================
// Initialization
// ============================================================================

map.on('load', () => {
  loadMmsiCountry(() => {
    loadUnlocode(() => {
      loadAis();
      setInterval(loadAis, 60 * 1000);
    });
  });
});
