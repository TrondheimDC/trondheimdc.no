class TdcProgramModal {
  constructor() {
    this.dialog = document.getElementById("program-description-modal");
    this.titleEl = document.getElementById("program-modal-title");
    this.bodyEl = document.getElementById("program-modal-body");

    if (!this.dialog || !this.titleEl || !this.bodyEl) return;

    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-session-open]");
      if (openButton) {
        this.open(openButton);
        return;
      }

      const closeButton = event.target.closest("[data-session-close]");
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
    const title = button.getAttribute("data-session-title") || "";
    const description = button.getAttribute("data-session-description") || "";

    this.titleEl.textContent = title;
    this.bodyEl.textContent = description;

    if (typeof this.dialog.showModal === "function") {
      this.dialog.showModal();
    } else {
      this.dialog.setAttribute("open", "");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new TdcProgramModal();
});
