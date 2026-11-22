import type { Booking, BookingStatus, NotificationTemplateKey } from "./types";
import { formatPujaDate } from "../format";

/**
 * WhatsApp message templates. Placeholders use {{name}} syntax so the copy can
 * later move to the WhatsApp Business template registry (which uses {{1}},
 * {{2}}...) with a mechanical mapping.
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, { title: string; body: string }> = {
  booking_received: {
    title: "Booking received",
    body:
      "🙏 Namaste {{devoteeName}},\n\n" +
      "We have received your booking for *{{pujaName}}* at {{templeName}} on {{pujaDate}}.\n" +
      "Booking ID: *{{bookingId}}*\n\n" +
      "Our team will confirm it and assign a verified pandit shortly.\n— Aaradhya Setu",
  },
  booking_confirmed: {
    title: "Booking confirmed",
    body:
      "🪔 Namaste {{devoteeName}}, your *{{pujaName}}* is confirmed!\n\n" +
      "📍 {{templeName}}\n📅 {{pujaDate}}\n🧘 Pandit: {{panditName}}\n" +
      "Booking ID: *{{bookingId}}*\n\n" +
      "The sankalp will be taken in your family's name. We will message you when the puja begins.\n— Aaradhya Setu",
  },
  puja_started: {
    title: "Puja started",
    body:
      "🔔 {{devoteeName}}, your *{{pujaName}}* has begun at {{templeName}}.\n\n" +
      "{{panditName}} is now performing the rituals with your sankalp.\n" +
      "Booking ID: *{{bookingId}}*\n\n" +
      "Take a moment to join in prayer from wherever you are. 🙏\n— Aaradhya Setu",
  },
  puja_completed: {
    title: "Puja completed",
    body:
      "✨ {{devoteeName}}, your *{{pujaName}}* has been completed successfully.\n\n" +
      "🎥 Puja video: {{videoUrl}}\n" +
      "📦 Prasad will be dispatched to you shortly.\n" +
      "Booking ID: *{{bookingId}}*\n\n" +
      "May the divine blessings be with you and your family. 🙏\n— Aaradhya Setu",
  },
};

/** Which message (if any) a status change triggers. Rollbacks never message the devotee. */
export function templateForStatus(to: BookingStatus): NotificationTemplateKey {
  switch (to) {
    case "Pending":
      return "booking_received";
    case "Confirmed":
      return "booking_confirmed";
    case "In Progress":
      return "puja_started";
    case "Completed":
      return "puja_completed";
  }
}

export type TemplateVars = Record<string, string | number | undefined>;

/** Replaces {{key}} placeholders. Unknown or empty values fall back to a readable default instead of leaking "{{key}}". */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined || value === "") return FALLBACKS[key] ?? "";
    return String(value);
  });
}

const FALLBACKS: Record<string, string> = {
  devoteeName: "Devotee",
  panditName: "our verified pandit",
  videoUrl: "will be shared shortly",
};

export function templateVars(booking: Booking): TemplateVars {
  return {
    devoteeName: booking.devotee.name.split(" ")[0],
    pujaName: booking.puja.name,
    bookingId: booking.id,
    templeName: `${booking.temple.name}, ${booking.temple.city}`,
    pujaDate: formatPujaDate(booking.pujaDate),
    panditName: booking.pandit,
    videoUrl: booking.videoUrl,
  };
}

export function renderNotification(key: NotificationTemplateKey, booking: Booking): string {
  return renderTemplate(NOTIFICATION_TEMPLATES[key].body, templateVars(booking));
}
