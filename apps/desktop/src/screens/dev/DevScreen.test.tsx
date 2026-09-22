import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { DevScreen } from "./DevScreen";
import { DEV_SECTIONS } from "./sections";

// The gallery renders every component in every variant twice (~3 s in jsdom, more under a full
// parallel run), so its tests get a longer timeout than the 5 s default.
const GALLERY_TIMEOUT = 20_000;

describe("DevScreen", { timeout: GALLERY_TIMEOUT }, () => {
  it("renders every section once per theme, side by side", () => {
    const { container } = render(<DevScreen />);
    const dark = container.querySelector<HTMLElement>('[data-theme="dark"]');
    const light = container.querySelector<HTMLElement>('[data-theme="light"]');
    expect(dark).not.toBeNull();
    expect(light).not.toBeNull();
    for (const panel of [dark, light] as HTMLElement[]) {
      for (const section of DEV_SECTIONS) {
        expect(
          within(panel).getByRole("heading", { level: 2, name: section.title }),
        ).toBeInTheDocument();
      }
    }
  });

  it("uses translated sample copy and working demos", async () => {
    const { container } = render(<DevScreen />);
    const dark = container.querySelector<HTMLElement>('[data-theme="dark"]') as HTMLElement;
    expect(within(dark).getAllByRole("button", { name: "Update all" }).length).toBeGreaterThan(0);

    await userEvent.click(within(dark).getByRole("button", { name: "560" }));
    const dialog = screen.getByRole("dialog", { name: "Suggest an idea" });
    expect(dark).toContainElement(dialog);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
