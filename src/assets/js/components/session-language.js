// Session language badge helpers.
//
// The badge markup is rendered by components/session-language.njk, never built
// here: the program and speaker sections each ship a
// <template data-language-badges> holding one badge per language, and the code
// below clones out of it. That keeps a single source for the markup, and means
// the markup stays path-prefix correct without the templates having to hand
// asset URLs over as data attributes (see ELEVENTY_PATH_PREFIX in AGENTS.md).

/** The badge already rendered for a card, ready to clone into a dialog. */
export function sessionLanguageBadge(card) {
  return card?.querySelector("[data-session-language]")?.cloneNode(true) ?? null;
}

/** A badge for `code` ("en" / "no"), cloned from `root`'s template. */
export function languageBadge(root, code) {
  if (!code) return null;
  const template = root?.querySelector("template[data-language-badges]");
  const badge = template?.content.querySelector(`[data-session-language="${code}"]`);
  return badge ? badge.cloneNode(true) : null;
}

/** Puts `badge` (or nothing) into a dialog slot, replacing whatever was there. */
export function setLanguageSlot(slot, badge) {
  if (!slot) return;
  slot.replaceChildren(...(badge ? [badge] : []));
}
