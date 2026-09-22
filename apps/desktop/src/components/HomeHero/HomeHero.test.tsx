import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeHero, type HomeHeroProps } from "./HomeHero";

const slide = {
  kicker: "Discover",
  title: ["Great tools", "hide in plain sight."],
  body: "Paparats is a curated app store for Windows.",
  cta: "Explore apps",
  quote: "Sometimes the most valuable things are just waiting to be found.",
} as const;

function renderHero(overrides: Partial<HomeHeroProps> = {}) {
  const props: HomeHeroProps = {
    slide,
    onCta: vi.fn(),
    count: 4,
    index: 0,
    onIndexChange: vi.fn(),
    carouselLabel: "Highlights",
    previousLabel: "Previous",
    nextLabel: "Next",
    dotLabel: (i) => `Slide ${i + 1}`,
    ...overrides,
  };
  render(<HomeHero {...props} />);
  return props;
}

describe("HomeHero", () => {
  it("renders the slide and runs the CTA", async () => {
    const props = renderHero();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Great toolshide in plain sight.",
    );
    expect(screen.getByText(slide.quote)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Explore apps" }));
    expect(props.onCta).toHaveBeenCalledTimes(1);
  });

  it("wraps around with the arrows and jumps with the dots", async () => {
    const props = renderHero();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(props.onIndexChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onIndexChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: "Slide 3" }));
    expect(props.onIndexChange).toHaveBeenLastCalledWith(2);
  });

  it("toggles the first-launch glow", () => {
    const { container } = render(
      <HomeHero
        slide={slide}
        onCta={() => {}}
        count={1}
        index={0}
        onIndexChange={() => {}}
        carouselLabel="Highlights"
        previousLabel="Previous"
        nextLabel="Next"
        dotLabel={String}
        glow
      />,
    );
    expect(container.querySelector(".glowOn")).not.toBeNull();
    // A single slide has no controls.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });
});
