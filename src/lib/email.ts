import "server-only";
import { Resend } from "resend";
import { env } from "./env";

export type EmailMessage = {
  to: string | string[];
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

export function appointmentRequestEmail({
  name,
  reference,
  service,
  date,
  worker,
  manageUrl,
}: {
  name: string;
  reference: string;
  service: string;
  date: string;
  worker: string;
  manageUrl: string;
}) {
  return {
    subject: `Appointment request ${reference} received`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>We received your request</h1><p>Hello ${escapeHtml(name)},</p><p>Your request for ${escapeHtml(service)} with ${escapeHtml(worker)} on ${escapeHtml(date)} is awaiting studio approval.</p><p>Reference: <strong>${escapeHtml(reference)}</strong></p><p><a href="${escapeHtml(manageUrl)}">Review or cancel your request</a></p><p>The time remains open until the studio accepts the appointment. We will email you when a decision is made.</p></div>`,
  };
}

export function adminAppointmentRequestEmail({
  reference,
  customer,
  service,
  date,
  worker,
  contact,
  adminUrl,
}: {
  reference: string;
  customer: string;
  service: string;
  date: string;
  worker: string;
  contact: string;
  adminUrl: string;
}) {
  return {
    subject: `New appointment request ${reference}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>New appointment request</h1><p><strong>${escapeHtml(customer)}</strong> requested ${escapeHtml(service)} with ${escapeHtml(worker)} on ${escapeHtml(date)}.</p><p>Contact: ${escapeHtml(contact)}</p><p><a href="${escapeHtml(adminUrl)}">Open the team calendar to accept, reassign, or decline</a></p></div>`,
  };
}

export function appointmentDecisionEmail({
  name,
  reference,
  service,
  date,
  worker,
  accepted,
  manageUrl,
  paymentUrl,
  calendarUrl,
}: {
  name: string;
  reference: string;
  service: string;
  date: string;
  worker: string;
  accepted: boolean;
  manageUrl?: string;
  paymentUrl?: string;
  calendarUrl?: string;
}) {
  if (!accepted) {
    return {
      subject: `Appointment request ${reference} was not accepted`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>Appointment request update</h1><p>Hello ${escapeHtml(name)},</p><p>We could not accept request <strong>${escapeHtml(reference)}</strong>. No payment was taken. Please choose another worker or time.</p></div>`,
    };
  }
  const action = paymentUrl
    ? `<p><a href="${escapeHtml(paymentUrl)}">Pay the appointment deposit to confirm</a></p>`
    : manageUrl
      ? `<p><a href="${escapeHtml(manageUrl)}">Manage your confirmed appointment</a></p>`
      : "";
  const calendarAction =
    accepted && calendarUrl
      ? `<p><a href="${escapeHtml(calendarUrl)}">Add to Google Calendar</a></p>`
      : "";
  return {
    subject: paymentUrl
      ? `Appointment ${reference}: deposit required`
      : `Appointment ${reference} accepted`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>${paymentUrl ? "Your time is held" : "Your appointment is confirmed"}</h1><p>Hello ${escapeHtml(name)},</p><p>${escapeHtml(service)} with ${escapeHtml(worker)} is scheduled for ${escapeHtml(date)}.</p>${action}${calendarAction}</div>`,
  };
}

export function workerAppointmentEmail({
  reference,
  service,
  date,
  customer,
  adminUrl,
  calendarUrl,
  tentative = false,
}: {
  reference: string;
  service: string;
  date: string;
  customer: string;
  adminUrl: string;
  calendarUrl?: string;
  tentative?: boolean;
}) {
  return {
    subject: `${tentative ? "Tentative hold" : "Appointment assigned"}: ${date}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>${tentative ? "Tentative calendar hold" : "New calendar assignment"}</h1><p>${escapeHtml(service)} for ${escapeHtml(customer)} is assigned to you${tentative ? " and is awaiting the customer's deposit" : ""}.</p><p>${escapeHtml(date)} · ${escapeHtml(reference)}</p><p><a href="${escapeHtml(adminUrl)}">Open the team calendar</a></p>${calendarUrl ? `<p><a href="${escapeHtml(calendarUrl)}">Add to Google Calendar</a></p>` : ""}</div>`,
  };
}

export function appointmentCanceledEmail({
  name,
  reference,
  date,
  reason,
}: {
  name: string;
  reference: string;
  date: string;
  reason: string;
}) {
  return {
    subject: `Appointment ${reference} canceled`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>Your appointment was canceled</h1><p>Hello ${escapeHtml(name)},</p><p>The appointment scheduled for ${escapeHtml(date)} was canceled.</p><p>${escapeHtml(reason)}</p><p>No new payment will be taken. Contact the studio if you need help choosing another time.</p></div>`,
  };
}

export function appointmentNotificationRecipients() {
  return [
    ...new Set(
      [env.APPOINTMENT_NOTIFICATION_EMAILS, env.AUTH_GOOGLE_ADMIN_EMAILS]
        .flatMap((value) => value.split(","))
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function googleCalendarEventUrl({
  title,
  startsAt,
  endsAt,
  details,
  location,
}: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  details: string;
  location: string;
}) {
  const parameters = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleCalendarDate(startsAt)}/${googleCalendarDate(endsAt)}`,
    details,
    location,
  });
  return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
}

function googleCalendarDate(value: Date) {
  return value
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
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
