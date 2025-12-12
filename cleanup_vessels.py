#!/usr/bin/env python3
"""
Cleanup script for AIS data - Smart territorial boundary-based cleanup

LOGIC:
1. Fetch all vessel positions from last 96 hours (to cover Russia-related vessels)
2. For each vessel (MMSI), collect unique territorial_water_country_code values
3. Determine if vessel is Russia-related:
   - Russian flag (MMSI starts with 273)
   - OR visited Russian territorial waters (RU in territorial codes)
4. Keep vessels based on boundary crossing within time window:
   - Russia-related vessels: 96h time window (4 days)
   - Other vessels: 48h time window (2 days)
   - Keep if 2+ different territorial codes (including NULL)
5. Delete ALL data for vessels that didn't cross boundaries within their time window

Examples:
  KEPT (Russia-related, 96h window):
    * Russian flag + FI and RU
    * Any flag + NULL and RU
    * Russian flag staying in RU waters (single territory but Russia-related)
  KEPT (other vessels, 48h window):
    * FI and SE (crossed boundary)
    * NULL and DK (international to Denmark)
  DELETED:
    * Greek flag only in FI waters for 48h (no boundary crossing)
    * Swedish flag only in NULL for 48h (stayed international)

This focuses monitoring on Russia-related traffic while still tracking other
boundary-crossing vessels with shorter retention.
"""

import json
import os
from datetime import datetime, timezone, timedelta

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://baeebralrmgccruigyle.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

def get_supabase_client():
    """Initialize Supabase client"""
    try:
        from supabase import create_client, Client
        if not SUPABASE_KEY:
            raise ValueError("SUPABASE_KEY environment variable not set")
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except ImportError:
        print("Error: supabase-py not installed. Install with: pip install supabase")
        return None
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        return None

def is_russian_related(mmsi, territorial_codes):
    """
    Check if vessel is Russia-related:
    - Russian flag (MMSI starts with 273)
    - OR has visited Russian territorial waters (RU in codes)
    """
    mmsi_str = str(mmsi)
    has_russian_flag = mmsi_str.startswith('273')
    visited_russian_waters = 'RU' in territorial_codes
    return has_russian_flag or visited_russian_waters

def analyze_vessel_movements(supabase, hours=96):
    """
    Analyze vessel movements using territorial_water_country_code
    
    Time windows:
    - Russia-related vessels: 96h (full lookback period)
    - Other vessels: 48h
    
    Returns list of MMSIs that should be kept (crossed territorial boundaries)
    """
    # Calculate time thresholds
    threshold_96h = datetime.now(timezone.utc) - timedelta(hours=96)
    threshold_48h = datetime.now(timezone.utc) - timedelta(hours=48)
    threshold_96h_str = threshold_96h.isoformat()
    
    print(f"Analyzing movements since {threshold_96h_str} (96h ago)")
    
    # Fetch all vessel positions from the last 96 hours
    try:
        response = supabase.table('vessel_positions')\
            .select('mmsi, territorial_water_country_code, timestamp')\
            .gte('timestamp', threshold_96h_str)\
            .execute()
        
        positions = response.data
        print(f"Found {len(positions)} position records in last 96 hours")
        
    except Exception as e:
        print(f"Error fetching positions: {e}")
        return set(), set()
    
    # Group by MMSI and collect unique territorial codes with timestamps
    vessels = {}
    for pos in positions:
        mmsi = pos['mmsi']
        territorial_code = pos.get('territorial_water_country_code')
        timestamp = pos['timestamp']
        
        if mmsi not in vessels:
            vessels[mmsi] = {'codes': set(), 'timestamps': []}
        vessels[mmsi]['codes'].add(territorial_code)
        vessels[mmsi]['timestamps'].append(timestamp)
    
    print(f"Tracking {len(vessels)} unique vessels")
    
    # Analyze each vessel
    vessels_to_keep = set()
    vessels_to_delete = set()
    russia_related_count = 0
    
    for mmsi, data in vessels.items():
        territorial_codes = data['codes']
        
        # Check if Russia-related
        is_russia = is_russian_related(mmsi, territorial_codes)
        
        if is_russia:
            russia_related_count += 1
            # Russia-related: use 96h window, keep if ANY movement recorded
            # (we want to track all Russia-related vessels regardless of boundary crossing)
            vessels_to_keep.add(mmsi)
        else:
            # Other vessels: use 48h window
            # Filter to only positions within 48h
            recent_codes = set()
            for pos in positions:
                if pos['mmsi'] == mmsi and pos['timestamp'] >= threshold_48h.isoformat():
                    recent_codes.add(pos.get('territorial_water_country_code'))
            
            # Keep if crossed boundaries in last 48h
            if len(recent_codes) >= 2:
                vessels_to_keep.add(mmsi)
            else:
                vessels_to_delete.add(mmsi)
    
    print(f"Analysis complete:")
    print(f"  - Russia-related vessels (96h): {russia_related_count}")
    print(f"  - Vessels crossing boundaries: {len(vessels_to_keep)}")
    print(f"  - Vessels to delete: {len(vessels_to_delete)}")
    
    return vessels_to_keep, vessels_to_delete

def delete_vessels(supabase, mmsi_set):
    """
    Delete ALL positions for vessels that didn't cross territorial boundaries.
    Since this runs daily, vessels that previously crossed boundaries have already
    been preserved, and we only delete vessels that are currently not interesting.
    """
    if not mmsi_set:
        print("No vessels to delete")
        return
    
    # Convert set to list for query
    mmsi_list = list(mmsi_set)
    
    try:
        # Delete in batches to avoid query size limits
        batch_size = 100
        total_deleted = 0
        
        for i in range(0, len(mmsi_list), batch_size):
            batch = mmsi_list[i:i + batch_size]
            
            # Delete ALL records for these vessels
            result = supabase.table('vessel_positions')\
                .delete()\
                .in_('mmsi', batch)\
                .execute()
            
            batch_deleted = len(batch)
            total_deleted += batch_deleted
            print(f"Deleted batch {i//batch_size + 1}: ~{batch_deleted} vessel records")
        
        print(f"✓ Deleted records for {len(mmsi_set)} vessels")
        
    except Exception as e:
        print(f"Error deleting vessels: {e}")
        raise

def main():
    """Main cleanup routine"""
    print("=" * 60)
    print("AIS Data Cleanup Started")
    print("=" * 60)
    
    # Initialize Supabase
    supabase = get_supabase_client()
    if not supabase:
        print("Failed to initialize Supabase client")
        return
    
    # Analyze vessel movements (96h lookback for Russia-related, 48h for others)
    vessels_to_keep, vessels_to_delete = analyze_vessel_movements(supabase, hours=96)
    
    # Delete vessels that didn't cross boundaries
    if vessels_to_delete:
        print(f"\nDeleting {len(vessels_to_delete)} vessels that didn't cross territorial boundaries...")
        delete_vessels(supabase, vessels_to_delete)
    else:
        print("\nNo vessels to delete - all tracked vessels crossed territorial boundaries")
    
    print("\nCleanup complete!")
    print("=" * 60)

if __name__ == '__main__':
    main()
