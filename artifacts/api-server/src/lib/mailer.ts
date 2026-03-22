import nodemailer from "nodemailer";
import { logger } from "./logger";

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const recipientEmail = process.env.ALERT_RECIPIENT_EMAIL ?? smtpUser;

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function createTransport() {
  if (!smtpUser || !smtpPass) {
    logger.warn("SMTP credentials not configured — email alerts disabled");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass },
  });
}

export interface AlertEmailPayload {
  symbol: string;
  name: string;
  targetPrice: number;
  direction: "above" | "below";
  currentPrice: number;
  triggeredAt: string;
}

export async function sendAlertEmail(alerts: AlertEmailPayload[]): Promise<void> {
  const transport = createTransport();
  if (!transport || !recipientEmail) return;

  const rows = alerts
    .map(
      (a) => `
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="padding:14px 16px;">
          <strong style="color:#f1f5f9;font-size:16px;">${a.symbol}</strong><br/>
          <span style="color:#94a3b8;font-size:13px;">${a.name}</span>
        </td>
        <td style="padding:14px 16px;text-align:center;">
          <span style="
            display:inline-block;
            padding:4px 10px;
            border-radius:9999px;
            font-size:12px;
            font-weight:600;
            background:${a.direction === "above" ? "#14532d" : "#450a0a"};
            color:${a.direction === "above" ? "#4ade80" : "#f87171"};
          ">
            ${a.direction === "above" ? "↑ Above" : "↓ Below"}
          </span>
        </td>
        <td style="padding:14px 16px;text-align:right;color:#cbd5e1;">${formatINR(a.targetPrice)}</td>
        <td style="padding:14px 16px;text-align:right;">
          <strong style="color:${a.direction === "above" ? "#4ade80" : "#f87171"};font-size:15px;">${formatINR(a.currentPrice)}</strong>
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🔔</div>
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Price Alert Triggered!</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">
                ${alerts.length === 1 ? "One of your" : `${alerts.length} of your`} price alert${alerts.length > 1 ? "s have" : " has"} been triggered
              </p>
            </td>
          </tr>

          <!-- Table -->
          <tr>
            <td style="background:#1e293b;padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="background:#0f172a;">
                    <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Asset</th>
                    <th style="padding:12px 16px;text-align:center;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Direction</th>
                    <th style="padding:12px 16px;text-align:right;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Target</th>
                    <th style="padding:12px 16px;text-align:right;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Current Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1e293b;border-radius:0 0 16px 16px;padding:24px;border-top:1px solid #334155;">
              <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
                Sent by your Portfolio Tracker app · ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
              </p>
              <p style="margin:8px 0 0;color:#64748b;font-size:12px;text-align:center;">
                This alert has been marked as triggered. Reset it in the app to receive future alerts.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject =
    alerts.length === 1
      ? `🔔 ${alerts[0].symbol} hit ${formatINR(alerts[0].currentPrice)} — Alert Triggered`
      : `🔔 ${alerts.length} Price Alerts Triggered`;

  try {
    await transport.sendMail({
      from: `"Portfolio Tracker" <${smtpUser}>`,
      to: recipientEmail,
      subject,
      html,
    });
    logger.info({ to: recipientEmail, count: alerts.length }, "Alert email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send alert email");
  }
}

export async function sendTestEmail(): Promise<void> {
  const transport = createTransport();
    throw new Error("SMTP not configured. Check SMTP_USER and SMTP_PASS in Render environment variables.");
  }
  await transport.sendMail({
    from: `"Portfolio Tracker" <${smtpUser}>`,
    to: recipientEmail,
    subject: "Portfolio Tracker - Test Email",
  });
}
