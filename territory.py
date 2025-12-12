import json
import os
from pathlib import Path

try:
    from shapely.geometry import shape, Point
    from shapely.prepared import prep
except Exception:
    shape = None
    Point = None
    prep = None


GEOJSON_FILE_CANDIDATES = [
    'territorial_waters_baltic_formatted.geojson',
    'territorial_waters_baltic.geojson',
    'baltic_maritime_boundaries.geojson'
]

_territorial_polys = []


def _load_geojson():
    global _territorial_polys
    if shape is None:
        print('territory.py: shapely not available — lookup disabled')
        return

    path = None
    for fn in GEOJSON_FILE_CANDIDATES:
        p = Path(fn)
        if p.exists():
            path = p
            break

    if path is None:
        print('territory.py: no geojson file found')
        return

    try:
        with open(path, 'r', encoding='utf-8') as fh:
            gj = json.load(fh)

        polys = []
        for feat in gj.get('features', []):
            props = feat.get('properties', {}) or {}
            # Prefer territory name fields
            country = props.get('territory1') or props.get('sovereign1') or props.get('geoname') or props.get('name') or None
            geom = feat.get('geometry')
            if not geom:
                continue
            poly = shape(geom)
            try:
                prepared = prep(poly)
            except Exception:
                prepared = poly
            polys.append((country, poly, prepared))

        _territorial_polys = polys
        print(f"territory.py: loaded {len(polys)} features from {path}")
    except Exception as e:
        print('territory.py: error loading geojson', e)


def find_territorial_country(lon, lat):
    """Return the territory name (string) if point is inside any polygon, else None.

    Uses prepared geometries for speed when available. If Shapely is not installed,
    returns None.
    """
    if shape is None or Point is None:
        return None

    if not _territorial_polys:
        _load_geojson()
        if not _territorial_polys:
            return None

    pt = Point(lon, lat)
    for country, poly, prepared in _territorial_polys:
        try:
            contains = False
            if hasattr(prepared, 'contains'):
                contains = prepared.contains(pt)
            else:
                contains = poly.contains(pt)
            if contains:
                return country
        except Exception:
            # fallback to intersects
            try:
                if poly.intersects(pt):
                    return country
            except Exception:
                continue

    return None


if __name__ == '__main__':
    # Quick test: print loaded count
    _load_geojson()
    print('Loaded features:', len(_territorial_polys))
