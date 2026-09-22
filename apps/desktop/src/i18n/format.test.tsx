import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeLocale } from ".";
import { useFormat } from "./format";

vi.mock("@/hooks/useToday", () => ({ useToday: () => "2026-09-15" }));

describe("useFormat", () => {
  afterEach(async () => {
    await changeLocale("en");
  });

  it("formats in the current language against the app's today", () => {
    const { result } = renderHook(() => useFormat());
    expect(result.current.size(18.4)).toBe("18.4 MB");
    expect(result.current.relative("2026-09-14")).toBe("yesterday");
  });

  it("follows language changes and stays stable otherwise", () => {
    const { result, rerender } = renderHook(() => useFormat());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    act(() => void changeLocale("ru"));
    expect(result.current).not.toBe(first);
    expect(result.current.date("2026-09-15").replace(/\s/g, " ")).toBe("15 сентября 2026 г.");
    expect(result.current.relative("2026-09-14")).toBe("вчера");
  });
});
