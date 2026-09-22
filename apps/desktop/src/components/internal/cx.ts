/** Joins CSS class names, skipping falsy entries. Internal to `components/`. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
