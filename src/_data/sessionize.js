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
 *
 * The embed endpoints above don't expose Sessionize's "Top Speaker" flag —
 * that only comes from Sessionize's private "All Data" API (Event -> API in
 * the Sessionize dashboard), which returns real JSON (not an HTML fragment)
 * behind its own event-specific, secret URL. That URL is a credential, not
 * public config, so it's read from an env var (SESSIONIZE_API_URL) rather
 * than committed here — set it in a local .env for `bun run dev/build`, and
 * as a repo/environment secret for CI (see .github/workflows/{cd,pr}.yml).
 * If it's unset or the fetch fails, we just fall back to no top speakers.
 */
import { fetchHtml, parseSessions, parseSpeakers, buildRooms, sortSpeakers } from "../assets/js/sessionize-client.js";

const eventId = "xx320rm2";

const sessionsUrl = `https://sessionize.com/api/v2/${eventId}/view/Sessions?under=True`;
const speakersUrl = `https://sessionize.com/api/v2/${eventId}/view/Speakers?under=True`;

async function fetchTopSpeakerIds() {
  const apiUrl = process.env.SESSIONIZE_API_URL;
  if (!apiUrl) {
    console.log("  ℹ️  SESSIONIZE_API_URL not set — skipping Top Speaker lookup.");
    return [];
  }

  try {
    console.log("  Fetching Sessionize all-data API (top speakers)...");
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.warn(`  ⚠️  Sessionize API returned ${response.status} for all-data lookup`);
      return [];
    }

    const data = await response.json();
    const speakers = Array.isArray(data) ? data[0]?.speakers : data.speakers;
    if (!Array.isArray(speakers)) {
      console.warn("  ⚠️  Sessionize API response didn't include a speakers array");
      return [];
    }

    return speakers.filter((speaker) => speaker.isTopSpeaker).map((speaker) => speaker.id);
  } catch (error) {
    console.warn("  ⚠️  Sessionize API fetch failed for top speakers:", error.message);
    return [];
  }
}

export default async function () {
  console.log("🎤 Fetching Sessionize data from HTML fragments...");

  const [sessionsHtml, speakersHtml, topSpeakerIds] = await Promise.all([
    fetchHtml(sessionsUrl, "Sessionize sessions"),
    fetchHtml(speakersUrl, "Sessionize speakers"),
    fetchTopSpeakerIds(),
  ]);

  const sessions = parseSessions(sessionsHtml);
  const speakers = sortSpeakers(parseSpeakers(speakersHtml), topSpeakerIds);
  const rooms = buildRooms(sessions);

  return {
    eventId,
    sessions,
    speakers,
    rooms,
    topSpeakerIds,
    timeSlots: [],
  };
}
