import { rovingIndex } from "./roving";

const all = () => true;

describe("rovingIndex", () => {
  it("moves and wraps", () => {
    expect(rovingIndex(0, "ArrowRight", 3, all)).toBe(1);
    expect(rovingIndex(2, "ArrowRight", 3, all)).toBe(0);
    expect(rovingIndex(0, "ArrowLeft", 3, all)).toBe(2);
    expect(rovingIndex(1, "Home", 3, all)).toBe(0);
    expect(rovingIndex(1, "End", 3, all)).toBe(2);
  });

  it("skips disabled entries", () => {
    const enabled = (i: number) => i !== 1;
    expect(rovingIndex(0, "ArrowDown", 3, enabled)).toBe(2);
    expect(rovingIndex(2, "ArrowUp", 3, enabled)).toBe(0);
    expect(rovingIndex(0, "End", 3, (i) => i === 0)).toBe(0);
  });

  it("respects the orientation and ignores other keys", () => {
    expect(rovingIndex(0, "ArrowDown", 3, all, "horizontal")).toBeNull();
    expect(rovingIndex(0, "ArrowRight", 3, all, "vertical")).toBeNull();
    expect(rovingIndex(0, "a", 3, all)).toBeNull();
    expect(rovingIndex(0, "ArrowRight", 0, all)).toBeNull();
    expect(rovingIndex(0, "ArrowRight", 3, () => false)).toBeNull();
  });
});
