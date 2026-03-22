import { logger } from "./logger";

const resendApiKey = process.env.RESEND_API_KEY;
const recipientEmail = process.env.ALERT_RECIPIENT_EMAIL;

export interface AlertEmailPayload {
  symbol: string;
  name: string;
  targetPrice: number;
  direction: "above" | "below";
  currentPrice: number;
  triggeredAt: string;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

async function sendEmail(subject: string, html: string): Promise<void> {
  if (!resendApiKey || !recipientEmail) {
    throw new Error("RESEND_API_KEY or ALERT_RECIPIENT_EMAIL not set in environment variables.");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Portfolio Tracker <onboarding@resend.dev>", to: [recipientEmail], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${err}`);
  }
}

export async function sendTestEmail(): Promise<void> {
  await sendEmail("Portfolio Tracker - Test Email", "<p>Hi! Test email from your Portfolio Tracker. Email is working!</p>");
  logger.info("Test email sent via Resend");
}

export async function sendAlertEmail(alerts: AlertEmailPayload[]): Promise<void> {
  const rows = alerts.map((a) => `
    <tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:14px 16px;"><strong style="color:#f1f5f9;">${a.symbol}</strong><br/><span style="color:#94a3b8;font-size:13px;">${a.name}</span></td>
      <td style="padding:14px 16px;text-align:center;"><span style="padding:4px 10px;border-radius:9999px;font-size:12px;font-weight:600;background:${a.direction === "above" ? "#14532d" : "#450a0a"};color:${a.direction === "above" ? "#4ade80" : "#f87171"};">${a.direction === "above" ? "Above" : "Below"}</span></td>
      <td style="padding:14px 16px;text-align:right;color:#cbd5e1;">${formatINR(a.targetPrice)}</td>
      <td style="padding:14px 16px;text-align:right;"><strong style="color:${a.direction === "above" ? "#4ade80" : "#f87171"};">${formatINR(a.currentPrice)}</strong></td>
    </tr>`).join("");

  const html = `<body style="background:#0f172a;font-family:sans-serif;padding:32px;">
    <h1 style="color:#fff;">Price Alert Triggered</h1>
    <table width="100%" style="background:#1e293b;border-radius:8px;">
      <thead><tr style="background:#0f172a;">
        <th style="padding:12px;text-align:left;color:#64748b;">Asset</th>
        <th style="padding:12px;color:#64748b;">Direction</th>
        <th style="padding:12px;text-align:right;color:#64748b;">Target</th>
        <th style="padding:12px;text-align:right;color:#64748b;">Current</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>`;

  const subject = alerts.length === 1
    ? `Alert: ${alerts[0].symbol} hit ${formatINR(alerts[0].currentPrice)}`
    : `${alerts.length} Price Alerts Triggered`;

  await sendEmail(subject, html);
  logger.info({ to: recipientEmail, count: alerts.length }, "Alert email sent via Resend");
}
