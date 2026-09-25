// Wraps a synchronous DOM update in a View Transition when the browser
// supports it and the reader hasn't asked for reduced motion — a smooth
// cross-fade instead of the change just appearing/disappearing instantly.
// Feature-detected and skipped otherwise; the update itself always runs.
export function withViewTransition(update) {
  const supportsViewTransition = typeof document.startViewTransition === "function";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (supportsViewTransition && !reducedMotion) document.startViewTransition(update);
  else update();
}
