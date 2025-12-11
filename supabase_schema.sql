-- AnchorDraggers Supabase Database Schema
-- Run this in Supabase SQL Editor

-- Vessel positions table
CREATE TABLE IF NOT EXISTS vessel_positions (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    mmsi BIGINT NOT NULL,
    name TEXT,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    sog REAL,
    cog REAL,
    heading INTEGER,
    nav_stat INTEGER,
    ship_type INTEGER,
    destination TEXT,
    eta TEXT,
    draught REAL,
    pos_acc BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_vessel_mmsi ON vessel_positions(mmsi);
CREATE INDEX IF NOT EXISTS idx_vessel_timestamp ON vessel_positions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vessel_mmsi_timestamp ON vessel_positions(mmsi, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vessel_created_at ON vessel_positions(created_at DESC);

-- Collection summary table
CREATE TABLE IF NOT EXISTS collection_summary (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    vessel_count INTEGER NOT NULL,
    collection_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for summary
CREATE INDEX IF NOT EXISTS idx_summary_timestamp ON collection_summary(timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE vessel_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_summary ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anon key)
CREATE POLICY "Allow public read access" ON vessel_positions
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON collection_summary
    FOR SELECT USING (true);

-- Allow service role full access (for GitHub Actions)
CREATE POLICY "Allow service role full access" ON vessel_positions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON collection_summary
    FOR ALL USING (auth.role() = 'service_role');
