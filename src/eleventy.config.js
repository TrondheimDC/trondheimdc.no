export default function (eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("assets/images");
  eleventyConfig.addPassthroughCopy("assets/css");
  eleventyConfig.addPassthroughCopy("assets/js");

  // i18n translation filter
  eleventyConfig.addFilter("t", function (key, lang) {
    const i18n = this.ctx?.i18n || {};
    const strings = i18n[lang] || i18n["no"] || {};
    // Support dot notation: "nav.about"
    const parts = key.split(".");
    let val = strings;
    for (const part of parts) {
      val = val?.[part];
    }
    return val || key;
  });

  // Date formatting filter
  eleventyConfig.addFilter("date", function (value, format) {
    return new Date(value).toLocaleDateString("no-NO");
  });

  // Watch targets
  eleventyConfig.addWatchTarget("assets/css/");
  eleventyConfig.addWatchTarget("assets/js/");

  return {
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
