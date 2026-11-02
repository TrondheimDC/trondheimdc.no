const ticketUrl = "";
const interestFormUrl = "https://forms.trondheimdc.no/s/8ryzaodaiETBBGcsxtzEspDk";
const sessionizeEventId = "";

export default {
  title: "TDC 2027",
  description: "TDC 2027",
  url: "https://2027.trondheimdc.no",
  date: "2027-10-25",
  venue: "Clarion Hotel Trondheim",
  email: "connect@trondheimdc.no",
  partnerEmail: "partner@trondheimdc.no",
  ticketUrl,
  interestFormUrl,
  partnerOrderUrl: "#partners",
  sessionizeEventId,
  // Plausible (self-hosted). The script ID is per site; PLAUSIBLE_HOST can be
  // set at build time to point at a local instance.
  analytics: {
    host: process.env.PLAUSIBLE_HOST || "https://stats.trondheimdc.no",
    scriptId: "pa-4c88CIgC6_1YQrqbyiT6m",
  },
  social: {
    facebook: "https://www.facebook.com/TDConf",
    linkedin: "https://www.linkedin.com/company/trondheimdc/",
    youtube: "https://www.youtube.com/@trondheimdc/videos",
    flickr: "https://www.flickr.com/people/trondheimdc/",
  },
  stats: {
    year: 2027,
    edition: "13th",
    tracks: 6,
    talks: "35+",
    attendees: "900+",
    partners: "30+",
    since: 2012,
  },
  // Sections appear once their data is set. Gated in home.njk, nav.njk,
  // hero.njk, default.njk, faq.njk and eleventy.config.js.
  featureFlags: {
    tickets: Boolean(ticketUrl),
    program: Boolean(sessionizeEventId),
    speakers: Boolean(sessionizeEventId),
    // No 2027 partner data yet; partners.js still lists 2026 partners.
    partners: false,
  },
};
