# cPanel Deployment Guide — Pets Registry

This guide covers deploying the React/Vite frontend to **cPanel** (`public_html/`) for [petsregistry.org](https://petsregistry.org). The app uses **client-side routing** (React Router), **Supabase** (auth + database + edge functions), and **PHP endpoints** on your server for file uploads and AI Pet Expert chat storage.

---

## Quick checklist

- [ ] Production `.env` is set (see below)
- [ ] `npm run build` completed without errors
- [ ] **All contents of `dist/`** uploaded to `public_html/` — including **`.htaccess`**
- [ ] `uploads/` and `chat-data/` folders preserved (do not delete user data)
- [ ] `UPLOAD_TOKEN` matches between `upload.php`, `chat-storage.php`, and `VITE_UPLOAD_TOKEN`
- [ ] Supabase secrets set (`GEMINI_API_KEY`, etc.) and edge functions deployed
- [ ] Hard refresh in browser after deploy (`Ctrl+Shift+R`)

---

## 1. Architecture

| Layer | Where it runs |
| ----- | ------------- |
| React SPA (`index.html`, `assets/*`) | cPanel `public_html/` |
| File uploads | `public_html/uploads/` via `upload.php` |
| AI Pet Expert chat sessions | `public_html/chat-data/` via `chat-storage.php` |
| Auth, database, payments, AI APIs | Supabase (cloud) |

Routes like `/admin/directory` or `/dashboard` are **not real folders** on the server. Apache must rewrite them to `index.html` so React Router can handle navigation.

---

## 2. Production environment (build time)

Create a `.env` file in the project root **before** running `npm run build`. Vite bakes `VITE_*` values into the JavaScript bundle at build time.

```env
VITE_SUPABASE_URL=https://zjvoefytvfxpbgzrwgkt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_UPLOAD_TOKEN=your-long-random-token
```

Optional:

```env
VITE_MAINTENANCE_MODE=false
VITE_MAINTENANCE_MESSAGE=We are performing scheduled maintenance.
```

**Do not set** `VITE_DEV_VISITOR_COUNTRY` in production — it is for local development only.

> The upload token is visible in the browser bundle. That is acceptable for the current setup, but keep it long and random. The same value must be configured in PHP (see §5).

---

## 3. Build locally

```bash
npm install
npm run build
```

Output goes to the `dist/` folder. Vite copies everything from `public/` into `dist/`, including:

- `.htaccess` — **required for SPA routing**
- `upload.php`
- `chat-storage.php`
- `robots.txt`, `favicon.png`, etc.

Verify the build:

```bash
# Windows PowerShell
Get-ChildItem -Force dist
```

You should see `index.html`, `assets/`, `.htaccess`, and the PHP files.

---

## 4. Upload to cPanel

### Target directory

Upload into **`public_html/`** (or the document root for your domain).

### What to upload

Upload **the contents of `dist/`**, not the `dist` folder itself:

```
public_html/
├── .htaccess          ← critical — often skipped because it is hidden
├── index.html
├── assets/
├── upload.php
├── chat-storage.php
├── favicon.png
├── robots.txt
├── uploads/           ← keep existing — user uploads
└── chat-data/         ← keep existing — Pet Expert sessions
```

### Preserve existing data

| Folder | Purpose | Action on redeploy |
| ------ | ------- | ------------------ |
| `uploads/` | Pet photos, flyers, blog images, etc. | **Keep** — do not delete |
| `chat-data/` | AI Pet Expert session JSON + images | **Keep** — do not delete |

You can safely overwrite `index.html`, `assets/`, `.htaccess`, and the PHP files on each deploy.

### Show hidden files in cPanel

1. cPanel → **File Manager**
2. **Settings** (top right) → enable **Show Hidden Files (dotfiles)**
3. Confirm `.htaccess` exists in `public_html/`

If `.htaccess` is missing, upload `dist/.htaccess` manually.

### File permissions

| Item | Permission |
| ---- | ---------- |
| `.htaccess` | `644` |
| `upload.php`, `chat-storage.php` | `644` |
| `uploads/`, `chat-data/` | `755` |

### PHP upload limits (if large files fail)

cPanel → **MultiPHP INI Editor** → increase:

- `upload_max_filesize` (e.g. `12M`)
- `post_max_size` (e.g. `14M`)

---

## 5. PHP tokens must match

Both `upload.php` and `chat-storage.php` authenticate with:

```
Authorization: Bearer <UPLOAD_TOKEN>
```

The token is read from the `UPLOAD_TOKEN` environment variable on cPanel, or from the fallback constant in each PHP file.

**All three must use the same value:**

1. `upload.php` on the server
2. `chat-storage.php` on the server
3. `VITE_UPLOAD_TOKEN` in your `.env` at build time

After changing the token, rebuild (`npm run build`) and re-upload `assets/` + `index.html`.

Quick test:

```bash
curl https://petsregistry.org/upload.php
# Expected: {"error":"Unauthorized"}
```

More detail on uploads: [`public/UPLOAD_PHP_SETUP.md`](public/UPLOAD_PHP_SETUP.md)

---

## 6. SPA routing (`.htaccess`)

Without `.htaccess`, these will **404** on refresh or direct URL:

- `https://petsregistry.org/admin/login`
- `https://petsregistry.org/dashboard`
- Any deep link

The file in `public/.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>

DirectoryIndex index.html
```

**If you deploy to a subdirectory** (e.g. `public_html/app/`), change `RewriteBase /` to `RewriteBase /app/`.

If routes still 404 after uploading `.htaccess`, contact your host to confirm **mod_rewrite** is enabled for your account.

---

## 7. Supabase (backend)

The frontend talks to Supabase for auth, data, checkout, and AI. Deploying to cPanel does **not** deploy edge functions — do that separately when backend code changes.

### Required secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

| Secret | Used for |
| ------ | -------- |
| `GEMINI_API_KEY` | AI Pet Expert (members) + admin AI features |
| `OPENROUTER_API_KEY` | Optional fallback for admin AI |

Payment-related secrets (Airwallex, PayPal, etc.) are configured via Admin → Payments or Supabase secrets — see [`PAYMENT_QA_CHECKLIST.md`](PAYMENT_QA_CHECKLIST.md).

### Deploy edge functions (when changed)

```bash
npx supabase login
npx supabase functions deploy pet-expert --project-ref zjvoefytvfxpbgzrwgkt
npx supabase functions deploy ai-flyer --project-ref zjvoefytvfxpbgzrwgkt
# ... deploy other functions as needed
```

Database migrations are applied via Supabase SQL editor or CLI — see [`public/SUPABASE_MIGRATION_GUIDE.md`](public/SUPABASE_MIGRATION_GUIDE.md).

---

## 8. Post-deploy verification

### Routing

| Test | Expected |
| ---- | -------- |
| Open `https://petsregistry.org` | Homepage loads |
| Open `https://petsregistry.org/admin/login` directly | Admin login page (not 404) |
| Navigate admin → press **F5** | Same page reloads correctly |
| Open DevTools → Network → click an in-app link | No full `index.html` reload (normal SPA navigation) |

### Auth & uploads

- Sign in as a member → dashboard loads
- Upload a pet photo → image URL starts with `https://petsregistry.org/uploads/`
- AI Pet Expert → send a message (requires `GEMINI_API_KEY` deployed)

### Cache

After each deploy, Vite generates new hashed filenames in `assets/` (e.g. `index-a1b2c3.js`). Browsers may cache old `index.html` briefly. If the site looks broken or stale:

- Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
- Or test in a private/incognito window

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------- | --- |
| **404** on `/admin/...` or refresh | `.htaccess` missing or hidden | Upload `dist/.htaccess`; enable dotfiles in File Manager |
| Blank page after deploy | Old cached `index.html` pointing to removed JS chunks | Hard refresh; confirm `assets/` uploaded fully |
| `401 Unauthorized` on uploads | Token mismatch | Align `UPLOAD_TOKEN` in PHP and `VITE_UPLOAD_TOKEN` in `.env`, rebuild |
| Upload write fails | Permissions | Set `uploads/` to `755` |
| Admin login loops / blank | Missing admin role | Add row in Supabase `user_roles` table |
| AI errors | Missing Gemini key or function not deployed | Set `GEMINI_API_KEY`; redeploy `pet-expert` |
| Uploaded source instead of `dist/` | Wrong folder uploaded | Only upload `dist/*` contents |
| Images from old deploy | Partial upload | Re-upload entire `assets/` folder |

---

## 10. Standard redeploy workflow

```bash
# 1. Pull latest code
git pull

# 2. Ensure .env has production values
# 3. Build
npm install
npm run build

# 4. Upload dist/ contents to public_html/ via FTP or cPanel File Manager
#    - Overwrite index.html, assets/, .htaccess, PHP files
#    - Do NOT delete uploads/ or chat-data/

# 5. If edge functions changed, deploy to Supabase

# 6. Hard refresh browser and smoke-test key routes
```

---

## Related docs

- [`public/UPLOAD_PHP_SETUP.md`](public/UPLOAD_PHP_SETUP.md) — upload endpoint details
- [`public/SUPABASE_MIGRATION_GUIDE.md`](public/SUPABASE_MIGRATION_GUIDE.md) — database migrations
- [`PAYMENT_QA_CHECKLIST.md`](PAYMENT_QA_CHECKLIST.md) — payment gateway testing
