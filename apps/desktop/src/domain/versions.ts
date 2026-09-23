// Version comparison — the same rules as the core's `paparats_inventory::version` (M7): the real
// inventory reports what Windows has installed, which may be newer than the catalog or spelled
// differently (`5.2.9.0` for `5.2.9`, `24.09` for `24.9`), so equality of strings is not enough.
//
// Rules: an optional leading `v` is ignored; build metadata after `+` is ignored; dot-separated
// components compare numerically by their leading digits (`01` = `1`, any length), then by any
// trailing text (a bare number beats `1a`-style suffixes); missing components count as `0`
// (`1.0` = `1.0.0`); a release beats its pre-releases (`2.0` > `2.0-rc.1`).

export type Ordering = -1 | 0 | 1;

function sign(n: number): Ordering {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

/** Plain ordinal comparison (the core compares ASCII-lowercased bytes). */
function compareText(a: string, b: string): Ordering {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Digit strings without leading zeros, of any length. */
function compareDigits(a: string, b: string): Ordering {
  return sign(a.length - b.length) || compareText(a, b);
}

/** `"0012abc"` → `["12", "abc"]` (digits without leading zeros, rest). */
function splitComponent(c: string): [string, string] {
  const digits = /^\d*/.exec(c)?.[0] ?? "";
  return [digits.replace(/^0+/, ""), c.slice(digits.length)];
}

function compareComponent(a: string, b: string): Ordering {
  const [an, ar] = splitComponent(a);
  const [bn, br] = splitComponent(b);
  const byNumber = compareDigits(an, bn);
  if (byNumber !== 0) return byNumber;
  if (ar === "" || br === "") return ar === br ? 0 : ar === "" ? 1 : -1;
  return compareText(ar.toLowerCase(), br.toLowerCase());
}

/** Semver pre-release identifiers: numeric < alphanumeric, numeric compared as numbers. */
function comparePrerelease(a: string, b: string): Ordering {
  const as = a.split(".");
  const bs = b.split(".");
  for (let i = 0; ; i++) {
    const x = as[i];
    const y = bs[i];
    if (x === undefined) return y === undefined ? 0 : -1;
    if (y === undefined) return 1;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    const ord =
      xNum && yNum
        ? compareDigits(x.replace(/^0+/, ""), y.replace(/^0+/, ""))
        : xNum
          ? -1
          : yNum
            ? 1
            : compareText(x.toLowerCase(), y.toLowerCase());
    if (ord !== 0) return ord;
  }
}

/** `[release, pre-release | null]`. */
function parts(version: string): [string, string | null] {
  let v = version.trim();
  if (v.startsWith("v") || v.startsWith("V")) v = v.slice(1);
  v = v.split("+")[0] ?? v;
  const dash = v.indexOf("-");
  return dash < 0 ? [v, null] : [v.slice(0, dash), v.slice(dash + 1)];
}

/** Orders two versions: -1 when `a` is older than `b`, 0 when equal, 1 when newer. */
export function compareVersions(a: string, b: string): Ordering {
  const [ar, ap] = parts(a);
  const [br, bp] = parts(b);
  const ac = ar.split(".");
  const bc = br.split(".");
  for (let i = 0; i < Math.max(ac.length, bc.length); i++) {
    const ord = compareComponent(ac[i] ?? "0", bc[i] ?? "0");
    if (ord !== 0) return ord;
  }
  if (ap === null || bp === null) return ap === bp ? 0 : ap === null ? 1 : -1;
  return comparePrerelease(ap, bp);
}

/** Whether the catalog's version is newer than the installed one (an update is available). */
export function isNewer(catalog: string, installed: string): boolean {
  return compareVersions(catalog, installed) > 0;
}
