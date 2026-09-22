import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { PLACEHOLDER_SHOTS, ScreenshotViewer } from "./ScreenshotViewer";

describe("ScreenshotViewer", () => {
  it("draws placeholder frames and navigates with arrows and thumbnails", async () => {
    const onIndexChange = vi.fn();
    const { container } = render(
      <ScreenshotViewer
        shots={PLACEHOLDER_SHOTS}
        index={0}
        onIndexChange={onIndexChange}
        tint="#6f5bd8"
        previousLabel="Previous"
        nextLabel="Next"
      />,
    );
    const main = container.querySelector("figure") as HTMLElement;
    expect(main.querySelectorAll(".rect")).toHaveLength(PLACEHOLDER_SHOTS[0]?.length ?? 0);
    expect(screen.getByText("Screenshot 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);

    const thumb = screen.getByRole("button", { name: "Screenshot 3" });
    await userEvent.click(thumb);
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByRole("button", { name: "Screenshot 1" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows real images when a frame has a source", () => {
    const { container } = render(
      <ScreenshotViewer
        shots={[{ src: "shot.webp" }]}
        index={0}
        onIndexChange={() => {}}
        tint="#6f5bd8"
        previousLabel="Previous"
        nextLabel="Next"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "shot.webp");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
