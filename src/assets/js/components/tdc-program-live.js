// Live ("EPG") view for the program grid.
//
// While the conference day is running the schedule can follow along the way a
// TV guide does: finished time slots collapse out of the grid so the current
// slot sits at the top, and a playhead creeps down it. Finished slots collapse
// on a timer; the playhead itself keeps moving with the clock between those
// refreshes, so the line on the wide grid doesn't sit still.
//
// It is opt-out, not mandatory — the toolbar toggle is remembered in
// localStorage — and it is completely inert outside the conference day, so the
// grid on any other date is exactly what it was before. Owned by TdcProgram,
// which constructs it and re-renders it whenever the filters change.
//
// Preview hooks, for checking this on a day that isn't the 19th of October:
//   ?live=1                        offer (and default to) the live view now
//   ?now=2026-10-19T12:30:00+02:00 run against a made-up clock, which then
//                                  keeps ticking forward in real time

const TICK_MS = 30_000;
// The view is offered a little either side of the program itself: people are in
// the building before the keynote and still around after the last session.
const LEAD_IN_MS = 2 * 60 * 60 * 1000;
const LEAD_OUT_MS = 60 * 60 * 1000;

// The schedule is written in the event's timezone, not the reader's — a remote
// viewer should still see the Trondheim clock against the Trondheim program.
const clock = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false,
});

export class ProgramLive {
  constructor(program) {
    this.program = program;
    this.root = program.root;
    this.grid = this.root.querySelector(".program-schedule__grid");
    this.toggleButton = this.root.querySelector("[data-program-live-toggle]");
    this.earlierButton = this.root.querySelector("[data-program-live-earlier]");
    this.playhead = this.root.querySelector("[data-program-now]");
    this.playheadTime = this.root.querySelector("[data-program-now-time]");

    this.ready = Boolean(this.grid && this.toggleButton && this.playhead);
    if (!this.ready) return;

    const params = new URLSearchParams(window.location.search);
    const fakeNow = Date.parse(params.get("now") ?? "");
    this.clockOffset = Number.isNaN(fakeNow) ? 0 : fakeNow - Date.now();
    this.forced = params.has("live") && params.get("live") !== "0";

    this.storageKey = this.root.dataset.liveStorageKey || "tdc-program-live";
    this.preference = this.readPreference();
    this.showEarlier = false;
    this.available = false;
    this.playheadFrame = 0;

    this.readSchedule();
    if (!this.rows.length) {
      this.ready = false;
      return;
    }

    this.toggleButton.addEventListener("click", () => {
      this.writePreference(this.active ? "off" : "on");
      // A fresh opt-in should start from "what's on now", not from wherever the
      // previous visit left the expander.
      this.showEarlier = false;
      this.render();
    });

    this.earlierButton?.addEventListener("click", () => {
      this.showEarlier = !this.showEarlier;
      this.render();
    });

    window.addEventListener("resize", () => this.positionPlayhead());
    // A laptop that slept through two talks should catch up the moment it wakes.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopPlayheadLoop();
      else this.render();
    });
    window.setInterval(() => this.render(), TICK_MS);

    this.render();
  }

  // The client-side Sessionize refresh swaps the whole grid out; carry the
  // playhead across and re-read the new rows.
  rebind() {
    if (!this.ready) return;
    const grid = this.root.querySelector(".program-schedule__grid");
    if (!grid) return;
    this.grid = grid;
    this.grid.appendChild(this.playhead);
    this.readSchedule();
    this.render();
  }

  refresh() {
    if (this.ready) this.render();
  }

  now() {
    return Date.now() + this.clockOffset;
  }

  readPreference() {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  writePreference(value) {
    this.preference = value;
    try {
      localStorage.setItem(this.storageKey, value);
    } catch {
      // Private browsing — the choice just won't outlive the page.
    }
  }

  // On during the conference day unless the reader has turned it off; off (and
  // out of the way) on every other day, whatever the stored preference says.
  get active() {
    return this.available && this.preference !== "off";
  }

  readSchedule() {
    this.rows = [...this.grid.querySelectorAll(".program-schedule__row")]
      .map((element) => {
        const sessions = [...element.querySelectorAll("[data-program-session]")];
        const ends = sessions.map((session) => Date.parse(session.dataset.sessionEndAt)).filter((end) => !Number.isNaN(end));
        const start = Date.parse(element.dataset.programTime);
        return { element, sessions, start, end: ends.length ? Math.max(...ends) : start };
      })
      .filter((row) => !Number.isNaN(row.start));

    // Rendered outside the rows, so they need collecting separately.
    this.overlays = [...this.grid.querySelectorAll(".program-session--long-service-overlay")];

    this.dayStart = this.rows.length ? Math.min(...this.rows.map((row) => row.start)) : NaN;
    this.dayEnd = this.rows.length ? Math.max(...this.rows.map((row) => row.end)) : NaN;
  }

  render() {
    if (!this.ready) return;

    const now = this.now();
    this.available = this.forced || (now >= this.dayStart - LEAD_IN_MS && now <= this.dayEnd + LEAD_OUT_MS);
    this.toggleButton.hidden = !this.available;
    this.toggleButton.setAttribute("aria-pressed", String(this.active));
    this.root.classList.toggle("program-schedule--live", this.active);

    if (!this.active) {
      this.reset();
      return;
    }

    // Before the first session there is nothing to collapse, and after the last
    // one collapsing would empty the grid — so only the day itself collapses.
    const running = now >= this.dayStart && now <= this.dayEnd;
    // A search is a lookup across the whole day, so it outranks the collapse:
    // a talk you search for should be findable after it has been given.
    const searching = Boolean(this.program.searchInput?.value.trim());
    const collapse = running && !searching && !this.showEarlier;

    let finished = 0;
    for (const row of this.rows) {
      const past = row.end <= now;
      if (past) finished += 1;
      row.element.classList.toggle("is-past", past && running);
      row.element.hidden = collapse && past;
      for (const session of row.sessions) this.markSession(session, now, running, collapse);
    }
    for (const overlay of this.overlays) this.markSession(overlay, now, running, collapse);

    this.renderEarlier(finished, running && !searching);
    // Collapsing rows moves the ground under the long-service overlay.
    this.program.positionLongService();
    this.positionPlayhead(now);
  }

  // The overlay sessions share their `hidden` flag with the program filters, so
  // the collapse rides on a class here rather than fighting over the attribute.
  markSession(session, now, running, collapse) {
    const start = Date.parse(session.dataset.sessionStartAt);
    const end = Date.parse(session.dataset.sessionEndAt);
    const past = end <= now;
    session.classList.toggle("is-past", running && past);
    session.classList.toggle("is-live", running && start <= now && !past);
    session.classList.toggle("is-collapsed", collapse && past);
  }

  renderEarlier(finished, offer) {
    if (!this.earlierButton) return;
    const show = offer && finished > 0;
    this.earlierButton.hidden = !show;
    if (!show) return;
    this.earlierButton.textContent = this.showEarlier
      ? this.root.dataset.liveHideEarlierLabel
      : this.root.dataset.liveShowEarlierLabel;
    this.earlierButton.setAttribute("aria-expanded", String(this.showEarlier));
  }

  // Interpolates between the visible rows so the line creeps rather than jumps:
  // where it sits between two slots is the "how far into the day are we" signal.
  // On the wide grid that position changes continuously, so a frame loop keeps
  // it moving between the slower collapse refreshes. The stacked layout snaps
  // to the row and doesn't need the loop.
  positionPlayhead(now = this.now()) {
    if (!this.ready || !this.playhead) return;
    if (!this.active || now > this.dayEnd) {
      this.playhead.hidden = true;
      this.stopPlayheadLoop();
      return;
    }

    const visible = this.rows.filter((row) => !row.element.hidden);
    if (!visible.length) {
      this.playhead.hidden = true;
      this.stopPlayheadLoop();
      return;
    }

    const current = [...visible].reverse().find((row) => row.start <= now);
    const next = visible.find((row) => row.start > now);
    const gridTop = this.grid.getBoundingClientRect().top;
    // Below this width rooms stop being columns and stack as cards instead
    // (see the max-width: 1199px block in program-sessionize.css), so a row's
    // height there is "how many talks run at once", not "how much time is
    // left in this slot" — creeping into it would point at an arbitrary card.
    // Match positionLongService()'s breakpoint so both switch at the same width.
    const stacked = window.innerWidth < 1200;
    let top;

    if (!current) {
      // The day has not started: park the line on top of the first slot.
      top = next.element.getBoundingClientRect().top - gridTop;
    } else if (stacked) {
      top = current.element.getBoundingClientRect().top - gridTop;
    } else {
      const box = current.element.getBoundingClientRect();
      // Measure against the next slot where there is one, so the line lands
      // exactly on its top edge as that slot begins.
      const until = next ? next.start : Math.max(current.end, current.start + 1);
      const height = next ? next.element.getBoundingClientRect().top - box.top : box.height;
      const span = until - current.start;
      const ratio = span > 0 ? Math.min(1, Math.max(0, (now - current.start) / span)) : 0;
      top = box.top - gridTop + ratio * height;
    }

    // A CSS transition on `top` would lag a per-frame update and leave the
    // line chasing the clock. The stacked snap still uses the stylesheet one.
    const creeping = !stacked && current && now >= this.dayStart;
    this.playhead.style.transition = creeping ? "none" : "";
    this.playhead.hidden = false;
    this.playhead.style.top = `${top}px`;
    if (this.playheadTime) {
      const label = clock.format(now);
      if (this.playheadTime.textContent !== label) this.playheadTime.textContent = label;
    }

    if (creeping && !document.hidden) this.startPlayheadLoop();
    else this.stopPlayheadLoop();
  }

  startPlayheadLoop() {
    if (this.playheadFrame) return;
    const step = () => {
      this.playheadFrame = 0;
      if (!this.active || document.hidden) return;
      this.positionPlayhead();
    };
    this.playheadFrame = window.requestAnimationFrame(step);
  }

  stopPlayheadLoop() {
    if (!this.playheadFrame) return;
    window.cancelAnimationFrame(this.playheadFrame);
    this.playheadFrame = 0;
  }

  reset() {
    this.stopPlayheadLoop();
    this.playhead.hidden = true;
    this.playhead.style.transition = "";
    if (this.earlierButton) this.earlierButton.hidden = true;
    for (const row of this.rows) {
      row.element.hidden = false;
      row.element.classList.remove("is-past");
      for (const session of row.sessions) session.classList.remove("is-past", "is-live", "is-collapsed");
    }
    for (const overlay of this.overlays) overlay.classList.remove("is-past", "is-live", "is-collapsed");
    // The party overlay's top and height were measured against the collapsed
    // grid. Restoring the earlier rows moves its anchor, so measure again.
    this.program.positionLongService();
  }
}
