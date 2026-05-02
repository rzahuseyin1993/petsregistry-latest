# cPanel Upload Endpoint — Deployment Guide

This guide explains how to deploy `upload.php` to your cPanel server so all
file uploads (pet photos, flyers, certificates, blog images, attachments,
business logos, product images, badges) are stored on **your own server**
instead of Supabase Storage.

---

## 1. What goes where

| Item                        | Storage location                                                      |
| --------------------------- | --------------------------------------------------------------------- |
| All file uploads (NEW)      | `/home/<cpanel-user>/public_html/uploads/<bucket>/...` on cPanel      |
| Public URL pattern          | `https://petsregistry.org/uploads/<bucket>/<filename>`                |
| Database rows (URLs, meta)  | Supabase (unchanged — only the URL string is stored)                  |
| Existing Supabase files     | Stay where they are — old URLs continue to work                       |

So Supabase usage from now on = database + auth only. No more storage fees.

---

## 2. Deploy `upload.php`

1. In cPanel → **File Manager**, open `public_html/`.
2. Upload the file `upload.php` from your project's `public/` folder.
3. Create a folder named `uploads` next to it (`public_html/uploads/`).
   - Right-click → **Change Permissions** → set to `755`.
4. (Optional but recommended) Open `upload.php` and **change `UPLOAD_TOKEN`**
   on line ~45 from `CHANGE_ME_TO_A_LONG_RANDOM_STRING` to a long random
   string. Example generator: open a terminal and run `openssl rand -hex 32`.

   Or set it as an environment variable in cPanel:
   - cPanel → **Setup Node.js App** OR **MultiPHP INI Editor** → add:
     `setenv UPLOAD_TOKEN "your-long-random-string"`

5. Verify the script is reachable:
   ```
   curl https://petsregistry.org/upload.php
   ```
   You should see: `{"error":"Unauthorized"}` — that's correct (no token sent).

---

## 3. Tell Lovable the same token

The frontend needs to send this token with every upload. Add it to Lovable:

1. Lovable → **Project Settings** → **Build Secrets**.
2. Add a new secret:
   - Name: `VITE_UPLOAD_TOKEN`
   - Value: the same string you put in `upload.php`
3. Click **Save**, then **Republish** the app so the new token is bundled.

> ⚠️ Because `VITE_*` secrets are bundled into the browser code, anyone who
> inspects your site can read this token. That's acceptable for a first
> migration, but for stronger security later we should route uploads through
> a Supabase edge function that holds the token server-side. Ask if you want
> that upgrade.

---

## 4. Allowed buckets

`upload.php` accepts uploads only into these "buckets" (folder names):

- `pet-photos`
- `flyer-templates`
- `business-listings`
- `admin-attachments`
- `membership-badges`
- `product-images`
- `certificate-backgrounds`
- `blog-images`

If you add a new bucket later, edit the `$ALLOWED_BUCKETS` array in
`upload.php` and re-upload it.

---

## 5. Allowed file types & size

- Extensions: `jpg, jpeg, png, gif, webp, svg, pdf`
- Max size: **10 MB** per file
- Images uploaded through the app are auto-resized to **≤1200 px**, converted
  to **WebP**, and compressed to **≤400 KB** before they're sent — so most
  uploads will be well under 100 KB.

---

## 6. Test it

1. Log into your live site.
2. Go to **Add Pet** → upload a photo.
3. After save, right-click the photo → **Open image in new tab**.
4. The URL should start with `https://petsregistry.org/uploads/pet-photos/...`
   ✅ Migration is working.

---

## 7. Troubleshooting

| Symptom                            | Likely cause                                          |
| ---------------------------------- | ----------------------------------------------------- |
| `401 Unauthorized` in browser DevTools network tab | Token mismatch between `upload.php` and `VITE_UPLOAD_TOKEN` |
| `404 Not Found`                    | `upload.php` not in `public_html/`, or wrong domain   |
| `403 Forbidden` / write fails      | `uploads/` folder permissions — set to `755`          |
| `409 File exists`                  | Same path uploaded twice without `upsert=true` (the app sets upsert automatically for resized images) |
| Image opens but is broken          | Server reached file-upload size limit — increase `upload_max_filesize` and `post_max_size` in cPanel **MultiPHP INI Editor** |

---

## 8. Future: migrating OLD Supabase files to cPanel

We chose **"leave existing files alone"** — old URLs will keep working from
Supabase. When you're ready to fully retire Supabase Storage, ask me to write
a one-off migration script that:

1. Lists all rows whose `image_url` still points to `supabase.co`
2. Downloads each file
3. Re-uploads it to cPanel via `upload.php`
4. Updates the database row with the new URL
