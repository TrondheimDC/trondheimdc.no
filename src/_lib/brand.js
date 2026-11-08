/**
 * Build-time brand assets for /brand/: the logo in every colour as SVG and
 * PNG, social-media covers, and one zip with all of it.
 *
 * Everything is drawn from the same letter paths as the site's wordmark
 * (assets/images/logos/letters/*.svg), so the files can't drift from the logo
 * people see on the page. SVGs are written by hand; PNGs are rasterised with
 * resvg and the covers are laid out with satori, as the talk share images are.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import site from "../_data/site.js";
import { loadFonts } from "./session-og.js";

// ── Palette ────────────────────────────────────────────────────────────────
// Mirrors the primitives in assets/css/00-settings/tokens.css.
export const COLORS = [
  { id: "green", name: "TDC Green", hex: "#9BF7A9", token: "--color-green-1" },
  { id: "red", name: "TDC Red", hex: "#FE6650", token: "--color-red-2" },
  { id: "yellow", name: "TDC Yellow", hex: "#FFD12E", token: "--color-yellow-2" },
  { id: "black", name: "Black", hex: "#0F0F0F", token: "--color-black" },
  { id: "white", name: "White", hex: "#FEFEFE", token: "--color-white-1" },
];
const HEX = Object.fromEntries(COLORS.map((color) => [color.id, color.hex]));

// The logo comes in four colours: green on dark, red on light (as the site
// does it), and plain black/white for one-colour print.
const MARK_COLORS = ["green", "red", "black", "white"];
const BACKDROP = { green: "dark", red: "light", black: "light", white: "dark" };

// ── Letterforms (52 units tall, from assets/images/logos/letters) ─────────
const LETTER_H = 52;
const T = { w: 39.8145, d: "M10.0986 17.333H0V0H39.8145V17.333H29.7178V52H10.0986Z" };
const C = { w: 39.8145, d: "M39.8145 17.333H19.9072V34.667H39.8145V52H17.3105C7.74943 52 0 44.2407 0 34.667V17.333C0 7.75938 7.74948 0 17.3105 0H39.8145Z" };
const D_LONG = { w: 153.732, d: "M153.732 34.667C153.732 44.2406 145.983 52 136.422 52H0V0H136.422C145.983 0 153.732 7.75938 153.732 17.333Z" };
const D_SHORT = { w: 39.81, d: "M0 0H22.5C32.06 0 39.81 7.76 39.81 17.333V34.667C39.81 44.24 32.06 52 22.5 52H0Z" };

// Wordmark = T · long D · C, spaced like .tdc-wordmark (gap 0.14 × height).
// Logo = T · D · C with a normal-width D, spaced like the favicon.
const MARKS = {
  wordmark: { letters: [T, D_LONG, C], gap: LETTER_H * 0.14 },
  logo: { letters: [T, D_SHORT, C], gap: 7.465 },
};

function markGeometry(kind) {
  const { letters, gap } = MARKS[kind];
  let x = 0;
  const paths = letters.map((letter) => {
    const path = `<path transform="translate(${round(x)} 0)" d="${letter.d}"/>`;
    x += letter.w + gap;
    return path;
  });
  return { width: round(x - gap), height: LETTER_H, paths: paths.join("") };
}

const round = (n) => Math.round(n * 1000) / 1000;

/** The wordmark or logo alone, tightly cropped, in one colour. */
export function markSvg(kind, color) {
  const { width, height, paths } = markGeometry(kind);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="${HEX[color]}">`
    + `<title>TDC</title>${paths}</svg>\n`;
}

/** The app icon: the logo on a rounded square, like the favicon. */
function iconSvg(theme, { radius = 10 } = {}) {
  const { width, height, paths } = markGeometry("logo");
  const [bg, fg] = theme === "dark" ? [HEX.black, HEX.green] : [HEX.white, HEX.red];
  const scale = 54 / width; // 5 units of margin each side of a 64 grid
  const y = (64 - height * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">`
    + `<title>TDC</title><rect width="64" height="64" rx="${radius}" fill="${bg}"/>`
    + `<g fill="${fg}" transform="translate(5 ${round(y)}) scale(${round(scale * 100000) / 100000})">${paths}</g></svg>\n`;
}

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// ── Social covers ──────────────────────────────────────────────────────────
// `safe` is the part every platform shows (YouTube crops hard on phones and
// TVs; stories hide the top and bottom under the UI).
export const COVERS = [
  { id: "linkedin-cover", label: "LinkedIn cover", width: 1128, height: 191 },
  { id: "linkedin-post", label: "LinkedIn / Open Graph", width: 1200, height: 627 },
  { id: "facebook-cover", label: "Facebook cover", width: 1640, height: 624, safe: [1640, 520] },
  { id: "x-header", label: "X / Bluesky header", width: 1500, height: 500, safe: [1500, 360] },
  { id: "youtube-banner", label: "YouTube banner", width: 2560, height: 1440, safe: [1546, 423] },
  { id: "instagram-post", label: "Instagram post", width: 1080, height: 1080 },
  { id: "instagram-story", label: "Instagram story", width: 1080, height: 1920, safe: [1080, 1420] },
  { id: "video-background", label: "Zoom / Teams background", width: 1920, height: 1080 },
  { id: "profile", label: "Profile picture", width: 800, height: 800, avatar: true },
];

const THEMES = {
  dark: { bg: HEX.black, mark: "green", meta: HEX.yellow },
  light: { bg: HEX.white, mark: "red", meta: "#EB7821" },
};

function coverMeta() {
  const [year, month, day] = site.date.split("-");
  return `${day}.${month}.${year} · ${site.venue}`;
}

function el(style, ...children) {
  return { type: "div", props: { style: { display: "flex", ...style }, children: children.flat() } };
}

async function renderCover(cover, theme) {
  const colors = THEMES[theme];
  const { width, height } = cover;
  const [safeW, safeH] = (cover.safe ?? [width, height]).map((n) => n * 0.86);

  let content;
  if (cover.avatar) {
    const logo = markGeometry("logo");
    const w = width * 0.6;
    content = { type: "img", props: { src: dataUri(markSvg("logo", colors.mark)), width: w, height: (w * logo.height) / logo.width } };
  } else {
    // One unit = the wordmark's height; the block is about 7 wide, 1.9 tall.
    // No "Trondheim Developer Conference" line: the name is just TDC now.
    const unit = Math.min(safeW / 7, safeH / 1.9);
    const mark = markGeometry("wordmark");
    content = el({ flexDirection: "column", alignItems: "center" },
      { type: "img", props: { src: dataUri(markSvg("wordmark", colors.mark)), width: (unit * mark.width) / mark.height, height: unit } },
      el({ marginTop: unit * 0.42, fontFamily: "Space Grotesk", fontSize: unit * 0.28, letterSpacing: unit * 0.01, textTransform: "uppercase", color: colors.meta }, coverMeta()),
    );
  }

  const tree = el({ width, height, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }, content);
  const svg = await satori(tree, { width, height, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

// ── The catalogue ──────────────────────────────────────────────────────────
const SIZES = { wordmark: [512, 1024, 2048], logo: [256, 512, 1024], icon: [180, 512, 1024] };

/**
 * Every brand file as { path, render }, path relative to /brand/. Synchronous
 * so Eleventy can paginate over it; nothing is drawn until render() is called.
 */
export function brandFiles() {
  const files = [];
  for (const kind of ["wordmark", "logo"]) {
    for (const color of MARK_COLORS) {
      const svg = markSvg(kind, color);
      files.push({ path: `logo/tdc-${kind}-${color}.svg`, render: () => svg });
      for (const size of SIZES[kind]) {
        files.push({ path: `logo/tdc-${kind}-${color}-${size}.png`, render: () => png(svg, size) });
      }
    }
  }
  for (const theme of ["dark", "light"]) {
    const svg = iconSvg(theme);
    files.push({ path: `logo/tdc-icon-${theme}.svg`, render: () => svg });
    for (const size of SIZES.icon) {
      files.push({ path: `logo/tdc-icon-${theme}-${size}.png`, render: () => png(svg, size) });
    }
  }
  for (const cover of COVERS) {
    for (const theme of ["dark", "light"]) {
      files.push({
        path: `social/tdc-${cover.id}-${theme}-${cover.width}x${cover.height}.png`,
        render: () => renderCover(cover, theme),
      });
    }
  }
  files.push({ path: "README.txt", render: readme });
  return files;
}

/** What the /brand/ page lists, with the paths above. */
export function brandCatalogue() {
  const marks = ["wordmark", "logo"].map((kind) => ({
    kind,
    variants: MARK_COLORS.map((color) => ({
      color,
      hex: HEX[color],
      backdrop: BACKDROP[color],
      svg: `logo/tdc-${kind}-${color}.svg`,
      pngs: SIZES[kind].map((size) => ({ size, path: `logo/tdc-${kind}-${color}-${size}.png` })),
    })),
  }));
  const icons = ["dark", "light"].map((theme) => ({
    theme,
    svg: `logo/tdc-icon-${theme}.svg`,
    pngs: SIZES.icon.map((size) => ({ size, path: `logo/tdc-icon-${theme}-${size}.png` })),
  }));
  const covers = COVERS.map((cover) => ({
    ...cover,
    files: ["dark", "light"].map((theme) => ({ theme, path: `social/tdc-${cover.id}-${theme}-${cover.width}x${cover.height}.png` })),
  }));
  return { marks, icons, covers, colors: COLORS, zip: ZIP_NAME };
}

export const ZIP_NAME = "tdc-brand-assets.zip";

function readme() {
  return [
    "TDC: brand assets",
    `${site.url}/brand/`,
    "",
    "logo/    The wordmark (long D), the compact logo and the app icon,",
    "         as SVG and PNG. Green goes on dark backgrounds, red on light,",
    "         black and white are for one-colour print.",
    "social/  Covers and profile pictures for LinkedIn, Facebook, X,",
    "         YouTube, Instagram, and video calls, in dark and light.",
    "",
    "Colours",
    ...COLORS.map((color) => `  ${color.name.padEnd(12)} ${color.hex}`),
    "",
    "Please",
    "  - keep clear space around the logo of at least the height of the T;",
    "  - don't stretch, recolour, outline or rearrange the letters;",
    "  - don't use the logo in a way that suggests TDC endorses you.",
    "",
    `Questions: ${site.email}`,
    "",
  ].join("\n");
}

// ── Zip (store only; PNGs are compressed already) ──────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zip(entries, folder = "tdc-brand-assets") {
  const locals = [];
  const centrals = [];
  let offset = 0;
  // A fixed timestamp keeps the zip byte-identical between builds.
  const time = 0;
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const { path, data } of entries) {
    const name = Buffer.from(`${folder}/${path}`);
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// Each file is drawn once per build, whether the page or the zip asks first.
const cache = new Map();
export function renderBrandFile(file) {
  if (!cache.has(file.path)) cache.set(file.path, Promise.resolve(file.render()));
  return cache.get(file.path);
}
