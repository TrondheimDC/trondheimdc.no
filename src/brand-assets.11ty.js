import { brandFiles, renderBrandFile, zip, ZIP_NAME } from "./_lib/brand.js";

// Every brand file (logo SVG/PNG, social covers, README) at /brand/<path>,
// plus all of them in one zip. Drawn by _lib/brand.js at build time.
const files = brandFiles();
const byPath = new Map(files.map((file) => [file.path, file]));
const ZIP = { path: ZIP_NAME };

export default {
  data: {
    pagination: {
      data: "brandPaths",
      size: 1,
      alias: "brandPath",
    },
    brandPaths: [...files.map((file) => file.path), ZIP.path],
    permalink: ({ brandPath }) => `/brand/${brandPath}`,
    eleventyExcludeFromCollections: true,
  },
  async render({ brandPath }) {
    if (brandPath !== ZIP.path) return renderBrandFile(byPath.get(brandPath));
    const entries = await Promise.all(files.map(async (file) => ({ path: file.path, data: await renderBrandFile(file) })));
    return zip(entries);
  },
};
