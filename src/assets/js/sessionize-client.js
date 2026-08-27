/**
 * Shared Sessionize HTML-fragment parsing helpers.
 *
 * Pure, platform-agnostic (no Node- or browser-only APIs), so the exact same
 * logic can run at Eleventy build time (_data/sessionize.js) and again in the
 * browser (components/tdc-speakers-refresh.js) to pick up speakers/sessions
 * added in Sessionize after the last deploy.
 */

export function decodeEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(value = "") {
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

export function normalizeTimestamp(value = "") {
  return value.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/, "$1$2");
}

// Sessionize All Data returns event times without an offset. TDC is in
// Europe/Oslo and the event is after the daylight-saving transition, so these
// values represent UTC+02 local event time rather than UTC.
export function normalizeApiTimestamp(value = "") {
  const normalized = normalizeTimestamp(value);
  return normalized && !/(Z|[+-]\d{2}:?\d{2})$/.test(normalized)
    ? `${normalized}+02:00`
    : normalized;
}

const invalidRoomNames = new Set(["fellesareal", "common area"]);

export function isInvalidRoomName(name = "") {
  return invalidRoomNames.has(name.trim().toLocaleLowerCase().replace(/\s+/g, " "));
}

export async function fetchHtml(url, label) {
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

export async function fetchJson(url, label) {
  try {
    console.log(`  Fetching ${label}...`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`  ⚠️  Sessionize returned ${response.status} for ${label}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`  ⚠️  Sessionize fetch failed for ${label}:`, error.message);
    return null;
  }
}

function apiValue(value, fallback = "") {
  return value === undefined || value === null ? fallback : value;
}

export function parseApiData(data) {
  const payload = Array.isArray(data) ? data[0] : data;
  if (!payload || !Array.isArray(payload.sessions) || !Array.isArray(payload.speakers)) return null;
  const categoryNames = new Map((payload.categories ?? []).flatMap((category) =>
    (category.items ?? []).map((item) => [item.id, item.name])
  ));

  const speakers = payload.speakers.map((speaker) => ({
    id: apiValue(speaker.id),
    domId: apiValue(speaker.id),
    className: "sz-speaker",
    firstName: apiValue(speaker.firstName, apiValue(speaker.name).split(/\s+/)[0]),
    lastName: apiValue(speaker.lastName, apiValue(speaker.name).split(/\s+/).slice(1).join(" ")),
    profilePicture: apiValue(speaker.profilePicture, apiValue(speaker.profilePictureUrl)),
    profilePictureAlt: apiValue(speaker.name),
    tagLine: apiValue(speaker.tagLine, apiValue(speaker.tagline)),
    bio: stripHtml(apiValue(speaker.bio)),
    twitter: apiValue(speaker.twitter),
    linkedIn: apiValue(speaker.linkedIn, apiValue(speaker.linkedin)),
    blog: apiValue(speaker.blog),
    isTopSpeaker: Boolean(speaker.isTopSpeaker),
    sessions: Array.isArray(speaker.sessions) ? speaker.sessions.map((session) => typeof session === "string" ? session : session.id).filter(Boolean) : [],
  }));

  const sessions = payload.sessions.map((session) => ({
    id: apiValue(session.id),
    domId: apiValue(session.id),
    className: "sz-session",
    title: stripHtml(apiValue(session.title)),
    description: stripHtml(apiValue(session.description)),
    startsAt: normalizeApiTimestamp(apiValue(session.startsAt, apiValue(session.start))),
    endsAt: normalizeApiTimestamp(apiValue(session.endsAt, apiValue(session.end))),
    roomId: apiValue(session.roomId, session.room?.id),
    roomName: stripHtml(apiValue(session.roomName, session.room?.name)),
    speakers: (session.speakers ?? session.speakerIds ?? []).map((speaker) => typeof speaker === "string" ? speaker : speaker.id).filter(Boolean),
    topics: (session.categoryItems ?? []).map((id) => categoryNames.get(id)).filter(Boolean),
    isService: Boolean(session.isService ?? session.isServiceSession),
    isPlenum: Boolean(session.isPlenum ?? session.isPlenumSession),
  })).filter((session) => session.id);

  const allRooms = (Array.isArray(payload.rooms) ? payload.rooms : buildRooms(sessions))
    .map((room) => ({ id: apiValue(room.id), name: stripHtml(apiValue(room.name, room.title)) }))
    .filter((room) => room.id);
  const invalidRoomIds = new Set(allRooms.filter((room) => isInvalidRoomName(room.name)).map((room) => room.id));
  const validSessions = sessions.filter((session) =>
    session.isService || (!invalidRoomIds.has(session.roomId) && !isInvalidRoomName(session.roomName))
  );
  const rooms = allRooms.filter((room) => !isInvalidRoomName(room.name));
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const roomIndex = new Map(rooms.map((room, index) => [room.id, index]));
  const sessionsByStart = new Map();
  for (const session of validSessions) {
    const row = sessionsByStart.get(session.startsAt) ?? [];
    row.push(session);
    sessionsByStart.set(session.startsAt, row);
  }
  const mergedSessions = validSessions.map((session) => {
    const room = roomIndex.get(session.roomId) ?? 0;
    const isFullWidth = session.isService || (sessionsByStart.get(session.startsAt) ?? []).length === 1;
    return {
      ...session,
      roomName: isInvalidRoomName(session.roomName) ? "" : roomNames.get(session.roomId) ?? session.roomName,
      roomStartId: session.roomId,
      roomEndId: session.roomId,
      roomStart: isFullWidth ? 0 : room,
      roomEnd: isFullWidth ? rooms.length - 1 : room,
      isFullWidth,
    };
  });
  const rows = [...new Set(mergedSessions.map((session) => session.startsAt))]
    .filter(Boolean)
    .sort()
    .map((startsAt) => ({ startsAt, sessions: mergedSessions.filter((session) => session.startsAt === startsAt) }));

  return {
    sessions: validSessions,
    speakers,
    schedule: {
      date: validSessions.find((session) => session.startsAt)?.startsAt ?? "",
      dateLabel: "",
      rooms,
      sessions: mergedSessions,
      rows,
      topics: [...new Set(mergedSessions.flatMap((session) => session.topics))].sort((a, b) => a.localeCompare(b)),
    },
  };
}

function getApiTopics(session) {
  const categories = session.categories ?? session.topics ?? session.tags ?? [];
  return (Array.isArray(categories) ? categories : [])
    .flatMap((category) => {
      if (typeof category === "string") return [category];
      const items = category?.categoryItems ?? category?.items;
      if (Array.isArray(items)) return items.map((item) => typeof item === "string" ? item : item?.title);
      return category?.title ? [category.title] : [];
    })
    .filter(Boolean)
    .filter((topic, index, all) => all.indexOf(topic) === index);
}

export function parseSessions(html) {
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

    const topics = [...body.matchAll(/<li\b[^>]*class="[^"]*sz-tag[^"]*"[^>]*data-categoryname="main_tag"[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((topicMatch) => stripHtml(topicMatch[1]))
      .filter(Boolean);
    sessions.push({
      id: sessionId || domId,
      domId,
      className,
      title: stripHtml(title),
      description: stripHtml(description),
      startsAt: normalizeTimestamp(timeMatch?.[1] ?? ""),
      endsAt: normalizeTimestamp(timeMatch?.[2] ?? ""),
      roomId: roomMatch?.[1] ?? "",
      roomName: stripHtml(roomMatch?.[2] ?? ""),
      speakers: speakerIds.map((speaker) => speaker.id),
      topics,
    });
  }

  return sessions;
}

export function parseGridSchedule(html) {
  const roomMatches = [...html.matchAll(/<span class="sz-cssgrid__track-label[^>]*>([\s\S]*?)<\/span>/gi)];
  const rooms = roomMatches.map((match) => {
    const roomId = match[0].match(/sz-room--([^"\s]+)/i)?.[1] ?? "";
    return { id: roomId, name: stripHtml(match[1]) };
  }).filter((room) => room.id && !isInvalidRoomName(room.name));
  const dayMatch = html.match(/<h1 class="sz-day__title"[^>]*data-sztz="[^|]*\|[^|]*\|([^|]+)\|[^|]+"[^>]*>([\s\S]*?)<\/h1>/i);
  const sessions = [];
  const openingTagPattern = /<div\b[^>]*data-sessionid="([^"]+)"[^>]*class="([^"]*sz-session[^\"]*)"[^>]*style="([^"]*)"[^>]*>/gi;
  const matches = [...html.matchAll(openingTagPattern)];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const [, id, className, style] = match;
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? html.length : html.length;
    const body = html.slice(start, end);
    const timeMatch = body.match(/data-sztz="[^|]*\|[^|]*\|([^|]+)\|([^"]+)"/i);
    const roomName = body.match(/data-roomid="([^"]+)" class="sz-session__room">([\s\S]*?)<\/div>/i);
    const trackIds = [...style.matchAll(/track-([^\s/-]+)-(?:start|end)/gi)].map((track) => track[1]);
    const title = body.match(/<h3 class="sz-session__title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i)?.[1] ?? "";
    const speakerIds = [...body.matchAll(/data-speakerid="([^"]+)"/gi)].map((speaker) => speaker[1]);

    sessions.push({
      id,
      className,
      title: stripHtml(title),
      startsAt: normalizeTimestamp(timeMatch?.[1] ?? ""),
      endsAt: normalizeTimestamp(timeMatch?.[2] ?? ""),
      roomId: roomName?.[1] ?? "",
      roomName: stripHtml(roomName?.[2] ?? ""),
      speakerIds,
      roomStartId: trackIds[0] ?? "",
      roomEndId: trackIds[trackIds.length - 1] ?? trackIds[0] ?? "",
      isService: /sz-session--service/i.test(className),
      isPlenum: /sz-session--plenum/i.test(className),
    });
  }

  const invalidRoomIds = new Set(roomMatches
    .map((match) => ({
      id: match[0].match(/sz-room--([^"\s]+)/i)?.[1] ?? "",
      name: stripHtml(match[1]),
    }))
    .filter((room) => isInvalidRoomName(room.name))
    .map((room) => room.id));

  return {
    date: normalizeTimestamp(dayMatch?.[1] ?? ""),
    dateLabel: stripHtml(dayMatch?.[2] ?? ""),
    rooms,
    sessions: sessions.filter((session) =>
      session.isService || (!invalidRoomIds.has(session.roomId) && !isInvalidRoomName(session.roomName))
    ),
  };
}

export function mergeScheduleData(schedule, sessions, options = {}) {
  const details = new Map(sessions.map((session) => [session.id, session]));
  const invalidRoomIds = new Set(schedule.rooms
    .filter((room) => isInvalidRoomName(room.name))
    .map((room) => room.id));
  const rooms = schedule.rooms
    .filter((room) => !isInvalidRoomName(room.name))
    .map((room) => ({ ...room }));
  const validScheduleSessions = schedule.sessions.filter((session) =>
    session.isService || (!invalidRoomIds.has(session.roomId) && !isInvalidRoomName(session.roomName))
  );
  const roomIndex = new Map(rooms.map((room, index) => [room.id, index]));
  const fullWidthSessionTitles = new Set(options.fullWidthSessionTitles ?? []);
  const topicsBySession = options.topicsBySession ?? new Map();
  const sessionsByStart = new Map();
  for (const session of validScheduleSessions) {
    const row = sessionsByStart.get(session.startsAt) ?? [];
    row.push(session);
    sessionsByStart.set(session.startsAt, row);
  }
  const mergedSessions = validScheduleSessions.map((session) => {
    const detail = details.get(session.id);
    const startIndex = roomIndex.get(session.roomStartId || session.roomId);
    const endIndex = roomIndex.get(session.roomEndId || session.roomId);
    const isOnlySessionInRow = (sessionsByStart.get(session.startsAt) ?? []).length === 1;
    const isFullWidth = session.isService || isOnlySessionInRow || fullWidthSessionTitles.has(session.title || detail?.title);
    return {
      ...session,
      description: detail?.description ?? "",
      speakers: detail?.speakers ?? session.speakerIds,
      topics: topicsBySession.get(session.id) ?? detail?.topics ?? [],
      roomName: isInvalidRoomName(session.roomName) ? "" : session.roomName || detail?.roomName || "",
      roomStart: isFullWidth ? 0 : (startIndex ?? 0),
      roomEnd: isFullWidth ? rooms.length - 1 : (endIndex ?? rooms.length - 1),
      isFullWidth,
    };
  });
  const rows = [...new Set(mergedSessions.map((session) => session.startsAt))]
    .filter(Boolean)
    .sort()
    .map((startsAt) => ({
      startsAt,
      sessions: mergedSessions.filter((session) => session.startsAt === startsAt),
    }));

  const topics = [...new Set(mergedSessions.flatMap((session) => session.topics))].sort((a, b) => a.localeCompare(b));

  return { ...schedule, rooms, sessions: mergedSessions, rows, topics };
}

export function parseSpeakers(html) {
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

/**
 * Returns a new array with Top Speakers moved to the front, each speaker
 * gaining an `isTopSpeaker` boolean. `topSpeakerIds` is the set of Sessionize
 * speaker IDs flagged "Top Speaker" in Sessionize (see _data/sessionize.js —
 * that flag only comes from Sessionize's private "All Data" API, not the
 * public embed HTML parsed above). Everyone else keeps their existing
 * relative order (Sessionize already returns speakers sorted alphabetically
 * by first name), since Array.prototype.sort is stable.
 */
export function sortSpeakers(speakers, topSpeakerIds = []) {
  const topIds = topSpeakerIds instanceof Set ? topSpeakerIds : new Set(topSpeakerIds);

  return speakers
    .map((speaker) => ({ ...speaker, isTopSpeaker: topIds.has(speaker.id) }))
    .sort((a, b) => Number(b.isTopSpeaker) - Number(a.isTopSpeaker));
}

export function buildRooms(sessions) {
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
