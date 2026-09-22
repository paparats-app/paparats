import { initials, pickLocalized, pickText } from "./text";
import { appById } from "./testFixtures";

describe("pickLocalized / pickText", () => {
  const shell = appById("shell");

  it("picks the value for the locale", () => {
    expect(pickLocalized(shell.tagline, "ru")).toBe("Ваше контекстное меню — ваши правила.");
    expect(pickText(shell.tagline, "be")).toBe("Ваша кантэкстнае меню — вашы правілы.");
  });

  it("falls back to English when a translation is missing", () => {
    const partial = { en: "Hello", be: undefined, ru: "Привет" } as unknown as typeof shell.tagline;
    expect(pickLocalized(partial, "be")).toBe("Hello");
  });

  it("returns user-written text as typed, whatever the locale", () => {
    expect(pickText("Мая ідэя", "en")).toBe("Мая ідэя");
  });
});

describe("initials", () => {
  it("takes the first letters of up to two words, upper-cased", () => {
    expect(initials("Serj Kaje")).toBe("SK");
    expect(initials("Alena K.")).toBe("AK");
    expect(initials("kasia lee smith")).toBe("KL");
    expect(initials("Аляксей")).toBe("А");
  });

  it("ignores extra whitespace and empty names", () => {
    expect(initials("  Maria   Sobal  ")).toBe("MS");
    expect(initials("")).toBe("");
  });
});
