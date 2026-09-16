/**
 * Build-time .ics generation for individual program sessions.
 *
 * Shares assets/js/calendar.js with the browser, so a session's static file and
 * the client-side "saved talks" export are written by the same code and stay
 * consistent — the same trick assets/js/sessionize-client.js already uses.
 *
 * One file per session, not per language: the talks themselves are not
 * translated, so a Norwegian and an English .ics would hold identical content.
 */
import { buildCalendar, SHARED_LOCATION, sessionDescription } from "../assets/js/calendar.js";

export function sessionEvent(session, { speakers, url }) {
  const names = (session.speakers ?? [])
    .map((id) => speakers.find((speaker) => speaker.id === id))
    .filter(Boolean)
    .map((speaker) => `${speaker.firstName} ${speaker.lastName}`);

  return {
    uid: `${session.id}@trondheimdc.no`,
    title: session.title,
    start: session.startsAt,
    end: session.endsAt,
    location: session.roomName || SHARED_LOCATION,
    url,
    description: sessionDescription({ speakers: names, description: session.description, url }),
  };
}

export default {
  data: {
    pagination: { data: "sessionize.schedule.sessions", size: 1, alias: "session" },
    permalink: (data) => `/program/${data.session.id}.ics`,
    eleventyExcludeFromCollections: true,
  },
  render(data) {
    return buildCalendar([
      sessionEvent(data.session, {
        speakers: data.sessionize.speakers,
        url: `${data.site.url}/#program`,
      }),
    ]);
  },
};
