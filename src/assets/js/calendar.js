/**
 * Minimal iCalendar (RFC 5545) writer for the program's "add to calendar"
 * buttons.
 *
 * Sessionize already hands us absolute timestamps with a UTC offset, so every
 * event is written as a UTC instant (…Z) and the file needs no VTIMEZONE block.
 */

const PRODUCT_ID = "-//Trondheim Developer Conference//TDC website//EN";
const encoder = new TextEncoder();

// Calendar entries are written in English regardless of the page language:
// Sessionize gives us talk titles and abstracts in whatever language the
// speaker submitted, so translating the handful of labels around them would
// only make the file inconsistent with its own contents.
export const SHARED_LOCATION = "Shared area";

export function sessionDescription({ speakers = [], description = "", url = "" }) {
  const credit = speakers.length ? `${speakers.length > 1 ? "Speakers" : "Speaker"}: ${speakers.join(", ")}` : "";
  return [credit, description, url].filter(Boolean).join("\n\n");
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/[;,]/g, (match) => `\\${match}`)
    .replace(/\r?\n/g, "\\n");
}

function toUtcStamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Content lines cap at 75 octets; continuations start with a space, which
// counts towards the limit — so only 74 octets of content fit on those. Split
// on whole units (an escaped "\," stays together) so no parser sees half
// of one, and iterate code points so surrogate pairs survive too.
function foldLine(line) {
  const units = [...line].reduce((all, char) => {
    if (all.at(-1) === "\\") all[all.length - 1] += char;
    else all.push(char);
    return all;
  }, []);

  const parts = [];
  let current = "";
  let bytes = 0;

  for (const unit of units) {
    const size = encoder.encode(unit).length;
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += unit;
    bytes += size;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

/**
 * Build a VCALENDAR from { uid, title, start, end, description, location, url }
 * events. Events without a usable start/end are skipped.
 */
export function buildCalendar(events, { name } = {}) {
  const stamp = toUtcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (name) lines.push(`X-WR-CALNAME:${escapeText(name)}`);

  for (const event of events) {
    const start = toUtcStamp(event.start);
    const end = toUtcStamp(event.end);
    if (!start || !end) continue;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(event.title)}`
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.url) lines.push(`URL:${escapeText(event.url)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

// Provider deep links open the event prefilled in a web calendar, so the
// attendee saves it in one click instead of handling a file. Their query
// strings live in a URL, so keep the description within a sane length.
const DEEP_LINK_DESCRIPTION_LIMIT = 1800;

function deepLinkDescription(description = "") {
  return description.length > DEEP_LINK_DESCRIPTION_LIMIT
    ? `${description.slice(0, DEEP_LINK_DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : description;
}

export function googleCalendarUrl(event) {
  const start = toUtcStamp(event.start);
  const end = toUtcStamp(event.end);
  if (!start || !end) return "";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title ?? "",
    dates: `${start}/${end}`,
    details: deepLinkDescription(event.description),
    location: event.location ?? "",
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}

// Work/school accounts (Microsoft 365) live on outlook.office.com and personal
// ones on outlook.live.com; the deep link is otherwise identical. A conference
// audience is overwhelmingly on the former, so that is the default — personal
// accounts are better served by the .ics anyway.
export function outlookCalendarUrl(event, { personal = false } = {}) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title ?? "",
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: deepLinkDescription(event.description),
    location: event.location ?? "",
  });

  return `https://outlook.${personal ? "live" : "office"}.com/calendar/0/deeplink/compose?${params}`;
}

export function calendarFilename(value) {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

  return `${slug || "tdc-2026"}.ics`;
}

export function downloadCalendar(filename, calendar) {
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke late so slower browsers have started the download by then.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
