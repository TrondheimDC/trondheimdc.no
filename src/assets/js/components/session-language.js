// Clones badge markup from the page rather than building it in JS, so
// components/session-language.njk stays the single source of the markup.

export function sessionLanguageBadge(card) {
  return card?.querySelector("[data-session-language]")?.cloneNode(true) ?? null;
}

export function languageBadge(root, code) {
  if (!code) return null;
  const template = root?.querySelector("template[data-language-badges]");
  const badge = template?.content.querySelector(`[data-session-language="${code}"]`);
  return badge ? badge.cloneNode(true) : null;
}

export function setLanguageSlot(slot, badge) {
  if (!slot) return;
  slot.replaceChildren(...(badge ? [badge] : []));
}
