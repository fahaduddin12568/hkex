# Supabase Edge Function — send-reservation-email

This function sends a branded HTML reservation receipt via Resend.
It runs on Supabase's infrastructure so the Resend API key is never
exposed in the browser, and works with any static host (GitHub Pages,
Cloudflare Pages, etc.) — no Netlify required.

---

## One-time setup

### 1. Install the Supabase CLI

```bash
npm install -g supabase
```

### 2. Log in and link your project

```bash
supabase login
supabase link --project-ref pwrrfsgnkxronosyyirn
```

### 3. Set secrets (Resend API key + sender address)

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
supabase secrets set FROM_ADDRESS="HKEX WorkSpace <noreply@yourdomain.com>"
```

> While testing you can use `onboarding@resend.dev` as FROM_ADDRESS
> but it will only deliver to your own Resend-verified email.
> For production, verify your domain at https://resend.com/domains

### 4. Deploy the function

```bash
supabase functions deploy send-reservation-email --no-verify-jwt
```

The `--no-verify-jwt` flag is safe here because the function only sends
email — it doesn't read or write any database data.
The browser still passes the user's JWT in the Authorization header
(see app.js) so you can add verification later if needed.

---

## Testing

You can test the deployed function directly with curl:

```bash
curl -X POST \
  https://pwrrfsgnkxronosyyirn.supabase.co/functions/v1/send-reservation-email \
  -H "Content-Type: application/json" \
  -d '{
    "toEmail": "you@example.com",
    "toName": "Test User",
    "accId": "ID42EX12345",
    "suppli": "HKEX",
    "accPx": "$284,750",
    "qty": "8.76536",
    "purVal": "$620,000",
    "balance": "300,000",
    "reqFundingFmt": "$0",
    "reservationTime": "27 April 2026 at 14:30"
  }'
```

Expected response: `{"success":true,"id":"<resend-message-id>"}`

---

## How it fits together

```
Browser (GitHub Pages)
  │
  ├─ confirms reservation → writes to Supabase DB (direct JS SDK)
  ├─ generates PDF        → jsPDF, downloads locally
  └─ POST /functions/v1/send-reservation-email
        │
        └─ Supabase Edge Function (Deno)
              └─ POST api.resend.com/emails  →  User's inbox
```

No Netlify. No separate backend. No secrets in the browser.
