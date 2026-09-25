import { lockModalScroll, unlockModalScroll } from "./modal-scroll-lock.js";
import { sessionLanguageBadge, setLanguageSlot } from "./session-language.js";
import { ProgramLive } from "./tdc-program-live.js";
import { withViewTransition } from "./view-transition.js";
import { buildSocialLinks } from "./social-links.js";
import { buildCalendar, calendarFilename, downloadCalendar, googleCalendarUrl, outlookCalendarUrl, SHARED_LOCATION, sessionDescription } from "../calendar.js";

class TdcProgram {
  constructor(root) {
    this.root = root;
    this.key = root.dataset.favoritesKey;
    this.favorites = this.readFavorites();
    this.dialog = root.querySelector("[data-session-dialog]");
    this.dialogScroll = this.dialog?.querySelector(".detail-modal__scroll");
    this.onlyFavorites = root.querySelector("[data-program-favorites-only]");
    this.topicFilter = root.querySelector("[data-program-topic-filter]");
    this.searchInput = root.querySelector("[data-program-search]");
    this.searchEmpty = root.querySelector("[data-program-search-empty]");
    this.modalFavorite = root.querySelector("[data-session-modal-favorite]");
    this.modalFavoriteLabel = root.querySelector("[data-session-modal-favorite-label]");
    this.calendarMenu = root.querySelector("[data-calendar-menu]");
    this.calendarToggle = root.querySelector("[data-calendar-toggle]");
    this.calendarList = root.querySelector("[data-calendar-list]");
    // Top layer keeps the menu out of the dialog's scroll box; older browsers
    // fall back to the [hidden] toggle and the same fixed positioning.
    this.supportsPopover = typeof this.calendarList?.showPopover === "function";
    if (this.supportsPopover) this.calendarList.setAttribute("popover", "manual");
    this.calendarExport = root.querySelector("[data-program-calendar-export]");
    this.title = root.querySelector("[data-session-modal-title]");
    this.description = root.querySelector("[data-session-modal-description]");
    this.meta = root.querySelector("[data-session-modal-meta]");
    this.metaRow = root.querySelector("[data-session-modal-meta-row]");
    this.modalLanguage = root.querySelector("[data-session-modal-language]");
    this.actions = root.querySelector(".detail-modal__actions");
    this.speakersSection = root.querySelector("[data-session-modal-speakers-section]");
    this.speakersTitle = root.querySelector("[data-session-modal-speakers-title]");
    this.speakersList = root.querySelector("[data-session-modal-speakers]");
    this.activeSession = null;
    this.returnFocus = null;

    root.addEventListener("click", (event) => {
      const favorite = event.target.closest("[data-session-favorite]");
      if (favorite) {
        this.toggle(favorite.closest("[data-program-session]")?.dataset.sessionId);
        return;
      }

      if (event.target.closest("[data-session-close]")) {
        this.closeDialog();
        return;
      }

      // A speaker's name still gets its own Matomo event; the click still
      // falls through to open the (single, merged) dialog below.
      const speakerButton = event.target.closest("[data-speaker-open]");
      if (speakerButton) this.trackSpeakerClick(speakerButton);

      // The whole card opens the dialog now, not just its title — a bigger,
      // more forgiving target, especially on mobile. .program-session--service
      // (breaks, lunch, ...) never gets the --favoritable class, so those stay
      // inert.
      const session = event.target.closest(".program-session--favoritable");
      if (session) {
        this.open(session);
      }
    });

    // The speaker wall (#speakers) sits in its own section, outside this root,
    // so its [data-speaker-open] cards need a document-level listener. Clicks
    // on speaker buttons inside the schedule are already handled above; skip
    // those here rather than opening (and animating) the same session twice.
    document.addEventListener("click", (event) => {
      const speakerButton = event.target.closest("[data-speaker-open]");
      if (!speakerButton || root.contains(speakerButton)) return;
      this.trackSpeakerClick(speakerButton);
      this.openFromSpeaker(speakerButton);
    });

    this.onlyFavorites?.addEventListener("click", () => {
      const active = this.onlyFavorites.getAttribute("aria-pressed") === "true";
      this.onlyFavorites.setAttribute("aria-pressed", String(!active));
      this.onlyFavorites.textContent = active
        ? `☆ ${this.root.dataset.showFavoritesLabel}`
        : `★ ${this.root.dataset.showAllLabel}`;
      this.applyFilter();
    });

    this.topicFilter?.addEventListener("change", () => this.applyFilter());
    this.searchInput?.addEventListener("input", () => this.applyFilter());

    this.modalFavorite?.addEventListener("click", () => this.toggle(this.activeSession?.dataset.sessionId));

    this.calendarToggle?.addEventListener("click", () => {
      this.setCalendarMenu(this.calendarToggle.getAttribute("aria-expanded") !== "true");
    });

    // Picking a web calendar leaves for the provider; close behind it.
    this.calendarList?.addEventListener("click", (event) => {
      if (event.target.closest("[data-calendar-link]")) this.setCalendarMenu(false);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-calendar-menu]")) this.setCalendarMenu(false);
    });

    window.addEventListener("resize", () => this.positionCalendarMenu());
    this.dialog?.addEventListener("scroll", () => this.positionCalendarMenu());

    // Escape should dismiss the menu before it dismisses the dialog under it.
    this.dialog?.addEventListener("cancel", (event) => {
      if (this.calendarToggle?.getAttribute("aria-expanded") !== "true") return;
      event.preventDefault();
      this.setCalendarMenu(false);
      this.calendarToggle.focus();
    });

    this.calendarExport?.addEventListener("click", () => {
      const saved = [...this.root.querySelectorAll("[data-program-session]")]
        .filter((session) => this.favorites.has(session.dataset.sessionId));
      this.download(saved, this.root.dataset.calendarSavedName, { name: this.root.dataset.calendarSavedName });
    });

    // Clicking the backdrop closes the dialog. The click lands on the <dialog>
    // itself, so compare the pointer against the dialog box to tell the two apart.
    this.dialog?.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      const insideDialog =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (!insideDialog) this.closeDialog();
    });
    this.dialog?.addEventListener("close", () => {
      this.setCalendarMenu(false);
      unlockModalScroll();
      this.returnFocus?.focus();
      this.returnFocus = null;
    });
    this.updateButtons();
    this.root._tdcProgram = this;
    this.positionLongService();
    window.addEventListener("resize", () => this.positionLongService());
    this.live = new ProgramLive(this);
  }

  positionLongService() {
    const overlay = this.root.querySelector(".program-session--long-service-overlay");
    const grid = this.root.querySelector(".program-schedule__grid");
    if (!overlay || !grid || window.innerWidth < 1200) return;
    const start = this.root.querySelector(`[data-program-time="${overlay.dataset.sessionStartAt}"]`);
    const rows = [...this.root.querySelectorAll("[data-program-time]")]
      .filter((row) => !row.hidden && row.dataset.programTime <= overlay.dataset.sessionEndAt);
    const roomStart = Number.parseInt(getComputedStyle(overlay).getPropertyValue("--program-room-start"), 10) - 1;
    const roomEnd = Number.parseInt(getComputedStyle(overlay).getPropertyValue("--program-room-end"), 10) - 2;
    const roomLabels = [...grid.querySelectorAll(".program-schedule__room-label")];
    const firstRoom = roomLabels[roomStart];
    const lastRoom = roomLabels[roomEnd];
    if (!start || start.hidden || !rows.length || !firstRoom || !lastRoom) return;
    const gridBox = grid.getBoundingClientRect();
    const startBox = start.getBoundingClientRect();
    const endBox = rows.at(-1).getBoundingClientRect();
    const firstBox = firstRoom.getBoundingClientRect();
    const lastBox = lastRoom.getBoundingClientRect();
    const finalSessions = [...rows.at(-1).querySelectorAll("[data-program-session]:not(.program-session--long-service-in-row)")];
    const lastSessionBottom = finalSessions.length && rows.at(-1).dataset.programTime < overlay.dataset.sessionEndAt
      ? Math.max(...finalSessions.map((session) => session.getBoundingClientRect().bottom))
      : endBox.bottom;
    overlay.style.left = `${firstBox.left - gridBox.left}px`;
    overlay.style.top = `${startBox.top - gridBox.top}px`;
    overlay.style.width = `${lastBox.right - firstBox.left}px`;
    overlay.style.height = `${lastSessionBottom - startBox.top}px`;
  }

  readFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(this.key) || "[]"));
    } catch {
      return new Set();
    }
  }

  writeFavorites() {
    localStorage.setItem(this.key, JSON.stringify([...this.favorites]));
  }

  toggle(id) {
    if (!id) return;
    if (this.favorites.has(id)) this.favorites.delete(id);
    else this.favorites.add(id);
    this.writeFavorites();
    this.updateButtons();
    if (this.activeSession?.dataset.sessionId === id) this.updateModalFavorite();
    this.playStarAnimation(id);
  }

  // Runs on a real toggle only, and after aria-pressed is settled on both
  // buttons. updateButtons() also runs on load, where replaying the pop for
  // every star saved on an earlier visit would be noise.
  playStarAnimation(id) {
    const stars = [this.root.querySelector(`[data-program-session][data-session-id="${CSS.escape(id)}"] [data-session-favorite]`)];
    if (this.activeSession?.dataset.sessionId === id) stars.push(this.modalFavorite);
    stars.filter(Boolean).forEach((button) => {
      button.classList.remove("is-toggling");
      void button.offsetWidth; // reflow, so a second quick click restarts the animation
      button.classList.add("is-toggling");
    });
  }

  updateButtons() {
    this.root.querySelectorAll("[data-program-session]").forEach((session) => {
      const saved = this.favorites.has(session.dataset.sessionId);
      const button = session.querySelector("[data-session-favorite]");
      if (!button) return;
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", `${saved ? this.root.dataset.unstarLabel : this.root.dataset.starLabel}: ${session.dataset.sessionTitle}`);
      session.hidden = this.isFilteredOut(session);
    });
    if (this.calendarExport) this.calendarExport.disabled = this.favorites.size === 0;
  }

  isFilteredOut(session) {
    const onlyFavorites = this.onlyFavorites?.getAttribute("aria-pressed") === "true";
    const selectedTopic = this.topicFilter?.value;
    const topics = (session.dataset.sessionTopics || "").split("|").filter(Boolean);
    const search = this.normalize(this.searchInput?.value || "");
    const speakers = [...session.querySelectorAll("[data-speaker-open]")]
      .map((speaker) => speaker.textContent)
      .join(" ");
    const searchable = this.normalize([
      session.dataset.sessionTitle,
      session.dataset.sessionDescription,
      session.dataset.sessionStart,
      session.dataset.sessionEnd,
      session.dataset.sessionRoom,
      session.dataset.sessionTopics,
      speakers,
    ].join(" "));
    return (onlyFavorites && !this.favorites.has(session.dataset.sessionId)) ||
      (selectedTopic && !topics.includes(selectedTopic)) ||
      (search && !searchable.includes(search));
  }

  applyFilter() {
    const sessions = [...this.root.querySelectorAll("[data-program-session]")];
    sessions.forEach((session) => {
      session.hidden = this.isFilteredOut(session);
    });
    if (this.searchEmpty) {
      this.searchEmpty.hidden = !this.searchInput?.value.trim() || sessions.some((session) => !session.hidden);
    }
    // Searching suspends the live view's collapse, so it has to re-run here.
    this.live?.refresh();
  }

  normalize(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  }

  // An .ics the attendee can import into whatever calendar they already use.
  // The long service sessions render twice (in-row + overlay), so dedupe by id.
  download(sessions, title, options = {}) {
    const seen = new Set();
    const events = sessions
      .filter((session) => {
        const id = session.dataset.sessionId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((session) => this.toEvent(session));

    if (!events.length) return;
    downloadCalendar(calendarFilename(title), buildCalendar(events, options));
  }

  closeDialog() {
    if (!this.dialog?.open) return;
    withViewTransition(() => this.dialog.close());
  }

  setCalendarMenu(open) {
    if (!this.calendarToggle || !this.calendarList) return;
    if (open && !this.activeSession) return;
    if (open) this.updateCalendarLinks();

    this.calendarList.hidden = !open;
    if (this.supportsPopover) {
      if (open) this.calendarList.showPopover();
      else if (this.calendarList.matches(":popover-open")) this.calendarList.hidePopover();
    }

    this.calendarToggle.setAttribute("aria-expanded", String(open));
    if (open) this.positionCalendarMenu();
  }

  // The menu is fixed-positioned, so clamp it into the viewport by hand: open
  // upwards when there is room above the button, otherwise flip below.
  positionCalendarMenu() {
    if (!this.calendarList || this.calendarToggle?.getAttribute("aria-expanded") !== "true") return;

    const margin = 8;
    const list = this.calendarList;
    list.style.top = "0px";
    list.style.left = "0px";

    const toggle = this.calendarToggle.getBoundingClientRect();
    const { width, height } = list.getBoundingClientRect();
    const above = toggle.top - margin - height;
    const top = above >= margin ? above : Math.min(toggle.bottom + margin, window.innerHeight - height - margin);
    const left = Math.min(toggle.left, window.innerWidth - width - margin);

    list.style.top = `${Math.max(margin, top)}px`;
    list.style.left = `${Math.max(margin, left)}px`;
  }

  updateCalendarLinks() {
    const event = this.toEvent(this.activeSession);
    const urls = {
      google: googleCalendarUrl(event),
      outlook: outlookCalendarUrl(event),
      ics: `${this.root.dataset.calendarIcsBase}${encodeURIComponent(this.activeSession.dataset.sessionId)}.ics`,
    };

    this.calendarList.querySelectorAll("[data-calendar-link]").forEach((link) => {
      const url = urls[link.dataset.calendarLink];
      link.hidden = !url;
      if (url) link.href = url;
    });
  }

  toEvent(session) {
    const speakers = [...session.querySelectorAll("[data-speaker-open]")]
      .map((speaker) => speaker.dataset.speakerName)
      .filter(Boolean);
    const url = this.root.dataset.calendarUrl;

    return {
      uid: `${session.dataset.sessionId}@trondheimdc.no`,
      title: session.dataset.sessionTitle,
      start: session.dataset.sessionStartAt,
      end: session.dataset.sessionEndAt,
      location: session.dataset.sessionRoom || SHARED_LOCATION,
      url,
      description: sessionDescription({ speakers, description: session.dataset.sessionDescription, url }),
    };
  }

  // returnFocusTo overrides the default (the session's own title button) —
  // needed when the click that opened this came from outside the grid
  // entirely (openFromSpeaker below). Take it as a parameter here, applied
  // inside the same withViewTransition callback, rather than having the
  // caller set this.returnFocus right after calling open(): the callback can
  // run as a deferred microtask, so anything the caller does "after" open()
  // in the same synchronous turn can actually land *before* the callback
  // does, and get clobbered when it finally runs.
  open(session, returnFocusTo) {
    if (!session || !this.dialog) return;
    withViewTransition(() => {
      this.activeSession = session;
      // The pill is reused across sessions, so drop a stale .is-toggling before
      // updateModalFavorite() flips aria-pressed and replays the pop on open.
      this.modalFavorite?.classList.remove("is-toggling");
      this.setCalendarMenu(false);
      this.returnFocus = returnFocusTo ?? session.querySelector("[data-session-open]");
      this.title.textContent = session.dataset.sessionTitle || "";
      this.description.textContent = session.dataset.sessionDescription || "";
      this.description.hidden = !this.description.textContent;
      this.meta.textContent = `${session.dataset.sessionRoom} · ${session.dataset.sessionStart}–${session.dataset.sessionEnd}`;
      // A previous open() may have been the no-session speaker fallback below,
      // which hides all three — a real session always shows all three.
      if (this.metaRow) this.metaRow.hidden = false;
      if (this.actions) this.actions.hidden = false;
      if (this.speakersTitle) this.speakersTitle.hidden = false;
      setLanguageSlot(this.modalLanguage, sessionLanguageBadge(session));
      this.renderSpeakers(session);
      this.updateModalFavorite();
      if (typeof this.dialog.showModal === "function") this.dialog.showModal();
      else this.dialog.setAttribute("open", "");
      // A session reused from a previous open shouldn't reopen scrolled to
      // wherever that visit left it. Has to come after showModal() — while
      // the dialog is still closed (display: none), it has no layout box to
      // scroll, so scrollTo() on it is a silent no-op.
      this.dialogScroll?.scrollTo(0, 0);
      lockModalScroll();
    });
  }

  // Reached from the speakers wall (#speakers), which sits outside this
  // instance's root and only knows which session its speaker belongs to
  // (data-session-id) — the actual bio/social data comes from that session's
  // own [data-speaker-open] buttons in the schedule, read by renderSpeakers().
  openFromSpeaker(button) {
    const sessionId = button.dataset.sessionId;
    const session = sessionId
      ? document.querySelector(`[data-program-session][data-session-id="${CSS.escape(sessionId)}"]`)
      : null;
    if (session) {
      // open() defaults the return focus to the session's own title button;
      // this click came from outside the grid, so send focus back there instead.
      this.open(session, button);
      return;
    }
    // A speaker can be announced before they're slotted into the schedule —
    // data-session-id is then empty and there's nothing to resolve. Fall back
    // to just their profile rather than doing nothing.
    this.openSpeakerOnly(button);
  }

  // Same dialog, same speaker-block markup as a real session — just without
  // the parts (meta, description, favorite/calendar) that need one.
  openSpeakerOnly(button) {
    if (!this.dialog) return;
    withViewTransition(() => {
      this.activeSession = null;
      this.modalFavorite?.classList.remove("is-toggling");
      this.setCalendarMenu(false);
      this.returnFocus = button;
      this.title.textContent = button.dataset.speakerName || "";
      this.description.hidden = true;
      if (this.metaRow) this.metaRow.hidden = true;
      if (this.actions) this.actions.hidden = true;
      setLanguageSlot(this.modalLanguage, null);
      // The title above already names them — skip the redundant name line, but
      // keep everything else (avatar, tagline, bio, socials) the block offers.
      if (this.speakersList) this.speakersList.replaceChildren(this.buildSpeakerBlock(button, { showName: false }));
      if (this.speakersSection) this.speakersSection.hidden = false;
      if (this.speakersTitle) this.speakersTitle.hidden = true;
      if (typeof this.dialog.showModal === "function") this.dialog.showModal();
      else this.dialog.setAttribute("open", "");
      // Has to come after showModal() — see the comment in open().
      this.dialogScroll?.scrollTo(0, 0);
      lockModalScroll();
    });
  }

  // Records which speaker's profile got the click, the way the old standalone
  // speaker dialog did — kept because it's opening the same dialog, not a
  // point of navigation, so the event still needs to name the speaker.
  trackSpeakerClick(button) {
    const name = button.dataset.speakerName || button.textContent?.trim() || "";
    if (!name) return;
    const tracker = window._paq = window._paq || [];
    tracker.push(["trackEvent", "Speakers", "Click", name, 1]);
  }

  // Built from the session's own [data-speaker-open] buttons, so a session
  // opened from the schedule, the speaker wall, or another speaker on the
  // same talk all show the identical speaker list — one source of truth.
  renderSpeakers(session) {
    if (!this.speakersSection || !this.speakersList) return;
    const buttons = [...session.querySelectorAll("[data-speaker-open]")];
    this.speakersList.replaceChildren(...buttons.map((button) => this.buildSpeakerBlock(button)));
    this.speakersSection.hidden = buttons.length === 0;
    this.setSpeakersTitleCount(buttons.length);
  }

  // "Foredragsholder"/"Speaker" for one, "Foredragsholdere"/"Speakers" for
  // more than one — 0 (hidden anyway) falls back to the plural.
  setSpeakersTitleCount(count) {
    if (!this.speakersTitle) return;
    this.speakersTitle.textContent = count === 1
      ? this.root.dataset.speakerSingularLabel
      : this.root.dataset.speakerPluralLabel;
  }

  buildSpeakerBlock(button, { showName = true } = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "session-speaker";

    const header = document.createElement("div");
    header.className = "session-speaker__header";
    const image = button.dataset.speakerImage || "";
    if (image) {
      const avatar = document.createElement("img");
      avatar.className = "session-speaker__avatar";
      avatar.src = image;
      avatar.alt = "";
      header.appendChild(avatar);
    }

    const heading = document.createElement("div");
    heading.className = "session-speaker__heading";
    if (showName) {
      const name = document.createElement("p");
      name.className = "session-speaker__name";
      name.textContent = button.dataset.speakerName || "";
      heading.appendChild(name);
    }
    const tagline = button.dataset.speakerTagline || "";
    if (tagline) {
      const taglineEl = document.createElement("p");
      taglineEl.className = "session-speaker__tagline";
      taglineEl.textContent = tagline;
      heading.appendChild(taglineEl);
    }
    header.appendChild(heading);
    wrapper.appendChild(header);

    const bio = button.dataset.speakerBio || "";
    if (bio) {
      const bioEl = document.createElement("p");
      bioEl.className = "session-speaker__bio";
      bioEl.textContent = bio;
      wrapper.appendChild(bioEl);
    }

    const socials = buildSocialLinks(button.dataset.speakerTwitter, button.dataset.speakerLinkedin, button.dataset.speakerBlog);
    if (socials.length) {
      const socialsEl = document.createElement("div");
      socialsEl.className = "session-speaker__socials";
      socialsEl.append(...socials);
      wrapper.appendChild(socialsEl);
    }

    return wrapper;
  }

  updateModalFavorite() {
    if (!this.activeSession || !this.modalFavorite) return;
    const saved = this.favorites.has(this.activeSession.dataset.sessionId);
    if (this.modalFavoriteLabel) this.modalFavoriteLabel.textContent = saved ? this.root.dataset.unstarLabel : this.root.dataset.starLabel;
    this.modalFavorite.setAttribute("aria-pressed", String(saved));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".program-schedule").forEach((root) => new TdcProgram(root));
});