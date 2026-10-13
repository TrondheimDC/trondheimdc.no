const ticketUrl = "";
const sessionizeEventId = "";
// Manual on/off per feature. The data check below can still hide a section.
const show = { tickets: false, program: false, speakers: false, partners: false };

export default {
  title: "TDC 2027",
  description: "TDC 2027",
  url: "https://2027.trondheimdc.no",
  date: "2027-10-25",
  venue: "Clarion Hotel Trondheim",
  email: "connect@trondheimdc.no",
  partnerEmail: "partner@trondheimdc.no",
  ticketUrl,
  partnerOrderUrl: "#partners",
  sessionizeEventId,
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
  // Sections hidden until their content is ready. Hidden code is kept, not
  // deleted: flip a flag to true to bring the feature back. Gated in
  // home.njk, nav.njk, hero.njk, default.njk, faq.njk and eleventy.config.js.
  // A section also needs its data: no ticketUrl or sessionizeEventId, no section.
  featureFlags: {
    tickets: Boolean(ticketUrl) && show.tickets,
    program: Boolean(sessionizeEventId) && show.program,
    speakers: Boolean(sessionizeEventId) && show.speakers,
    partners: show.partners,
  },
};
