# HKEX WorkSpace

Bitcoin account brokerage dashboard — built with vanilla JS, styled with CSS custom properties, powered by **Supabase** (Postgres + Auth) and deployed on **Netlify**.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Hosting | Netlify (static) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + password) |
| Realtime presence | Supabase `presence` table + polling |
| Frontend | Vanilla HTML/CSS/JS |
| PDF receipts | jsPDF (CDN) |
| BTC price | Binance public REST API |

---

## One-time Setup

### 1. Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Note your **Project URL** and **anon (public) key** from  
   _Settings → API_
3. Open **SQL Editor → New Query**, paste the entire contents of  
   `supabase-schema.sql` and click **Run**
4. Go to **Authentication → Users → Invite user**  
   Create the admin account:  
   - Email: `admin@hkex.com`  
   - Password: `admin123`  
5. Copy the UUID from the new auth user, then run:
   ```sql
   insert into public.profiles (id, name, role, balance)
   values ('<paste-uuid-here>', 'Administrator', 'admin', 0);
   ```
6. _(Optional)_ In **Authentication → Settings**, disable **"Enable email confirmations"**  
   so new users created via the admin panel can log in immediately without confirming.

---

### 2. GitHub repository

```bash
git init
git add .
git commit -m "Initial commit — HKEX WorkSpace"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

---

### 3. Netlify deploy

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
2. Connect GitHub, select your repository
3. Build settings (Netlify auto-detects these from `netlify.toml`):
   - **Build command:** _(leave blank — static site)_
   - **Publish directory:** `.`
4. Click **Deploy site**

#### Environment Variables

In Netlify → **Site configuration → Environment variables** add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://your-ref.supabase.co` |
| `SUPABASE_ANON_KEY` | `your-anon-key` |

#### Snippet Injection (injects env vars into HTML at serve time)

Netlify → **Site configuration → Snippet injection → Before `</head>`**:

```html
<script>
  window.__SUPABASE_URL__      = 'YOUR_SUPABASE_URL';
  window.__SUPABASE_ANON_KEY__ = 'YOUR_SUPABASE_ANON_KEY';
</script>
```

> **Why snippet injection?** This is a plain static site with no build step.  
> Snippet injection is how Netlify injects runtime config into static HTML.  
> The anon key is safe to expose — it's protected by Supabase Row Level Security.

5. Click **Save** then **Trigger deploy → Deploy site**

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/<you>/<repo>.git
cd <repo>

# 2. Copy env example and fill in your Supabase values
cp .env.example .env

# 3. Edit index.html temporarily and hard-code your keys in the window.__SUPABASE_URL__ script block
#    (don't commit this — revert before pushing)

# 4. Serve with any static server, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

---

## Project Structure

```
.
├── index.html          # Main app (Buy Bitcoin page)
├── projects.html       # Projects page (placeholder)
├── staking.html        # OTC page (placeholder)
├── app.js              # All application logic (Supabase-backed)
├── supabase-config.js  # Supabase client initialisation
├── styles.css          # All styles
├── supabase-schema.sql # Run once in Supabase SQL editor
├── netlify.toml        # Netlify build + headers config
├── .env.example        # Document required env vars
├── .gitignore
└── README.md
```

---

## Architecture Notes

### Data model

```
auth.users (Supabase managed)
    │
    └── profiles          (id, name, role, balance)
         │
         ├── table_data   (user_id, data JSONB)   ← 25-row grid per user
         └── presence     (user_id, last_seen)     ← heartbeat for online status
```

### Row Level Security

All tables have RLS enabled:
- **Users** can read/write only their own rows
- **Admins** (role = `'admin'` in profiles) can read/write all rows

### User creation (admin panel)

New users are created with `supabase.auth.signUp()` from the browser.  
For a production deployment, move user creation to a **Netlify Function** using the  
Supabase **service_role** key (never expose that key to the browser).

---

## Deployment Checklist

- [ ] Supabase project created
- [ ] `supabase-schema.sql` executed
- [ ] Admin user created in Supabase Auth + profile row inserted
- [ ] GitHub repo created and code pushed
- [ ] Netlify site connected to GitHub repo
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` added to Netlify env vars
- [ ] Snippet injection configured in Netlify
- [ ] Site deployed and tested
- [ ] (Optional) Custom domain configured in Netlify → Domain management
