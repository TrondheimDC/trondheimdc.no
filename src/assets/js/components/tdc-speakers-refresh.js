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

import { fetchHtml, parseSessions, parseSpeakers } from "../sessionize-client.js";

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

async function refreshSpeakers() {
  const wall = document.querySelector(".speakers-wall[data-sessionize-event-id]");
  const grid = wall?.querySelector(".speakers-grid");
  if (!wall || !grid) return;

  const eventId = wall.getAttribute("data-sessionize-event-id");
  if (!eventId) return;

  const sessionsUrl = `https://sessionize.com/api/v2/${eventId}/view/Sessions?under=True`;
  const speakersUrl = `https://sessionize.com/api/v2/${eventId}/view/Speakers?under=True`;

  try {
    const [sessionsHtml, speakersHtml] = await Promise.all([
      fetchHtml(sessionsUrl, "Sessionize sessions (client refresh)"),
      fetchHtml(speakersUrl, "Sessionize speakers (client refresh)"),
    ]);

    const sessions = parseSessions(sessionsHtml);
    const speakers = parseSpeakers(speakersHtml);

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

document.addEventListener("DOMContentLoaded", refreshSpeakers);
