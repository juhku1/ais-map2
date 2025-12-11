# AIS Data Collection

This directory contains the latest AIS (Automatic Identification System) data snapshot from the Baltic Sea region.

Historical data is stored in **Supabase PostgreSQL database**.

## Data Files

```
data/ais/
└── latest.json         # Most recent collection snapshot (for web access)
```

## Database

All historical vessel position data is stored in Supabase:

- **Database**: PostgreSQL (Supabase)
- **Tables**: `vessel_positions`, `collection_summary`
- **Access**: REST API via Supabase client

### Schema

**vessel_positions** table:
- `mmsi`: Maritime Mobile Service Identity (vessel ID)
- `name`: Vessel name
- `longitude`, `latitude`: Position
- `sog`: Speed over ground (knots)
- `cog`: Course over ground (degrees)
- `heading`: Compass heading
- `nav_stat`: Navigation status
- `ship_type`: AIS ship type code
- `destination`: Reported destination
- `eta`: Estimated time of arrival
- `timestamp`: Collection timestamp

## Example Queries

Using Supabase JavaScript client:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://baeebralrmgccruigyle.supabase.co',
  'YOUR_ANON_KEY'
)

// Get latest positions
const { data } = await supabase
  .from('vessel_positions')
  .select('*')
  .order('timestamp', { ascending: false })
  .limit(100)

// Get vessel track
const { data } = await supabase
  .from('vessel_positions')
  .select('timestamp, longitude, latitude, sog')
  .eq('mmsi', 230982000)
  .order('timestamp', { ascending: false })
  .limit(100)
```

## Collection

Data is automatically collected every 10 minutes via GitHub Actions.

Source: [Digitraffic Marine API](https://meri.digitraffic.fi)

Region: Baltic Sea (17-30.3°E, 58.5-66°N)

## Storage

- Supabase Free Tier: 500 MB database
- ~2.4 MB per collection
- ~200 collections before limit
- Old data can be archived/cleaned as needed
