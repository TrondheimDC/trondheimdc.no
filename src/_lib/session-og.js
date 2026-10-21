/**
 * Build-time share images (og:image) for the talk pages, 1200×630 PNG.
 *
 * Laid out with satori (flexbox → SVG) and rasterised with resvg, in the style
 * of the hand-made og-program.png: light background, red wordmark, the date
 * line in yellow, the talk title large, and the speakers along the bottom.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: "#fefefe",
  fg: "#0f0f0f",
  muted: "#5b5b5b",
  date: "#faa31c",
  border: "#e4e4e4",
};

// satori reads woff/ttf, not woff2, so these come from @fontsource rather than
// assets/fonts. latin-ext follows latin under the same name as a fallback.
function fontFile(pkg, file) {
  return readFile(require.resolve(`@fontsource/${pkg}/files/${file}`));
}

let fontsPromise;
function loadFonts() {
  fontsPromise ??= Promise.all([
    ["space-grotesk", "Space Grotesk", 400],
    ["space-grotesk", "Space Grotesk", 600],
    ["ibm-plex-sans", "IBM Plex Sans", 400],
    ["ibm-plex-sans", "IBM Plex Sans", 600],
  ].flatMap(([pkg, name, weight]) => ["latin", "latin-ext"].map(async (subset) => ({
    name,
    weight,
    style: "normal",
    data: await fontFile(pkg, `${pkg}-${subset}-${weight}-normal.woff`),
  }))));
  return fontsPromise;
}

const assetCache = new Map();
function svgDataUri(path) {
  if (!assetCache.has(path)) {
    assetCache.set(path, readFile(new URL(`../assets/images/${path}`, import.meta.url))
      .then((svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`));
  }
  return assetCache.get(path);
}

// Speaker photos come from Sessionize's CDN. A failed fetch just drops the
// photo; the image is still worth having without it.
function remoteDataUri(url) {
  if (!url) return Promise.resolve(null);
  if (!assetCache.has(url)) {
    assetCache.set(url, fetch(url)
      .then(async (response) => {
        if (!response.ok) return null;
        const type = response.headers.get("content-type") || "image/jpeg";
        if (!/^image\/(png|jpeg)/.test(type)) return null;
        return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
      })
      .catch(() => null));
  }
  return assetCache.get(url);
}

// A tiny hyperscript so the layout below reads as a tree. satori lays out
// every element as flex, and wants an <img>'s size as attributes.
function h(type, style, ...children) {
  const kids = children.flat().filter((child) => child !== null && child !== undefined);
  if (type === "img") {
    const { src, width, height, ...css } = style;
    return { type, props: { src, width, height, style: { width, height, ...css } } };
  }
  return { type, props: { style: { display: "flex", ...style }, children: kids } };
}

function titleSize(title) {
  if (title.length <= 32) return 76;
  if (title.length <= 60) return 62;
  if (title.length <= 90) return 52;
  return 44;
}

/**
 * @param {object} talk { title, meta, speakers: [{ name, tagline, photo }] }
 * @returns {Promise<Buffer>} PNG
 */
export async function renderSessionImage({ title, meta, speakers }) {
  const [fonts, t, d, c, duck, photos] = await Promise.all([
    loadFonts(),
    svgDataUri("logos/letters/T-red.svg"),
    svgDataUri("logos/letters/D-red-long.svg"),
    svgDataUri("logos/letters/C-red.svg"),
    svgDataUri("8bit-duck.svg"),
    Promise.all(speakers.map((speaker) => remoteDataUri(speaker.photo))),
  ]);

  const avatar = speakers.length > 2 ? 64 : 88;
  const wordmark = 56;

  const tree = h("div", {
    width: WIDTH,
    height: HEIGHT,
    boxSizing: "border-box",
    flexDirection: "column",
    paddingTop: 64,
    paddingBottom: 64,
    paddingLeft: 84,
    paddingRight: 84,
    backgroundColor: COLORS.bg,
    color: COLORS.fg,
    fontFamily: "IBM Plex Sans",
  },
    h("div", { justifyContent: "space-between", alignItems: "center" },
      h("div", { alignItems: "center", gap: wordmark * 0.14 },
        h("img", { src: t, width: (wordmark * 40) / 52, height: wordmark }),
        h("img", { src: d, width: (wordmark * 154) / 52, height: wordmark }),
        h("img", { src: c, width: (wordmark * 40) / 52, height: wordmark }),
      ),
      h("img", { src: duck, width: 112, height: 112 }),
    ),
    h("div", {
      marginTop: 28,
      fontFamily: "Space Grotesk",
      fontSize: 30,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: COLORS.date,
    }, meta),
    h("div", {
      marginTop: 12,
      fontFamily: "Space Grotesk",
      fontWeight: 600,
      fontSize: titleSize(title),
      lineHeight: 1.08,
      letterSpacing: -1,
      // Clamp, so an essay of a title can't push the speakers off the card.
      display: "block",
      lineClamp: 3,
    }, title),
    h("div", { flexGrow: 1 }),
    speakers.length ? h("div", { alignItems: "center", gap: 40, flexWrap: "wrap" },
      speakers.map((speaker, index) => h("div", { alignItems: "center", gap: 18 },
        photos[index]
          ? h("img", { src: photos[index], width: avatar, height: avatar, borderRadius: avatar, border: `2px solid ${COLORS.border}`, objectFit: "cover" })
          : null,
        h("div", { flexDirection: "column", maxWidth: speakers.length === 1 ? 860 : 420 },
          h("div", { fontWeight: 600, fontSize: speakers.length > 2 ? 26 : 32 }, speaker.name),
          speakers.length === 1 && speaker.tagline
            ? h("div", { marginTop: 4, fontSize: 24, color: COLORS.muted, display: "block", lineClamp: 1 }, speaker.tagline)
            : null,
        ),
      )),
    ) : null,
  );

  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}
