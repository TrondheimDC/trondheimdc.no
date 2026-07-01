class TdcSpeakerModal {
  constructor() {
    this.dialog = document.getElementById("speaker-description-modal");
    this.avatarEl = document.getElementById("speaker-modal-avatar");
    this.nameEl = document.getElementById("speaker-modal-name");
    this.taglineEl = document.getElementById("speaker-modal-tagline");
    this.bioEl = document.getElementById("speaker-modal-bio");
    this.socialsEl = document.getElementById("speaker-modal-socials");

    if (
      !this.dialog ||
      !this.avatarEl ||
      !this.nameEl ||
      !this.taglineEl ||
      !this.bioEl ||
      !this.socialsEl
    )
      return;

    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-speaker-open]");
      if (openButton) {
        this.open(openButton);
        return;
      }

      const closeButton = event.target.closest("[data-speaker-close]");
      if (closeButton) {
        this.dialog.close();
      }
    });

    this.dialog.addEventListener("click", (event) => {
      const rect = this.dialog.getBoundingClientRect();
      const insideDialog =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (!insideDialog) {
        this.dialog.close();
      }
    });
  }

  open(button) {
    const name = button.getAttribute("data-speaker-name") || "";
    const image = button.getAttribute("data-speaker-image") || "";
    const tagline = button.getAttribute("data-speaker-tagline") || "";
    const bio = button.getAttribute("data-speaker-bio") || "";
    const twitter = button.getAttribute("data-speaker-twitter") || "";
    const linkedIn = button.getAttribute("data-speaker-linkedin") || "";
    const blog = button.getAttribute("data-speaker-blog") || "";

    this.nameEl.textContent = name;
    this.avatarEl.src = image;
    this.avatarEl.alt = name;
    this.taglineEl.textContent = tagline;
    this.bioEl.textContent = bio;
    this.socialsEl.replaceChildren(...this.buildSocialLinks(twitter, linkedIn, blog));

    if (typeof this.dialog.showModal === "function") {
      this.dialog.showModal();
    } else {
      this.dialog.setAttribute("open", "");
    }
  }

  buildSocialLinks(twitter, linkedIn, blog) {
    const links = [];

    if (twitter) {
      links.push(this.createSocialLink(`https://twitter.com/${twitter}`, "𝕏"));
    }
    if (linkedIn) {
      links.push(this.createSocialLink(linkedIn, "in"));
    }
    if (blog) {
      links.push(this.createSocialLink(blog, "🔗"));
    }

    return links;
  }

  createSocialLink(href, label) {
    const link = document.createElement("a");
    link.href = href;
    link.className = "social-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new TdcSpeakerModal();
});
