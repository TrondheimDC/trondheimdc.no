export default function(eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("assets");
  
  // Watch CSS and JS for changes
  eleventyConfig.addWatchTarget("assets/css/");
  eleventyConfig.addWatchTarget("assets/js/");

  // Load i18n data
  eleventyConfig.addGlobalData("i18n", () => {
    return import("./_data/i18n.js").then(m => m.default);
  });

  // Translation filter: {{ "nav.home" | t(lang) }}
  eleventyConfig.addFilter("t", function(key, lang = "no") {
    const keys = key.split(".");
    let value = this.ctx.i18n;
    for (const k of keys) {
      value = value?.[k];
    }
    return value?.[lang] || value?.["no"] || key;
  });

  // Date formatting
  eleventyConfig.addFilter("formatDate", (date, lang = "no") => {
    const options = { year: "numeric", month: "long", day: "numeric" };
    const locale = lang === "en" ? "en-US" : "nb-NO";
    return new Date(date).toLocaleDateString(locale, options);
  });

  // Current year
  eleventyConfig.addShortcode("year", () => new Date().getFullYear().toString());

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
}
