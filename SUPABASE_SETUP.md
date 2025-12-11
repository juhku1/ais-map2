# Supabase Setup Instructions

## 1. Run SQL Schema

Copy and run the SQL from `supabase_schema.sql` in Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Click "SQL Editor" in sidebar
3. Click "New query"
4. Paste contents of `supabase_schema.sql`
5. Click "Run"

This creates:
- `vessel_positions` table with indexes
- `collection_summary` table
- Row Level Security policies

## 2. Get API Keys

⚠️ **IMPORTANT: Never commit these keys to git!**

1. Go to: Project Settings → API
2. Copy these values:

**Project URL**
- Find under "Project URL"
- Format: `https://[project-ref].supabase.co`

**Service Role Key** (secret - for GitHub Actions only)
- Find under "Project API keys" → `service_role` → "secret"
- This key has full database access - keep it secret!

**Anon Key** (public - for web client, optional)
- Find under "Project API keys" → `anon` → `public`
- This key is safe to use in browser (RLS protects data)

## 3. Add GitHub Secrets

⚠️ **NEVER put these in code files!**

Go to: https://github.com/[your-username]/AnchorDraggers/settings/secrets/actions

Add two repository secrets:

1. **SUPABASE_URL**
   - Paste your Project URL

2. **SUPABASE_KEY**
   - Paste your `service_role` **secret** key
   - This allows GitHub Actions to write data

## 4. Test Collection

Manually trigger workflow:
1. Go to Actions tab
2. Click "Collect AIS Data"
3. Click "Run workflow"
4. Select branch: main
5. Click "Run workflow"

## 5. Verify Data

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

## Security Best Practices

✅ **DO:**
- Store keys in GitHub Secrets
- Use `service_role` key only in backend/GitHub Actions
- Use `anon` key for web client (protected by RLS)
- Regenerate keys if exposed

❌ **DON'T:**
- Commit keys to git
- Share `service_role` key publicly
- Use `service_role` key in browser
- Hardcode keys in source files
