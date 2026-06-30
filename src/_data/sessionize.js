/**
 * Sessionize integration for the new Eleventy site.
 *
 * Sessionize serves the real program/speaker data as HTML fragments behind its
 * embed endpoints. We fetch those fragments at build time, parse out the pieces
 * we need, and expose structured data to the templates.
 *
 * For local layout work, set USE_MOCK_SESSIONIZE=true.
 */

import mockData from "./sessionize-mock.js";

const eventId = "xx320rm2";
const useMock = process.env.USE_MOCK_SESSIONIZE === "true";

const sessionsUrl = `https://sessionize.com/api/v2/${eventId}/view/Sessions?under=True`;
const speakersUrl = `https://sessionize.com/api/v2/${eventId}/view/Speakers?under=True`;

function decodeEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

async function fetchHtml(url, label) {
  try {
    console.log(`  Fetching ${label}...`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`  ⚠️  Sessionize returned ${response.status} for ${label}`);
      return "";
    }
    return await response.text();
  } catch (error) {
    console.warn(`  ⚠️  Sessionize fetch failed for ${label}:`, error.message);
    return "";
  }
}

function parseSessions(html) {
  const sessions = [];
  const openingTagPattern = /<li\b[^>]*id="sz-session-([^"]+)"[^>]*data-sessionid="([^"]+)"[^>]*class="([^"]*sz-session[^"]*)"[^>]*>/gi;
  const matches = [...html.matchAll(openingTagPattern)];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const [, domId, sessionId, className] = match;
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? html.length : html.length;
    const body = html.slice(start, end);

    const title = body.match(/<h3 class="sz-session__title">([\s\S]*?)<\/h3>/i)?.[1] ?? "";
    const description = body.match(/<p class="sz-session__description">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const roomMatch = body.match(/data-roomid="([^"]+)" class="sz-session__room">([\s\S]*?)<\/div>/i);
    const timeMatch = body.match(/data-sztz="[^"]*\|[^"]*\|([^|]+)\|([^"]+)"/i);
    const speakerIds = [...body.matchAll(/<li[^>]*data-speakerid="([^"]+)"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)].map(
      (speakerMatch) => ({
        id: speakerMatch[1],
        name: stripHtml(speakerMatch[2]),
      })
    );

    sessions.push({
      id: sessionId || domId,
      domId,
      className,
      title: stripHtml(title),
      description: stripHtml(description),
      startsAt: timeMatch?.[1] ?? "",
      endsAt: timeMatch?.[2] ?? "",
      roomId: roomMatch?.[1] ?? "",
      roomName: stripHtml(roomMatch?.[2] ?? ""),
      speakers: speakerIds.map((speaker) => speaker.id),
    });
  }

  return sessions;
}

function parseSpeakers(html) {
  const speakers = [];
  const openingTagPattern = /<li\b[^>]*id="sz-speaker-([^"]+)"[^>]*data-speakerid="([^"]+)"[^>]*class="([^"]*sz-speaker[^"]*)"[^>]*>/gi;
  const matches = [...html.matchAll(openingTagPattern)];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const [, domId, speakerId, className] = match;
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? html.length : html.length;
    const body = html.slice(start, end);

    const photo = body.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/i);
    const name = body.match(/<h3 class="sz-speaker__name">([\s\S]*?)<\/h3>/i)?.[1] ?? "";
    const tagline = body.match(/<h4 class="sz-speaker__tagline">([\s\S]*?)<\/h4>/i)?.[1] ?? "";
    const bio = body.match(/<p class="sz-speaker__bio">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const sessionIds = [...body.matchAll(/<li[^>]*data-sessionid="([^"]+)"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)].map(
      (sessionMatch) => sessionMatch[1]
    );

    const [firstName, ...rest] = stripHtml(name).split(/\s+/);
    const lastName = rest.join(" ");

    speakers.push({
      id: speakerId || domId,
      domId,
      className,
      firstName: firstName || stripHtml(name),
      lastName,
      profilePicture: photo?.[1] ?? "",
      profilePictureAlt: photo?.[2] ?? stripHtml(name),
      tagLine: stripHtml(tagline),
      bio: stripHtml(bio),
      twitter: "",
      linkedIn: "",
      blog: "",
      sessions: sessionIds,
    });
  }

  return speakers;
}

function buildRooms(sessions) {
  const rooms = new Map();
  for (const session of sessions) {
    if (!session.roomId) continue;
    if (!rooms.has(session.roomId)) {
      rooms.set(session.roomId, {
        id: session.roomId,
        name: session.roomName || session.roomId,
      });
    }
  }
  return [...rooms.values()];
}

export default async function () {
  if (useMock) {
    console.log("🎭 Using MOCK Sessionize data (set USE_MOCK_SESSIONIZE=false to fetch real data)");
    return mockData;
  }

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
