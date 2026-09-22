/**
 * Next index for arrow-key navigation in a one-dimensional composite (tabs, segmented control,
 * menu). Wraps around, skips disabled entries. Returns `null` for keys it does not handle, or
 * when nothing is enabled. Internal to `components/`.
 */
export function rovingIndex(
  current: number,
  key: string,
  count: number,
  isEnabled: (index: number) => boolean,
  orientation: "horizontal" | "vertical" | "both" = "both",
): number | null {
  const forward =
    (orientation !== "vertical" && key === "ArrowRight") ||
    (orientation !== "horizontal" && key === "ArrowDown");
  const backward =
    (orientation !== "vertical" && key === "ArrowLeft") ||
    (orientation !== "horizontal" && key === "ArrowUp");

  const scan = (start: number, step: 1 | -1): number | null => {
    for (let n = 0, i = start; n < count; n += 1, i = (i + step + count) % count) {
      if (isEnabled(i)) return i;
    }
    return null;
  };

  if (count === 0) return null;
  if (key === "Home") return scan(0, 1);
  if (key === "End") return scan(count - 1, -1);
  if (forward) return scan((current + 1 + count) % count, 1);
  if (backward) return scan((current - 1 + count) % count, -1);
  return null;
}
