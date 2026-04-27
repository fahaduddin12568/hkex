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


