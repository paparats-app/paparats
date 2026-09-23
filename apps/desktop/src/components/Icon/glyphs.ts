import { createLucideIcon, type LucideIcon, type LucideIconNode } from "lucide-react";

/**
 * Custom glyphs: the prototype's own drawings for the icons whose lucide 1.x glyph renders
 * visibly differently (another radius, arrow head, extra stroke or redrawn outline). Each one
 * goes through lucide-react's `createLucideIcon`, so it keeps the 24 × 24 grid, the Icon's
 * stroke width and round caps/joins, and the path data is the prototype's, verbatim
 * (`Paparats Prototype.dc.html`: `static ICONS` at line 1628, or the markup line named).
 * Every other prototype glyph is a stock lucide icon (see `registry.ts` and docs/decisions.md ›
 * "Icon glyph parity"); `Icon.test.tsx` pins both kinds against the prototype file.
 */

type Element =
  | ["path", { d: string }]
  | ["circle", { cx: string; cy: string; r: string }]
  | ["rect", { x: string; y: string; width: string; height: string; rx: string }]
  | ["line", { x1: string; x2: string; y1: string; y2: string }];

const path = (d: string): Element => ["path", { d }];
const circle = (cx: string, cy: string, r: string): Element => ["circle", { cx, cy, r }];
const rect = (x: string, y: string, width: string, height: string, rx: string): Element => [
  "rect",
  { x, y, width, height, rx },
];
const line = (x1: string, x2: string, y1: string, y2: string): Element => [
  "line",
  { x1, x2, y1, y2 },
];

function glyph(name: string, elements: readonly Element[]): LucideIcon {
  const node: LucideIconNode[] = elements.map(([tag, attributes], index) => [
    tag,
    { ...attributes, key: `${name}-${index}` },
  ]);
  return createLucideIcon(`paparats-${name}`, node);
}

/** Keyed by the registry name each glyph serves; the comment names the prototype source. */
export const PROTOTYPE_GLYPHS = {
  /** ICONS `arrow-right`: a 6-unit head (lucide's is 7). */
  "arrow-right": glyph("arrow-right", [path("M5 12h14"), path("m13 6 6 6-6 6")]),
  /** ICONS `badge-check`: the smaller check (m9 12 2 2 4-4). */
  "badge-check": glyph("badge-check", [
    path(
      "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
    ),
    path("m9 12 2 2 4-4"),
  ]),
  /** ICONS `book` (Library): an open book without a spine line. */
  "book-open": glyph("book-open", [
    path("M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2z"),
    path("M22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z"),
  ]),
  /** ICONS `briefcase`: with the waist line. */
  briefcase: glyph("briefcase", [
    rect("2", "7", "20", "14", "2"),
    path("M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"),
    path("M2 13h20"),
  ]),
  /** ICONS `camera`. */
  camera: glyph("camera", [
    path("M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"),
    circle("12", "13", "3.5"),
  ]),
  /** Markup line 1473 (Release idea dialog): r 9 circle, small check. */
  "circle-check": glyph("circle-check", [circle("12", "12", "9"), path("m9 12 2 2 4-4")]),
  /** Markup line 1553 (first launch Skip): 7-unit chevrons. */
  "chevrons-right": glyph("chevrons-right", [path("m5 5 7 7-7 7"), path("m13 5 7 7-7 7")]),
  /** ICONS `clock`: r 9. */
  clock: glyph("clock", [circle("12", "12", "9"), path("M12 7v5l3 2")]),
  /** Markup line 1140 (channel Copy address). */
  copy: glyph("copy", [
    rect("9", "9", "13", "13", "2"),
    path("M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"),
  ]),
  /** ICONS `crown`: pointed crown on a base line. */
  crown: glyph("crown", [path("M2.5 18 4.5 7l5 5 2.5-8 2.5 8 5-5 2 11z"), path("M3 21h18")]),
  /** ICONS `download`: arrow onto a line (neither lucide `download` nor `arrow-down-to-line`). */
  download: glyph("download", [path("M12 3v12"), path("m7 10 5 5 5-5"), path("M4 21h16")]),
  /** ICONS `more`: three 0.01-long dots (lucide `ellipsis` draws r 1 circles, bigger dots). */
  ellipsis: glyph("ellipsis", [path("M5 12h.01"), path("M12 12h.01"), path("M19 12h.01")]),
  /** Markup line 982 (app header alternative note). */
  "git-branch": glyph("git-branch", [
    line("6", "6", "3", "15"),
    circle("18", "6", "3"),
    circle("6", "18", "3"),
    path("M18 9a9 9 0 0 1-9 9"),
  ]),
  /** ICONS `globe`: r 9. */
  globe: glyph("globe", [
    circle("12", "12", "9"),
    path("M3 12h18"),
    path("M12 3a14 14 0 0 1 0 18"),
    path("M12 3a14 14 0 0 0 0 18"),
  ]),
  /** ICONS `graduation`: no tassel. */
  "graduation-cap": glyph("graduation-cap", [
    path("M22 10 12 5 2 10l10 5z"),
    path("M6 12v5c3 3 9 3 12 0v-5"),
  ]),
  /** ICONS `heart`. */
  heart: glyph("heart", [
    path(
      "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5c0 2.3 1.5 4 3 5.5l7 7z",
    ),
  ]),
  /** ICONS `home`: roof line over open walls and a door. */
  house: glyph("house", [
    path("M3 10.5 12 3l9 7.5"),
    path("M5 9.5V21h14V9.5"),
    path("M10 21v-6h4v6"),
  ]),
  /** ICONS `info` (Settings › About): r 9. */
  info: glyph("info", [circle("12", "12", "9"), path("M12 16v-4"), path("M12 8h.01")]),
  /** Markup lines 981 and 1156 (source / coverage notes): r 9 with a serifed "i". */
  "info-serif": glyph("info-serif", [
    circle("12", "12", "9"),
    path("M12 8h.01"),
    path("M11 12h1v4h1"),
  ]),
  /** ICONS `layers`: three flat chevron layers. */
  /** ICONS `grid` (Browse): rx 1.5 squares (lucide's are rx 1, which rasterise visibly squarer). */
  "layout-grid": glyph("layout-grid", [
    rect("3", "3", "7", "7", "1.5"),
    rect("14", "3", "7", "7", "1.5"),
    rect("3", "14", "7", "7", "1.5"),
    rect("14", "14", "7", "7", "1.5"),
  ]),
  layers: glyph("layers", [
    path("m12 2 9 4.5-9 4.5-9-4.5z"),
    path("m3 12 9 4.5 9-4.5"),
    path("m3 17.5 9 4.5 9-4.5"),
  ]),
  /** ICONS `leaf`. */
  leaf: glyph("leaf", [
    path("M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"),
    path("M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"),
  ]),
  /** ICONS `list`: rows at 6/12/18. */
  list: glyph("list", [
    path("M8 6h13"),
    path("M8 12h13"),
    path("M8 18h13"),
    path("M3 6h.01"),
    path("M3 12h.01"),
    path("M3 18h.01"),
  ]),
  /** Markup line 1242 (idea comments). */
  "message-circle": glyph("message-circle", [path("M7.9 20A9 9 0 1 0 4 16.1L2 22Z")]),
  /** ICONS `package`. */
  package: glyph("package", [
    path("M21 8 12 3 3 8v8l9 5 9-5z"),
    path("m3 8 9 5 9-5"),
    path("M12 13v8"),
  ]),
  /** ICONS `palette`. */
  palette: glyph("palette", [
    path("M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-9z"),
    circle("7.5", "10.5", "1"),
    circle("12", "7.5", "1"),
    circle("16.5", "10.5", "1"),
  ]),
  /** Markup line 1080 (Write a review). */
  "pen-line": glyph("pen-line", [
    path("M12 20h9"),
    path("M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"),
  ]),
  /** ICONS `pencil`: no ferrule line. */
  pencil: glyph("pencil", [path("M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z")]),
  /** ICONS `play`: a sharp triangle. */
  play: glyph("play", [path("M6 4v16l14-8z")]),
  /** Markup lines 39 and 1142 (Sync now): the arc stops short of the arrow. */
  "rotate-ccw": glyph("rotate-ccw", [path("M3 12a9 9 0 1 0 3-6.7"), path("M3 4v5h5")]),
  /** ICONS `search`: r 7.5 lens. */
  search: glyph("search", [circle("11", "11", "7.5"), path("m20.5 20.5-4.2-4.2")]),
  /** ICONS `settings`: the classic cog. */
  settings: glyph("settings", [
    circle("12", "12", "3"),
    path(
      "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    ),
  ]),
  /** ICONS `shield`. */
  shield: glyph("shield", [path("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z")]),
  /** ICONS `sliders`: knobs at 14/8/16. */
  "sliders-horizontal": glyph("sliders-horizontal", [
    path("M21 4h-7"),
    path("M10 4H3"),
    path("M21 12h-9"),
    path("M8 12H3"),
    path("M21 20h-5"),
    path("M12 20H3"),
    path("M14 2v4"),
    path("M8 10v4"),
    path("M16 18v4"),
  ]),
  /** ICONS `square` (window Maximize): 16-unit square. */
  square: glyph("square", [rect("4", "4", "16", "16", "2")]),
  /** ICONS `star`: the sharp star (also `Stars`' filled rating star). */
  star: glyph("star", [
    path("m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"),
  ]),
  /** ICONS `trash`: square lid handle, open body. */
  trash: glyph("trash", [
    path("M3 6h18"),
    path("M8 6V4h8v2"),
    path("M19 6l-1 14H6L5 6"),
    path("M10 11v6"),
    path("M14 11v6"),
  ]),
  /** ICONS `user`: head and an arc shoulder line. */
  user: glyph("user", [circle("12", "8", "4"), path("M4 21a8 8 0 0 1 16 0")]),
  /** ICONS `wrench`: sharp jaw. */
  wrench: glyph("wrench", [
    path(
      "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    ),
  ]),
  /** ICONS `zap`: sharp bolt. */
  zap: glyph("zap", [path("M13 2 3 14h9l-1 8 10-12h-9z")]),
} as const satisfies Record<string, LucideIcon>;
