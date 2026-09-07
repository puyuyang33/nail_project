import "server-only";
import { Resend } from "resend";
import { env } from "./env";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(message: EmailMessage) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return {
      delivered: false as const,
      reason: "Email service is not configured",
    };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    ...message,
  });
  if (error) {
    throw new Error(`Resend delivery failed: ${error.message}`);
  }
  return { delivered: true as const, id: data?.id };
}

export function appointmentConfirmationEmail({
  name,
  reference,
  service,
  date,
  manageUrl,
}: {
  name: string;
  reference: string;
  service: string;
  date: string;
  manageUrl: string;
}) {
  return {
    subject: `Appointment ${reference} confirmed`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>Your Lunaria appointment</h1><p>Hello ${escapeHtml(name)},</p><p>Your ${escapeHtml(service)} appointment is reserved for ${escapeHtml(date)}.</p><p>Reference: <strong>${escapeHtml(reference)}</strong></p><p><a href="${escapeHtml(manageUrl)}">Manage your appointment securely</a></p><p>Please make changes at least 24 hours before your visit.</p></div>`,
  };
}

export function appointmentReminderEmail({
  name,
  reference,
  service,
  date,
  manageUrl,
}: {
  name: string;
  reference: string;
  service: string;
  date: string;
  manageUrl: string;
}) {
  return {
    subject: `Reminder: ${service} at Lunaria`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>Your appointment is tomorrow</h1><p>Hello ${escapeHtml(name)},</p><p>This is a reminder for ${escapeHtml(service)} on ${escapeHtml(date)}.</p><p>Reference: <strong>${escapeHtml(reference)}</strong></p><p><a href="${escapeHtml(manageUrl)}">Review your appointment</a></p></div>`,
  };
}

export function orderConfirmationEmail({
  name,
  orderNumber,
  total,
  currency,
}: {
  name: string;
  orderNumber: string;
  total: string;
  currency: string;
}) {
  return {
    subject: `Order ${orderNumber} received`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>Your order is in the atelier</h1><p>Hello ${escapeHtml(name)},</p><p>We received order <strong>${escapeHtml(orderNumber)}</strong> for ${escapeHtml(currency)} ${escapeHtml(total)}.</p><p>We will send tracking when your pieces leave the studio.</p></div>`,
  };
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
