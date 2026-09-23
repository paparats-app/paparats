/** Joins CSS class names, skipping falsy entries (`components/internal/cx` is private there). */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
