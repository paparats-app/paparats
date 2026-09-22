import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { FeaturedHero } from "./FeaturedHero";

describe("FeaturedHero", () => {
  it("uses the default kicker and 'Get <App>' CTA and the app tint", async () => {
    const onCta = vi.fn();
    const onIndexChange = vi.fn();
    render(
      <FeaturedHero
        app={{ name: "Obsidian", mono: "Ob", tint: "#6f5bd8" }}
        title={["Focus", "on what matters."]}
        body="Obsidian helps you think clearly."
        note="Your ideas belong here."
        onCta={onCta}
        count={3}
        index={0}
        onIndexChange={onIndexChange}
        carouselLabel="Featured"
        dotLabel={(i) => `Slide ${i + 1}`}
      />,
    );
    const hero = screen.getByRole("region", { name: "Featured" });
    expect(hero.style.getPropertyValue("--tint")).toBe("#6f5bd8");
    expect(hero).toHaveTextContent("Featured");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Focuson what matters.");
    await userEvent.click(screen.getByRole("button", { name: "Get Obsidian" }));
    expect(onCta).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Slide 2" }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});
