# Supabase Setup Instructions

## 1. Run SQL Schema

Copy and run the SQL from `supabase_schema.sql` in Supabase SQL Editor:

1. Go to https://supabase.com/dashboard/project/baeebralrmgccruigyle
2. Click "SQL Editor" in sidebar
3. Click "New query"
4. Paste contents of `supabase_schema.sql`
5. Click "Run"

This creates:
- `vessel_positions` table with indexes
- `collection_summary` table
- Row Level Security policies

## 2. Add GitHub Secrets

Go to: https://github.com/juhku1/AnchorDraggers/settings/secrets/actions

Add two secrets:

**SUPABASE_URL**
```
https://baeebralrmgccruigyle.supabase.co
```

**SUPABASE_KEY** (service_role key)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZWVicmFscm1nY2NydWlneWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ4MzA1MCwiZXhwIjoyMDgxMDU5MDUwfQ.GBij4I5o7ubsoH_2X0FyhPc9lRjs_mq88DlNU-23dbY
```

## 3. Test Collection

Manually trigger workflow:
1. Go to Actions tab
2. Click "Collect AIS Data"
3. Click "Run workflow"
4. Select branch: main
5. Click "Run workflow"

## 4. Verify Data

Check Supabase Table Editor:
- Go to project dashboard
- Click "Table Editor"
- Select `vessel_positions` table
- Should see ~9,735 rows per collection

## Storage Info

- Free tier: 500 MB database
- ~2.4 MB per collection
- ~200 collections before limit (~33 hours of data)
- Consider cleanup policy or upgrade plan
