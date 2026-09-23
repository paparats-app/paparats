import { createFormat } from "@/i18n/createFormat";
import { downloadStatus, type DownloadStatusCopy } from "./downloadStatus";

const copy: DownloadStatusCopy = {
  queued: "Queued",
  installing: "Installing…",
  paused: "Paused",
  downloading: "Downloading",
  ofSize: (downloaded, size) => `${downloaded} of ${size}`,
};
const en = createFormat("en", "2026-09-15");
const ru = createFormat("ru", "2026-09-15");

describe("downloadStatus", () => {
  it("describes every queue state like the README", () => {
    expect(downloadStatus("downloading", 43, 87, copy, en)).toEqual({
      line: "Downloading… 43%",
      size: "37 MB of 87 MB",
      text: "Downloading… 43% · 37 MB of 87 MB",
    });
    // Paused: the one-line form drops the size (D31); the Library's second line keeps it.
    expect(downloadStatus("paused", 43.4, 87, copy, en)).toEqual({
      line: "Paused · 43%",
      size: "38 MB of 87 MB",
      text: "Paused · 43%",
    });
    expect(downloadStatus("queued", 0, 87, copy, en)).toEqual({
      line: "Queued",
      size: null,
      text: "Queued",
    });
    expect(downloadStatus("installing", 100, 87, copy, en)?.text).toBe("Installing…");
    for (const state of ["none", "installed", "update"] as const) {
      expect(downloadStatus(state, 0, 87, copy, en)).toBeNull();
    }
  });

  it("caps the percentage and the received size at 100 %", () => {
    expect(downloadStatus("downloading", 104, 10, copy, en)?.text).toBe(
      "Downloading… 100% · 10 MB of 10 MB",
    );
  });

  it("formats numbers and sizes per language", () => {
    const text = downloadStatus("downloading", 50, 12.5, copy, ru)?.text;
    expect(text).toBe(`Downloading… ${ru.percent(50)} · ${ru.size(6)} of ${ru.size(12.5)}`);
    expect(text).toMatch(/50\s%.*6\sМБ of 12,5\sМБ$/);
  });
});
