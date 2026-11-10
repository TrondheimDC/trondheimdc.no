import { brandFiles, emojiFiles, renderBrandFile, zip, ZIP_NAME, EMOJI_ZIP_NAME } from "./_lib/brand.js";

// Every brand file (logo SVG/PNG, social covers, Slack emoji, README) at
// /brand/<path>, plus all of them in one zip and the Slack emoji in their own
// zip. Drawn by _lib/brand.js at build time.
const files = brandFiles();
const byPath = new Map(files.map((file) => [file.path, file]));
const ZIP = { path: ZIP_NAME };
const EMOJI_ZIP = { path: EMOJI_ZIP_NAME };
const emojiEntries = emojiFiles().map(({ path }) => ({ path: path.slice("slack-emoji/".length), file: byPath.get(path) }));

export default {
  data: {
    pagination: {
      data: "brandPaths",
      size: 1,
      alias: "brandPath",
    },
    brandPaths: [...files.map((file) => file.path), ZIP.path, EMOJI_ZIP.path],
    permalink: ({ brandPath }) => `/brand/${brandPath}`,
    eleventyExcludeFromCollections: true,
  },
  async render({ brandPath }) {
    if (brandPath === ZIP.path) {
      const entries = await Promise.all(files.map(async (file) => ({ path: file.path, data: await renderBrandFile(file) })));
      return zip(entries);
    }
    if (brandPath === EMOJI_ZIP.path) {
      const entries = await Promise.all(emojiEntries.map(async ({ path, file }) => ({ path, data: await renderBrandFile(file) })));
      return zip(entries, "tdc-slack-emoji");
    }
    return renderBrandFile(byPath.get(brandPath));
  },
};
