/**
 * Sessionize integration for the new Eleventy site.
 *
 * Sessionize serves the real program/speaker data as HTML fragments behind its
 * embed endpoints. We fetch those fragments at build time, parse out the pieces
 * we need, and expose structured data to the templates.
 *
 * The parsing logic lives in assets/js/sessionize-client.js so it can be
 * reused client-side (see components/tdc-speakers-refresh.js), which re-fetches
 * the same endpoints in the browser to pick up speakers added after the last
 * deploy without waiting for a rebuild.
 */
import { fetchHtml, parseSessions, parseSpeakers, buildRooms } from "../assets/js/sessionize-client.js";

const eventId = "xx320rm2";

const sessionsUrl = `https://sessionize.com/api/v2/${eventId}/view/Sessions?under=True`;
const speakersUrl = `https://sessionize.com/api/v2/${eventId}/view/Speakers?under=True`;

export default async function () {
  console.log("🎤 Fetching Sessionize data from HTML fragments...");

  const [sessionsHtml, speakersHtml] = await Promise.all([
    fetchHtml(sessionsUrl, "Sessionize sessions"),
    fetchHtml(speakersUrl, "Sessionize speakers"),
  ]);

  const sessions = parseSessions(sessionsHtml);
  const speakers = parseSpeakers(speakersHtml);
  const rooms = buildRooms(sessions);

  return {
    eventId,
    sessions,
    speakers,
    rooms,
    timeSlots: [],
  };
}
