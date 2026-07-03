// FAQ accordion — progressive enhancement over the native <details>/<summary>
// rows in sections/faq.njk. Adds a smooth expand/collapse animation and keeps
// only one row open at a time. Without JS the questions still open and close
// (no animation, and more than one may be open), so the content is always
// reachable. Honours prefers-reduced-motion by skipping the height animation.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

class TdcFaq {
  constructor(root) {
    this.items = Array.from(root.querySelectorAll(".faq__item"));
    this.anims = new WeakMap();

    for (const item of this.items) {
      const summary = item.querySelector(".faq__q");
      if (!summary) continue;
      summary.addEventListener("click", (event) => {
        event.preventDefault();
        if (item.open) {
          this.close(item);
        } else {
          this.openExclusive(item);
        }
      });
    }
  }

  openExclusive(item) {
    // Accordion: collapse whichever row is currently open before opening this one.
    for (const other of this.items) {
      if (other !== item && other.open) this.close(other);
    }
    this.open(item);
  }

  open(item) {
    const panel = item.querySelector(".faq__a");
    item.open = true; // reveal content first so we can measure its height
    if (!this.canAnimate(panel)) return;
    this.cancel(item);
    const anim = panel.animate(
      [
        { blockSize: "0px", opacity: 0 },
        { blockSize: `${panel.scrollHeight}px`, opacity: 1 },
      ],
      { duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
    this.track(item, anim);
  }

  close(item) {
    const panel = item.querySelector(".faq__a");
    if (!this.canAnimate(panel)) {
      item.open = false;
      return;
    }
    this.cancel(item);
    const anim = panel.animate(
      [
        { blockSize: `${panel.scrollHeight}px`, opacity: 1 },
        { blockSize: "0px", opacity: 0 },
      ],
      { duration: 220, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
    // Keep the row [open] until the collapse finishes, then hide the content.
    anim.addEventListener("finish", () => {
      item.open = false;
    });
    this.track(item, anim);
  }

  canAnimate(panel) {
    return Boolean(panel) && !reducedMotion.matches && typeof panel.animate === "function";
  }

  track(item, anim) {
    this.anims.set(item, anim);
    anim.addEventListener("finish", () => {
      if (this.anims.get(item) === anim) this.anims.delete(item);
    });
  }

  cancel(item) {
    const current = this.anims.get(item);
    if (current) {
      current.cancel();
      this.anims.delete(item);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  for (const root of document.querySelectorAll(".faq")) {
    new TdcFaq(root);
  }
});
