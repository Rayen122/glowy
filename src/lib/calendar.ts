/**
 * « Ajouter au calendrier » : fichier .ics (iCalendar, RFC 5545) que téléphones et agendas
 * (Google, Apple, Outlook) savent importer. Généré dans le navigateur, rien n'est envoyé au serveur.
 */
type CalendarEvent = { title: string; start: Date; end: Date; location?: string; description?: string };

/** Date UTC au format iCalendar : 20261109T130000Z */
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Échappement des virgules, points-virgules, antislashs et retours à la ligne */
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lignes de 75 octets au plus (RFC 5545 §3.1) : la suite repart à la ligne après une espace, sans couper un caractère */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length ? 74 : 75;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function icsEvent(event: CalendarEvent, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Glowy//Reservation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsDate(event.start)}-${Math.random().toString(36).slice(2, 10)}@glowy`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${icsText(event.title)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n");
}

/** Télécharge l'événement : le téléphone propose aussitôt de l'ajouter à l'agenda */
export function downloadIcs(filename: string, event: CalendarEvent) {
  const url = URL.createObjectURL(new Blob([icsEvent(event)], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
