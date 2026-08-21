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
import {
  fetchHtml,
  parseSessions,
  parseSpeakers,
  parseGridSchedule,
  mergeScheduleData,
  sortSpeakers,
} from "../assets/js/sessionize-client.js";

const eventId = "xx320rm2";

const sessionsUrl = `https://sessionize.com/api/v2/${eventId}/view/Sessions?under=True`;
const speakersUrl = `https://sessionize.com/api/v2/${eventId}/view/Speakers?under=True`;
const gridUrl = `https://sessionize.com/api/v2/${eventId}/view/GridSmart?under=True`;

function getSessionTopics(session) {
  const categories = session.categories ?? session.topics ?? session.tags ?? [];
  const values = Array.isArray(categories) ? categories : [];

  return values.flatMap((category) => {
    if (typeof category === "string") return [category];
    if (!category || typeof category !== "object") return [];

    const items = category.categoryItems ?? category.items;
    if (Array.isArray(items)) {
      return items.map((item) => typeof item === "string" ? item : item?.title).filter(Boolean);
    }

    return category.title ? [category.title] : [];
  });
}

async function fetchSessionMetadata() {
  const apiUrl = process.env.SESSIONIZE_API_URL;
  if (!apiUrl) {
    console.log("  ℹ️  SESSIONIZE_API_URL not set — skipping session metadata lookup.");
    return { topSpeakerIds: [], topicsBySession: new Map() };
  }

  try {
    console.log("  Fetching Sessionize all-data API (speakers and topics)...");
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.warn(`  ⚠️  Sessionize API returned ${response.status} for all-data lookup`);
      return { topSpeakerIds: [], topicsBySession: new Map() };
    }

    const data = await response.json();
    const payload = Array.isArray(data) ? data[0] : data;
    const speakers = payload?.speakers;
    if (!Array.isArray(speakers)) {
      console.warn("  ⚠️  Sessionize API response didn't include a speakers array");
    }

    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    const topicsBySession = new Map(
      sessions
        .map((session) => [session.id, getSessionTopics(session).filter((topic, index, all) => all.indexOf(topic) === index)])
        .filter(([id, topics]) => id && topics.length)
    );

    return {
      topSpeakerIds: speakers.filter((speaker) => speaker.isTopSpeaker).map((speaker) => speaker.id),
      topicsBySession,
    };
  } catch (error) {
    console.warn("  ⚠️  Sessionize API fetch failed for session metadata:", error.message);
    return { topSpeakerIds: [], topicsBySession: new Map() };
  }
}

export default async function () {
  console.log("🎤 Fetching Sessionize data from HTML fragments...");

  const [sessionsHtml, speakersHtml, gridHtml, sessionMetadata] = await Promise.all([
    fetchHtml(sessionsUrl, "Sessionize sessions"),
    fetchHtml(speakersUrl, "Sessionize speakers"),
    fetchHtml(gridUrl, "Sessionize program grid"),
    fetchSessionMetadata(),
  ]);

  const sessions = parseSessions(sessionsHtml);
  const speakers = sortSpeakers(parseSpeakers(speakersHtml), sessionMetadata.topSpeakerIds);
  const schedule = mergeScheduleData(parseGridSchedule(gridHtml), sessions, {
    topicsBySession: sessionMetadata.topicsBySession,
  });

  if (!schedule.sessions.length) {
    throw new Error("Sessionize program grid returned no sessions; refusing to build an empty program.");
  }

  return {
    eventId,
    sessions,
    speakers,
    rooms: schedule.rooms,
    schedule,
    topSpeakerIds: sessionMetadata.topSpeakerIds,
  };
}
