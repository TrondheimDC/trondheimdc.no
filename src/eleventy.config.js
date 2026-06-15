import { RenderPlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  // Path prefix for preview/staging deploys (e.g. /secret_new_duck_site/)
  // Set via ELEVENTY_PATH_PREFIX env var, defaults to "/" for normal deploys
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
