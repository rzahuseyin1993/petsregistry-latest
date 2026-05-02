# Migrating to a New Supabase Account

This guide walks you through moving your entire backend (database, auth users, edge functions, secrets) to a brand-new Supabase project — for example, one in your own personal/paid Supabase account instead of Lovable Cloud.

> **Before you begin**: file storage has already been moved to your cPanel server (`/uploads/...` via `upload.php`). So you only need to migrate the **database + auth + edge functions**.  
> Existing image URLs stored in the DB will keep pointing to wherever they were uploaded (Supabase Storage for old files, cPanel for new ones).

---

## Step 1 — Create the new Supabase project

1. Go to https://supabase.com/dashboard → **New Project**
2. Pick a region close to your users
3. Save the **Project URL**, **anon key**, **service_role key**, and **database password** — you'll need them later

---

## Step 2 — Export everything from the current project

In the **current** (Lovable Cloud) Supabase project dashboard:

### 2a. Export the database schema + data
- Go to **Database → Backups** (or **Settings → Database**)
- Click **Download backup** to get a full `.sql` dump (schema + data + RLS + functions + triggers)
- Save it as `petsregistry_backup.sql`

> If "Download backup" isn't available on your plan, use the CLI instead:
> ```bash
> supabase db dump --db-url "postgresql://postgres:[OLD_PASSWORD]@db.aqaausjzzkqcubgfjgnc.supabase.co:5432/postgres" -f petsregistry_backup.sql
> ```

### 2b. Export auth users
- Go to **Authentication → Users** → click **⋯ → Export users as CSV**
- Save it as `users_export.csv`
- ⚠️ Password hashes ARE included — users can log in on the new project without resetting passwords

### 2c. Note your edge function secrets
- Go to **Edge Functions → Secrets** (or **Project Settings → Edge Functions**)
- Write down the names + values of every secret (e.g. `STRIPE_SECRET_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, etc.)
- You'll re-add them to the new project

---

## Step 3 — Import into the new Supabase project

### 3a. Restore the database
In the new project:
- Go to **SQL Editor → New query**
- Paste the contents of `petsregistry_backup.sql` and click **Run**

OR via CLI (recommended for big dumps):
```bash
psql "postgresql://postgres:[NEW_PASSWORD]@db.[NEW_REF].supabase.co:5432/postgres" -f petsregistry_backup.sql
```

### 3b. Import auth users
- In the new project: **Authentication → Users → Import users** → upload `users_export.csv`
- Verify a few users appear in the list

### 3c. Re-create edge function secrets
- **Edge Functions → Secrets → New secret** — add each name/value you noted in Step 2c

### 3d. Re-deploy edge functions
The edge function code already lives in your repo under `supabase/functions/`. Once you point Lovable to the new project (Step 4), redeploy will happen automatically on the next code change. Or manually:
```bash
supabase functions deploy --project-ref [NEW_REF]
```

### 3e. Configure Auth
In the new project: **Authentication → Providers**
- Enable **Email** (and disable "Confirm email" if you want instant signup, matching current behaviour)
- Re-add **Google OAuth** with your Google Client ID / Secret
- Under **URL Configuration**, set:
  - **Site URL**: `https://petsregistry.org`
  - **Redirect URLs**: `https://petsregistry.org/**`, `https://*.lovable.app/**` (for previews)

### 3f. Re-enable the cron job (lost-reports cleanup)
In the new project's SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'cleanup-lost-reports-daily',
  '15 3 * * *',
  $$ SELECT net.http_post(
    url := 'https://[NEW_REF].supabase.co/functions/v1/cleanup-lost-reports',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer [NEW_SERVICE_ROLE_KEY]')
  ); $$
);
```

---

## Step 4 — Point the website to the new project

Tell me **the new Project URL and anon key** and I will:
1. Disconnect Lovable Cloud
2. Connect the new Supabase project as a regular integration
3. Update `src/integrations/supabase/client.ts` automatically
4. Regenerate `src/integrations/supabase/types.ts` from the new schema

After that, redeploy and test login + a pet page to confirm everything works.

---

## Step 5 — Verify (mandatory)

- [ ] Log in with an existing user (password should still work)
- [ ] Open a pet profile → confirm photos still load (old = Supabase Storage URL, new uploads = cPanel URL)
- [ ] Submit a new lost report as guest → confirm it appears in `/admin/lost-reports`
- [ ] Trigger an admin action (mark as found, delete) → confirm RLS still works
- [ ] Stripe / PayPal checkout → confirm webhook still fires (you may need to update webhook URLs in Stripe/PayPal dashboards to point to the new edge function URL)

---

## What you can leave behind

- **Supabase Storage buckets** — already migrated to cPanel; old URLs keep working from the old project as long as you don't delete it. If you want to fully delete the old project later, run a one-off script to copy each bucket's contents to cPanel first.
- **The old Lovable Cloud project** — keep it around for ~30 days as a safety net before deleting.

---

When you've completed Steps 1–3, send me the new Project URL + anon key and I'll handle Step 4.
