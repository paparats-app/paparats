import { render, screen } from "@testing-library/react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code,
  ExternalLink,
  Flag,
  Folder,
  Gamepad2,
  HardDrive,
  Infinity as InfinityIcon,
  LaptopMinimal,
  Lightbulb,
  Lock,
  Mail,
  Minus,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcwClock,
  Rss,
  TriangleAlert,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import catalog from "@fixtures/catalog.json";
import library from "@fixtures/library.json";
import prototypeHtml from "../../../../../design_handoff_paparats_store/Paparats Prototype.dc.html?raw";
import { Icon } from "./Icon";
import { PROTOTYPE_GLYPHS } from "./glyphs";
import { ICONS, isIconName, type IconName } from "./registry";

describe("Icon", () => {
  it("is decorative by default, with the design stroke", () => {
    const { container } = render(<Icon name="layout-grid" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
  });

  it("gets an accessible name when labelled", () => {
    render(<Icon name="search" size={18} strokeWidth={2} label="Search" />);
    const svg = screen.getByRole("img", { name: "Search" });
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("stroke-width", "2");
  });

  it("lets a call site square the caps (window controls)", () => {
    const { container } = render(
      <Icon name="x" size={10} strokeWidth={2.2} strokeLinecap="butt" strokeLinejoin="miter" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("stroke-linecap", "butt");
    expect(svg).toHaveAttribute("stroke-linejoin", "miter");
  });

  it("draws a visible fallback for an unknown name", () => {
    const { container } = render(<Icon name="no-such-icon" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-missing-icon", "true");
  });

  it("resolves the legacy lucide spellings", () => {
    for (const name of ["home", "trash-2", "history"]) expect(isIconName(name)).toBe(true);
    expect(ICONS.home).toBe(ICONS.house);
    expect(ICONS["trash-2"]).toBe(ICONS.trash);
    expect(ICONS.history).toBe(ICONS["rotate-ccw-clock"]);
  });

  it("covers every icon named by the fixtures", () => {
    const named = [
      ...catalog.categories.map((c) => c.icon),
      ...catalog.collections.map((c) => c.icon),
      ...library.collections.map((c) => c.icon),
    ];
    expect(named.filter((n) => !isIconName(n))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Glyph parity: every glyph of the prototype (`static ICONS` and the inline <svg>s of its markup)
// is pinned to the registry name that draws it, and to what draws it — a stock lucide icon
// (`LucideIcon`) or the prototype's own path data (`"prototype"`, from `glyphs.ts`).

type Element = [tag: string, attributes: Record<string, string>];
type Pin = readonly [name: IconName, glyph: LucideIcon | "prototype"];
type MarkupPin = readonly [name: IconName, glyph: LucideIcon | "prototype", d: string];

const markup = prototypeHtml.slice(0, prototypeHtml.indexOf('<script type="text/x-dc"'));
const iconsJson = /static ICONS = (\{.*?\});\n/.exec(prototypeHtml)?.[1] ?? "{}";
const PROTOTYPE_ICONS = JSON.parse(iconsJson) as Record<string, Element[]>;

function parseChildren(svgInner: string): Element[] {
  return [...svgInner.matchAll(/<(path|circle|rect|line)\b([^>]*)>/g)].map(
    ([, tag = "", attrs]) => [
      tag,
      Object.fromEntries(
        [...(attrs ?? "").matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
      ),
    ],
  );
}

const canonical = (elements: readonly Element[]) =>
  JSON.stringify(elements.map(([tag, attrs]) => [tag, Object.entries(attrs).sort()]));

/** The distinct inline glyphs of the markup (24-unit viewBox, not data-bound, not in ICONS). */
const iconSet = new Set(Object.values(PROTOTYPE_ICONS).map(canonical));
const MARKUP_GLYPHS = new Map<string, Element[]>();
for (const [, attrs = "", inner = ""] of markup.matchAll(/<svg\b([^>]*)>(.*?)<\/svg>/gs)) {
  if (!attrs.includes('viewBox="0 0 24 24"') || inner.includes("{{")) continue;
  const elements = parseChildren(inner);
  const key = canonical(elements);
  if (!iconSet.has(key)) MARKUP_GLYPHS.set(key, elements);
}

function rendered(name: IconName): Element[] {
  const { container, unmount } = render(<Icon name={name} />);
  const svg = container.querySelector("svg");
  const elements = [...(svg?.children ?? [])].map((child): Element => [
    child.tagName.toLowerCase(),
    Object.fromEntries([...child.attributes].map((a) => [a.name, a.value])),
  ]);
  unmount();
  return elements;
}

/** `static ICONS` name → registry name and glyph. */
const ICON_PINS: Record<string, Pin> = {
  rss: ["rss", Rss],
  "badge-check": ["badge-check", "prototype"],
  alert: ["triangle-alert", TriangleAlert],
  home: ["house", "prototype"],
  grid: ["layout-grid", "prototype"],
  layers: ["layers", "prototype"],
  download: ["download", "prototype"],
  book: ["book-open", "prototype"],
  crown: ["crown", "prototype"],
  settings: ["settings", "prototype"],
  search: ["search", "prototype"],
  user: ["user", "prototype"],
  "chevron-down": ["chevron-down", ChevronDown],
  "chevron-up": ["chevron-up", ChevronUp],
  "chevron-right": ["chevron-right", ChevronRight],
  "chevron-left": ["chevron-left", ChevronLeft],
  "arrow-right": ["arrow-right", "prototype"],
  check: ["check", Check],
  x: ["x", X],
  more: ["ellipsis", "prototype"],
  list: ["list", "prototype"],
  laptop: ["laptop", LaptopMinimal],
  code: ["code", Code],
  palette: ["palette", "prototype"],
  play: ["play", "prototype"],
  wrench: ["wrench", "prototype"],
  leaf: ["leaf", "prototype"],
  gamepad: ["gamepad-2", Gamepad2],
  graduation: ["graduation-cap", "prototype"],
  infinity: ["infinity", InfinityIcon],
  zap: ["zap", "prototype"],
  heart: ["heart", "prototype"],
  users: ["users", Users],
  shield: ["shield", "prototype"],
  bell: ["bell", Bell],
  folder: ["folder", Folder],
  sliders: ["sliders-horizontal", "prototype"],
  info: ["info", "prototype"],
  lock: ["lock", Lock],
  monitor: ["monitor", Monitor],
  mail: ["mail", Mail],
  globe: ["globe", "prototype"],
  clock: ["clock", "prototype"],
  camera: ["camera", "prototype"],
  star: ["star", "prototype"],
  refresh: ["refresh-cw", RefreshCw],
  external: ["external-link", ExternalLink],
  plus: ["plus", Plus],
  pencil: ["pencil", "prototype"],
  briefcase: ["briefcase", "prototype"],
  minus: ["minus", Minus],
  square: ["square", "prototype"],
  package: ["package", "prototype"],
  hdd: ["hard-drive", HardDrive],
  trash: ["trash", "prototype"],
  history: ["history", RotateCcwClock],
};

/** Inline markup glyphs, found by one of their path `d`s (markup lines in the label). */
const MARKUP_PINS: Record<string, MarkupPin> = {
  "sync (39, 1142)": ["rotate-ccw", "prototype", "M3 12a9 9 0 1 0 3-6.7"],
  "wifi-off (40, 128, 178)": ["wifi-off", WifiOff, "m2 2 20 20"],
  "lightbulb (85, 1029, 1191, 1421)": ["lightbulb", Lightbulb, "M9 18h6"],
  "info note (981, 1156)": ["info-serif", "prototype", "M11 12h1v4h1"],
  "git-branch (982)": ["git-branch", "prototype", "M18 9a9 9 0 0 1-9 9"],
  "flag (1045, 1141, 1407)": [
    "flag",
    Flag,
    "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",
  ],
  "pen-line (1080)": ["pen-line", "prototype", "M12 20h9"],
  "copy (1140)": ["copy", "prototype", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  "vote chevron (1230, 1287)": ["chevron-up", ChevronUp, "m6 15 6-6 6 6"],
  "message-circle (1242)": ["message-circle", "prototype", "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  "circle-check (1473)": ["circle-check", "prototype", "m9 12 2 2 4-4"],
  "chevrons-right (1553)": ["chevrons-right", "prototype", "m13 5 7 7-7 7"],
};

function markupGlyph(d: string): Element[] | undefined {
  return [...MARKUP_GLYPHS.values()].find((elements) =>
    elements.some(([, attrs]) => attrs.d === d),
  );
}

describe("Icon glyph parity with the prototype", () => {
  it("reads the prototype's icon set", () => {
    expect(Object.keys(PROTOTYPE_ICONS).length).toBe(56);
    expect(MARKUP_GLYPHS.size).toBe(12);
  });

  it("pins every icon of the prototype's ICONS set, and only those", () => {
    expect(Object.keys(ICON_PINS).sort()).toEqual(Object.keys(PROTOTYPE_ICONS).sort());
  });

  it.each(Object.entries(ICON_PINS))("ICONS %s", (protoName, [name, glyph]) => {
    if (glyph === "prototype") {
      expect(canonical(rendered(name))).toBe(canonical(PROTOTYPE_ICONS[protoName] ?? []));
      expect(Object.values(PROTOTYPE_GLYPHS)).toContain(ICONS[name]);
    } else {
      expect(ICONS[name]).toBe(glyph);
    }
  });

  it("pins every inline glyph of the markup", () => {
    const found = Object.values(MARKUP_PINS).map(([, , d]) => markupGlyph(d));
    expect(found.every(Boolean)).toBe(true);
    expect(new Set(found.map((elements) => canonical(elements ?? []))).size).toBe(
      MARKUP_GLYPHS.size,
    );
  });

  it.each(Object.entries(MARKUP_PINS))("markup %s", (_, [name, glyph, d]) => {
    if (glyph === "prototype") {
      expect(canonical(rendered(name))).toBe(canonical(markupGlyph(d) ?? []));
    } else {
      expect(ICONS[name]).toBe(glyph);
    }
  });

  it("uses every custom glyph for a prototype glyph", () => {
    const pinned = new Set(
      [...Object.values(ICON_PINS), ...Object.values(MARKUP_PINS)].map(([name]) => ICONS[name]),
    );
    expect(Object.values(PROTOTYPE_GLYPHS).filter((glyph) => !pinned.has(glyph))).toEqual([]);
  });
});
