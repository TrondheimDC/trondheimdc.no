import { renderSessionImage } from "./_lib/session-og.js";

const DATE = {
  no: (value) => new Date(value).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" }),
  en: (value) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" }),
};

const time = (value) => new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));

// One share image per talk and language (the date line is translated), next
// to its page: /program/<id>/og.png and /en/program/<id>/og.png.
export default {
  data: {
    pagination: {
      data: "sessionize.schedule.sessions",
      size: 1,
      alias: "image",
      before: (sessions) => sessions
        .filter((session) => !session.isService)
        .flatMap((session) => ["no", "en"].map((lang) => ({ session, lang }))),
    },
    permalink: ({ image }) => `${image.lang === "en" ? "/en" : ""}/program/${image.session.id}/og.png`,
    eleventyExcludeFromCollections: true,
  },
  async render({ image: { session, lang }, sessionize, i18n }) {
    const room = session.roomName || i18n[lang].program.shared_session;
    const speakers = (session.speakers ?? [])
      .map((id) => sessionize.speakers.find((speaker) => speaker.id === id))
      .filter(Boolean)
      .map((speaker) => ({
        name: `${speaker.firstName} ${speaker.lastName}`,
        tagline: speaker.tagLine,
        photo: speaker.profilePicture,
      }));

    return renderSessionImage({
      title: session.title,
      meta: `${DATE[lang](session.startsAt)} · ${time(session.startsAt)} · ${room}`,
      speakers,
    });
  },
};
