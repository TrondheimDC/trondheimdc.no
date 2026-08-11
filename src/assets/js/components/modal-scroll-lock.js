const MODAL_OPEN_CLASS = "modal-open";

export function lockModalScroll() {
  document.body.classList.add(MODAL_OPEN_CLASS);
}

export function unlockModalScroll() {
  if (document.querySelector("dialog[open]")) return;
  document.body.classList.remove(MODAL_OPEN_CLASS);
}