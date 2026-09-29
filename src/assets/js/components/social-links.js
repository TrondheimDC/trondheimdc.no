// Social-link pills built from a speaker's [data-speaker-open] button
// attributes, for the speaker blocks inside the session dialog.
export function buildSocialLinks(twitter, linkedIn, blog) {
  const links = [];
  if (twitter) links.push(createSocialLink(`https://twitter.com/${twitter}`, "X (Twitter)"));
  if (linkedIn) links.push(createSocialLink(linkedIn, "LinkedIn"));
  if (blog) links.push(createSocialLink(blog, "Website"));
  return links;
}

function createSocialLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.className = "social-link";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}
