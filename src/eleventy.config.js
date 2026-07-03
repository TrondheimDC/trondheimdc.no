import { RenderPlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  // Optional path prefix for staging deploys under a subpath.
  // Set via ELEVENTY_PATH_PREFIX env var; defaults to "/" (production root).
  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";

  // RenderPlugin enables {% renderFile %} so long-form prose can live in
  // Markdown files (_includes/content/{no,en}/*.md) and be rendered into sections.
  eleventyConfig.addPlugin(RenderPlugin);

  // Pass through static assets. The duck mascot ships as part of the normal
  // JS/CSS bundle; the duck-mate engine is lazy-loaded from assets/js at runtime.
  eleventyConfig.addPassthroughCopy("assets/images");
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("assets/css");
  eleventyConfig.addPassthroughCopy("assets/js");

  // i18n translation filter — UI strings/labels only. Supports dot notation
  // ("nav.about"). Long-form content uses Markdown + renderFile instead.
  eleventyConfig.addFilter("t", function (key, lang) {
    const i18n = this.ctx?.i18n || {};
    const strings = i18n[lang] || i18n["no"] || {};
    const parts = key.split(".");
    let val = strings;
    for (const part of parts) {
      val = val?.[part];
    }
    return val ?? key;
  });

  // Locale-aware date formatting. lang "en" -> en-GB, otherwise nb-NO.
  eleventyConfig.addFilter("date", function (value, lang) {
    const locale = lang === "en" ? "en-GB" : "nb-NO";
    return new Date(value).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  });

  // Extract time (HH:MM) from ISO 8601 datetime string
  eleventyConfig.addFilter("isoTime", function (value) {
    if (!value) return "";
    return value.substring(11, 16); // "2026-10-19T09:00:00" → "09:00"
  });

  // Resolve Sessionize objects by ID in templates.
  eleventyConfig.addFilter("speakerById", function (speakers, id) {
    if (!Array.isArray(speakers) || !id) return null;
    return speakers.find((speaker) => speaker.id === id) ?? null;
  });

  eleventyConfig.addFilter("roomById", function (rooms, id) {
    if (!Array.isArray(rooms) || !id) return null;
    return rooms.find((room) => room.id === id) ?? null;
  });

  eleventyConfig.addFilter("sessionById", function (sessions, id) {
    if (!Array.isArray(sessions) || !id) return null;
    return sessions.find((session) => session.id === id) ?? null;
  });

  // Watch targets
  eleventyConfig.addWatchTarget("assets/css/");
  eleventyConfig.addWatchTarget("assets/js/");

  return {
    pathPrefix,
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
