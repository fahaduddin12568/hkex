// supabase/functions/send-reservation-email/index.ts
// Supabase Edge Function (Deno) — send a branded HTML reservation receipt via Resend.
//
// Deploy with:
//   supabase functions deploy send-reservation-email --no-verify-jwt
//
// Set secrets with:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//   supabase secrets set FROM_ADDRESS="HKEX WorkSpace <noreply@yourdomain.com>"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── CORS headers — allow your GitHub Pages origin ────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",   // tighten to your GH Pages URL in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_ADDRESS   = Deno.env.get("FROM_ADDRESS") || "HKEX WorkSpace <onboarding@resend.dev>";

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, string>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const {
    toEmail, toName,
    accId, suppli, accPx, qty, purVal,
    balance, reqFundingFmt, reservationTime,
  } = payload;

  if (!toEmail) {
    return new Response(JSON.stringify({ error: "toEmail is required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const year = new Date().getFullYear();
  const html = buildEmail({
    toName, accId, suppli, accPx, qty, purVal,
    balance, reqFundingFmt, reservationTime, year,
  });

  // ── Call Resend ─────────────────────────────────────────────────────────────
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    FROM_ADDRESS,
      to:      [toEmail],
      subject: `HKEX Account Reservation Confirmed – ${accId}`,
      html,
    }),
  });

  const json = await resendRes.json();

  if (!resendRes.ok) {
    console.error("Resend error:", json);
    return new Response(JSON.stringify({ error: json.message || "Resend error" }), {
      status: resendRes.status, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, id: json.id }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});

// ── HTML email builder ────────────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "—")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function row(label: string, value: string, i: number, color = "#0a1628", bold = false): string {
  const bg = i % 2 === 0 ? "#f8fafd" : "#ffffff";
  const fw = bold ? "700" : "500";
  return `<tr style="background:${bg};">
    <td style="padding:10px 16px;font-size:12px;color:#6b7a95;width:45%;border-bottom:1px solid #e8eef5;">${esc(label)}</td>
    <td style="padding:10px 16px;font-size:12px;color:${color};font-weight:${fw};font-family:'Courier New',monospace;border-bottom:1px solid #e8eef5;">${esc(value)}</td>
  </tr>`;
}

interface EmailData {
  toName: string; accId: string; suppli: string; accPx: string;
  qty: string; purVal: string; balance: string; reqFundingFmt: string;
  reservationTime: string; year: number;
}

function buildEmail(d: EmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reservation Confirmed — HKEX</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f9;padding:40px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <tr>
        <td style="background:#003465;border-radius:12px 12px 0 0;padding:28px 36px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.05em;">HKEX WorkSpace</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:3px;letter-spacing:0.1em;text-transform:uppercase;">Reservation Receipt</div>
            </td>
            <td align="right">
              <span style="background:#e72742;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:5px 14px;border-radius:20px;">&#10003; Confirmed</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="background:#e72742;height:3px;"></td></tr>

      <!-- ── Body ──────────────────────────────────────────────────────── -->
      <tr>
        <td style="background:#fff;padding:32px 36px;">
          <p style="margin:0 0 6px;font-size:15px;color:#0a1628;font-weight:600;">Dear ${esc(d.toName || "Client")},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7a95;line-height:1.6;">
            Your Bitcoin account reservation has been confirmed. Please find the full details below and retain this email for your records.
          </p>

          <!-- Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #d0dae8;">
            <tr style="background:#003465;">
              <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Account Details</td>
            </tr>
            ${row("Account ID",       d.accId,           0)}
            ${row("Supplier",         d.suppli,          1)}
            ${row("Account Price",    d.accPx,           2)}
            ${row("Quantity (BTC)",   d.qty,             3)}
            ${row("Purchase Value",   d.purVal,          4)}
            ${row("Current Balance",  "$" + d.balance,   5, "#1a6b1a")}
            ${row("Required Funding", d.reqFundingFmt,   6)}
            ${row("Status",           "Reserved",        7, "#1a6b1a", true)}
            ${row("Reservation Time", d.reservationTime, 8)}
          </table>

          <!-- PDF note -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              <td style="background:#f0f4f9;border:1px solid #d0dae8;border-radius:8px;padding:14px 16px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <div style="width:30px;height:30px;background:#003465;border-radius:6px;text-align:center;line-height:30px;color:#fff;font-size:15px;">&#128196;</div>
                  </td>
                  <td>
                    <div style="font-size:13px;font-weight:600;color:#003465;margin-bottom:2px;">PDF Receipt Downloaded</div>
                    <div style="font-size:12px;color:#6b7a95;line-height:1.5;">A PDF receipt was automatically downloaded to your device when you confirmed this reservation.</div>
                  </td>
                </tr></table>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:12px;color:#6b7a95;line-height:1.6;">
            For any questions regarding this reservation, please contact your dedicated broker. Do not reply to this email — it is sent from an unmonitored address.
          </p>
        </td>
      </tr>

      <!-- ── Footer ────────────────────────────────────────────────────── -->
      <tr>
        <td style="background:#003465;border-radius:0 0 12px 12px;padding:18px 36px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.6;">
            This is an automated message from HKEX WorkSpace. &copy; 2017–${d.year} Hong Kong Exchanges and Clearing Limited. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
