// Plausible custom events and virtual page views. Safe to call when the script
// is missing, still loading, or blocked: the snippet in the layout queues calls.
export function trackEvent(name, props) {
  if (typeof window.plausible !== "function") return;
  if (props) window.plausible(name, { props });
  else window.plausible(name);
}

export function trackPageview(url) {
  if (typeof window.plausible !== "function") return;
  window.plausible("pageview", { u: url });
}
