import { lockModalScroll, unlockModalScroll } from "./modal-scroll-lock.js";
import { sessionLanguageBadge, setLanguageSlot } from "./session-language.js";
import { buildCalendar, calendarFilename, downloadCalendar, googleCalendarUrl, outlookCalendarUrl, SHARED_LOCATION, sessionDescription } from "../calendar.js";

class TdcProgram {
  constructor(root) {
    this.root = root;
    this.key = root.dataset.favoritesKey;
    this.favorites = this.readFavorites();
    this.dialog = root.querySelector("[data-session-dialog]");
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
    this.modalLanguage = root.querySelector("[data-session-modal-language]");
    this.activeSession = null;
    this.returnFocus = null;

    root.addEventListener("click", (event) => {
      const favorite = event.target.closest("[data-session-favorite]");
      if (favorite) {
        this.toggle(favorite.closest("[data-program-session]")?.dataset.sessionId);
        return;
      }

      const open = event.target.closest("[data-session-open]");
      if (open) {
        this.open(open.closest("[data-program-session]"));
        return;
      }

      if (event.target.closest("[data-session-close]")) this.dialog?.close();
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

      if (!insideDialog) this.dialog.close();
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
  }

  positionLongService() {
    const overlay = this.root.querySelector(".program-session--long-service-overlay");
    const grid = this.root.querySelector(".program-schedule__grid");
    if (!overlay || !grid || window.innerWidth < 1200) return;
    const start = this.root.querySelector(`[data-program-time="${overlay.dataset.sessionStartAt}"]`);
    const rows = [...this.root.querySelectorAll("[data-program-time]")].filter((row) => row.dataset.programTime <= overlay.dataset.sessionEndAt);
    const roomStart = Number.parseInt(getComputedStyle(overlay).getPropertyValue("--program-room-start"), 10) - 1;
    const roomEnd = Number.parseInt(getComputedStyle(overlay).getPropertyValue("--program-room-end"), 10) - 2;
    const roomLabels = [...grid.querySelectorAll(".program-schedule__room-label")];
    const firstRoom = roomLabels[roomStart];
    const lastRoom = roomLabels[roomEnd];
    if (!start || !rows.length || !firstRoom || !lastRoom) return;
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

  open(session) {
    if (!session || !this.dialog) return;
    this.activeSession = session;
    // The pill is reused across sessions, so drop a stale .is-toggling before
    // updateModalFavorite() flips aria-pressed and replays the pop on open.
    this.modalFavorite?.classList.remove("is-toggling");
    this.setCalendarMenu(false);
    this.returnFocus = session.querySelector("[data-session-open]");
    this.title.textContent = session.dataset.sessionTitle || "";
    this.description.textContent = session.dataset.sessionDescription || "";
    this.description.hidden = !this.description.textContent;
    this.meta.textContent = `${session.dataset.sessionRoom} · ${session.dataset.sessionStart}–${session.dataset.sessionEnd}`;
    setLanguageSlot(this.modalLanguage, sessionLanguageBadge(session));
    this.updateModalFavorite();
    if (typeof this.dialog.showModal === "function") this.dialog.showModal();
    else this.dialog.setAttribute("open", "");
    lockModalScroll();
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