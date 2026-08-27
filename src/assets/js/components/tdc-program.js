import { lockModalScroll, unlockModalScroll } from "./modal-scroll-lock.js";

class TdcProgram {
  constructor(root) {
    this.root = root;
    this.key = root.dataset.favoritesKey;
    this.favorites = this.readFavorites();
    this.dialog = root.querySelector("[data-session-dialog]");
    this.onlyFavorites = root.querySelector("[data-program-favorites-only]");
    this.topicFilter = root.querySelector("[data-program-topic-filter]");
    this.modalFavorite = root.querySelector("[data-session-modal-favorite]");
    this.title = root.querySelector("[data-session-modal-title]");
    this.description = root.querySelector("[data-session-modal-description]");
    this.meta = root.querySelector("[data-session-modal-meta]");
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

    this.modalFavorite?.addEventListener("click", () => this.toggle(this.activeSession?.dataset.sessionId));
    this.dialog?.addEventListener("close", () => {
      unlockModalScroll();
      this.returnFocus?.focus();
      this.returnFocus = null;
    });
    this.updateButtons();
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
  }

  updateButtons() {
    this.root.querySelectorAll("[data-program-session]").forEach((session) => {
      const saved = this.favorites.has(session.dataset.sessionId);
      const button = session.querySelector("[data-session-favorite]");
      if (!button) return;
      button.textContent = saved ? "★" : "☆";
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", `${saved ? this.root.dataset.unstarLabel : this.root.dataset.starLabel}: ${session.dataset.sessionTitle}`);
      session.hidden = this.isFilteredOut(session);
    });
  }

  isFilteredOut(session) {
    const onlyFavorites = this.onlyFavorites?.getAttribute("aria-pressed") === "true";
    const selectedTopic = this.topicFilter?.value;
    const topics = (session.dataset.sessionTopics || "").split("|").filter(Boolean);
    return (onlyFavorites && !this.favorites.has(session.dataset.sessionId)) ||
      (selectedTopic && !topics.includes(selectedTopic));
  }

  applyFilter() {
    this.root.querySelectorAll("[data-program-session]").forEach((session) => {
      session.hidden = this.isFilteredOut(session);
    });
  }

  open(session) {
    if (!session || !this.dialog) return;
    this.activeSession = session;
    this.returnFocus = session.querySelector("[data-session-open]");
    this.title.textContent = session.dataset.sessionTitle || "";
    this.description.textContent = session.dataset.sessionDescription || "";
    this.description.hidden = !this.description.textContent;
    this.meta.textContent = `${session.dataset.sessionRoom} · ${session.dataset.sessionStart}–${session.dataset.sessionEnd}`;
    this.updateModalFavorite();
    if (typeof this.dialog.showModal === "function") this.dialog.showModal();
    else this.dialog.setAttribute("open", "");
    lockModalScroll();
  }

  updateModalFavorite() {
    if (!this.activeSession || !this.modalFavorite) return;
    const saved = this.favorites.has(this.activeSession.dataset.sessionId);
    this.modalFavorite.textContent = `${saved ? "★" : "☆"} ${saved ? this.root.dataset.unstarLabel : this.root.dataset.starLabel}`;
    this.modalFavorite.setAttribute("aria-pressed", String(saved));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".program-schedule").forEach((root) => new TdcProgram(root));
});