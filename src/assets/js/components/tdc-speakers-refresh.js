// Client-side speaker refresh — re-fetches Sessionize directly from the
// browser (its embed endpoints send `Access-Control-Allow-Origin: *`) and
// rebuilds the speaker grid if the call succeeds. This means a speaker added
// in Sessionize after the last deploy still shows up for visitors without
// anyone needing to trigger a rebuild.
//
// Scope: this only refreshes on top of an already-rendered static grid (the
// common case — some speakers already exist at build time). If the static
// build has zero speakers, it leaves the placeholder copy alone rather than
// building a grid from scratch client-side.
//
// Shares its HTML-parsing logic with _data/sessionize.js (the build-time
// fetch) via sessionize-client.js so both stay in sync.

import { fetchHtml, parseGridSchedule, parseSessions, parseSpeakers, sortSpeakers, mergeScheduleData } from "../sessionize-client.js";

const timeFormatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false,
});

function eventTime(value) {
  return value ? timeFormatter.format(new Date(value)) : "";
}

function buildProgramSession(session, speakers, schedule) {
  const article = document.createElement("article");
  article.className = "program-session";
  if (session.isService) article.classList.add("program-session--service");
  if (session.isPlenum) article.classList.add("program-session--plenum");
  if (session.isLongService) article.classList.add("program-session--long-service-in-row");
  if (!session.isService) article.classList.add("program-session--favoritable");
  article.style.setProperty("--program-room-start", String(session.roomStart + 1));
  article.style.setProperty("--program-room-end", String(session.roomEnd + 2));
  article.dataset.programSession = "";
  article.dataset.sessionId = session.id;
  article.dataset.sessionTitle = session.title;
  article.dataset.sessionDescription = session.description;
  article.dataset.sessionStart = eventTime(session.startsAt);
  article.dataset.sessionEnd = eventTime(session.endsAt);
  article.dataset.sessionRoom = session.roomName;
  article.dataset.sessionService = String(Boolean(session.isService));
  article.dataset.sessionTopics = session.topics.join("|");

  const meta = document.createElement("div");
  meta.className = "program-session__meta";
  meta.innerHTML = `<span class="program-session__room"></span><span class="program-session__duration"></span>`;
  meta.querySelector(".program-session__room").textContent = session.roomName || schedule.root.dataset.sharedSessionLabel;
  meta.querySelector(".program-session__duration").textContent = `${eventTime(session.startsAt)}–${eventTime(session.endsAt)}`;
  article.appendChild(meta);

  const heading = document.createElement("div");
  heading.className = "program-session__heading";
  const title = document.createElement("button");
  title.type = "button";
  title.className = "program-session__title";
  title.dataset.sessionOpen = "";
  title.textContent = session.title;
  heading.appendChild(title);
  if (!session.isService) {
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "program-session__favorite";
    favorite.dataset.sessionFavorite = "";
    favorite.textContent = "☆";
    favorite.setAttribute("aria-label", `${schedule.root.dataset.starLabel}: ${session.title}`);
    favorite.setAttribute("aria-pressed", "false");
    heading.appendChild(favorite);
  }
  article.appendChild(heading);

  if (session.speakers.length && !session.isService) {
    const speakerList = document.createElement("div");
    speakerList.className = "program-session__speakers";
    for (const id of session.speakers) {
      const speaker = speakers.find((item) => item.id === id);
      if (!speaker) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "program-session__speaker";
      button.dataset.speakerOpen = "";
      button.dataset.speakerName = `${speaker.firstName} ${speaker.lastName}`.trim();
      button.dataset.speakerImage = speaker.profilePicture;
      button.dataset.speakerTagline = speaker.tagLine;
      button.dataset.speakerBio = speaker.bio;
      button.dataset.speakerTalkTitle = session.title;
      button.dataset.speakerTalkDescription = session.description;
      button.textContent = button.dataset.speakerName;
      speakerList.appendChild(button);
    }
    article.appendChild(speakerList);
  }
  return article;
}

function replaceProgram(program, schedule, speakers) {
  const oldGrid = program.querySelector(".program-schedule__grid");
  if (!oldGrid) return;
  const newGrid = document.createElement("div");
  newGrid.className = "program-schedule__grid";
  newGrid.style.setProperty("--program-room-count", String(schedule.rooms.length));
  const rooms = document.createElement("div");
  rooms.className = "program-schedule__rooms";
  rooms.setAttribute("aria-hidden", "true");
  rooms.appendChild(document.createElement("span"));
  for (const room of schedule.rooms) {
    const label = document.createElement("span");
    label.className = "program-schedule__room-label";
    label.textContent = room.name;
    rooms.appendChild(label);
  }
  newGrid.appendChild(rooms);
  for (const row of schedule.rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "program-schedule__row";
    rowEl.dataset.programTime = row.startsAt;
    const time = document.createElement("time");
    time.className = "program-schedule__time";
    time.dateTime = row.startsAt;
    time.textContent = eventTime(row.startsAt);
    rowEl.appendChild(time);
    const sessions = document.createElement("div");
    sessions.className = "program-schedule__sessions";
    for (const session of row.sessions) sessions.appendChild(buildProgramSession(session, speakers, { root: program }));
    rowEl.appendChild(sessions);
    newGrid.appendChild(rowEl);
  }
  for (const session of schedule.overlays ?? []) {
    const overlay = buildProgramSession(session, speakers, { root: program });
    overlay.classList.remove("program-session--long-service-in-row");
    overlay.classList.add("program-session--long-service-overlay");
    overlay.style.setProperty("--program-room-start", String(session.roomStart + 1));
    overlay.style.setProperty("--program-room-end", String(session.roomEnd + 2));
    overlay.dataset.sessionStartAt = session.startsAt;
    overlay.dataset.sessionEndAt = session.endsAt;
    overlay.dataset.sessionLongService = "true";
    newGrid.appendChild(overlay);
  }
  oldGrid.replaceWith(newGrid);
  program._tdcProgram?.positionLongService();

  const filter = program.querySelector("[data-program-topic-filter]");
  const selected = filter?.value;
  if (filter) {
    filter.replaceChildren(new Option(program.dataset.allTopicsLabel, ""));
    for (const topic of schedule.topics) filter.add(new Option(topic, topic));
    filter.value = schedule.topics.includes(selected) ? selected : "";
  }
}

function buildSpeakerCard(speaker, sessions, detailsLabel) {
  const li = document.createElement("li");
  li.className = "speaker-item";
  li.id = `speaker-${speaker.id}`;

  const fullName = `${speaker.firstName} ${speaker.lastName}`.trim();
  const talkId = speaker.sessions?.[0];
  const talk = talkId ? sessions.find((session) => session.id === talkId) : null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "speaker-card";
  button.setAttribute("data-speaker-open", "");
  button.setAttribute("data-speaker-name", fullName);
  button.setAttribute("data-speaker-image", speaker.profilePicture || "");
  button.setAttribute("data-speaker-tagline", speaker.tagLine || "");
  button.setAttribute("data-speaker-bio", speaker.bio || "");
  button.setAttribute("data-speaker-twitter", speaker.twitter || "");
  button.setAttribute("data-speaker-linkedin", speaker.linkedIn || "");
  button.setAttribute("data-speaker-blog", speaker.blog || "");
  button.setAttribute("data-speaker-talk-title", talk?.title || "");
  button.setAttribute("data-speaker-talk-description", talk?.description || "");

  if (speaker.profilePicture) {
    const img = document.createElement("img");
    img.src = speaker.profilePicture;
    img.alt = "";
    img.className = "speaker-card__avatar";
    button.appendChild(img);
  }

  const nameEl = document.createElement("span");
  nameEl.className = "speaker-card__name";
  nameEl.textContent = fullName;
  button.appendChild(nameEl);

  if (talk) {
    const talkEl = document.createElement("span");
    talkEl.className = "speaker-card__talk";
    talkEl.textContent = talk.title;
    button.appendChild(talkEl);
  }

  const moreEl = document.createElement("span");
  moreEl.className = "speaker-card__more";
  moreEl.textContent = detailsLabel;
  button.appendChild(moreEl);

  li.appendChild(button);
  return li;
}

function readTopSpeakerIds(wall) {
  try {
    return JSON.parse(wall.getAttribute("data-top-speaker-ids") || "[]");
  } catch {
    return [];
  }
}

async function refreshSpeakers() {
  const wall = document.querySelector(".speakers-wall[data-sessionize-event-id]");
  const grid = wall?.querySelector(".speakers-grid");
  if (!wall || !grid) return;

  const eventId = wall.getAttribute("data-sessionize-event-id");
  if (!eventId) return;

  // Baked in at build time from Sessionize's private API — the browser never
  // calls that API directly (see _data/sessionize.js for why).
  const topSpeakerIds = readTopSpeakerIds(wall);

  const sessionsUrl = `https://sessionize.com/api/v2/${eventId}/view/Sessions?under=True`;
  const speakersUrl = `https://sessionize.com/api/v2/${eventId}/view/Speakers?under=True`;

  try {
    const [sessionsHtml, speakersHtml] = await Promise.all([
      fetchHtml(sessionsUrl, "Sessionize sessions (client refresh)"),
      fetchHtml(speakersUrl, "Sessionize speakers (client refresh)"),
    ]);

    const sessions = parseSessions(sessionsHtml);
    const speakers = sortSpeakers(parseSpeakers(speakersHtml), topSpeakerIds);

    // Nothing usable came back — keep showing the statically-built list.
    if (speakers.length === 0) return;

    const detailsLabel = grid.querySelector(".speaker-card__more")?.textContent || "";
    const newGrid = document.createElement("ul");
    newGrid.className = "speakers-grid";
    newGrid.setAttribute("role", "list");
    for (const speaker of speakers) {
      newGrid.appendChild(buildSpeakerCard(speaker, sessions, detailsLabel));
    }

    grid.replaceWith(newGrid);
  } catch (error) {
    console.warn("Speaker refresh skipped:", error);
  }
}

async function refreshProgram() {
  const program = document.querySelector(".program-schedule[data-sessionize-event-id]");
  if (!program) return;
  const eventId = program.dataset.sessionizeEventId;
  const base = `https://sessionize.com/api/v2/${eventId}/view`;
  try {
    const [sessionsHtml, speakersHtml, gridHtml] = await Promise.all([
      fetchHtml(`${base}/Sessions?under=True`, "Sessionize sessions (program refresh)"),
      fetchHtml(`${base}/Speakers?under=True`, "Sessionize speakers (program refresh)"),
      fetchHtml(`${base}/GridSmart?under=True`, "Sessionize program grid (program refresh)"),
    ]);
    const sessions = parseSessions(sessionsHtml);
    const speakers = sortSpeakers(parseSpeakers(speakersHtml), readTopSpeakerIds(document.querySelector(".speakers-wall")));
    const schedule = mergeScheduleData(parseGridSchedule(gridHtml), sessions);
    if (schedule.rows.length) replaceProgram(program, schedule, speakers);
  } catch (error) {
    console.warn("Program refresh skipped:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  refreshSpeakers();
  refreshProgram();
});
