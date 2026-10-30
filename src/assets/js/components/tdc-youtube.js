/**
 * <tdc-youtube video-id="…" title="…" play-label="…"> — click-to-play YouTube.
 *
 * Nothing is requested from YouTube until the reader presses play, so a talk
 * page doesn't set cookies or contact Google on load. The embed uses
 * youtube-nocookie.com. The element's children are the no-JavaScript
 * fallback (a plain link to the video), and they are replaced once it runs.
 *
 * Light DOM, like every other component here, so the design tokens apply.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAY_ICON = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';

class TdcYoutube extends HTMLElement {
  connectedCallback() {
    // Already set up (or reconnected after it was): nothing to do.
    if (this.querySelector(".tdc-youtube__play, iframe")) return;

    const id = this.getAttribute("video-id") ?? "";
    // Anything that isn't a YouTube id keeps the plain-link fallback.
    if (!VIDEO_ID.test(id)) return;

    const title = this.getAttribute("title") || "YouTube";
    const playLabel = this.getAttribute("play-label") || "Play";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tdc-youtube__play";
    button.setAttribute("aria-label", `${playLabel}: ${title}`);
    button.innerHTML = `<span class="tdc-youtube__icon">${PLAY_ICON}</span><span class="tdc-youtube__label">${playLabel}</span>`;
    button.addEventListener("click", () => this.play(id, title));

    this.replaceChildren(button);
  }

  play(id, title) {
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    this.replaceChildren(iframe);
  }
}

customElements.define("tdc-youtube", TdcYoutube);
