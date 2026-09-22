import { render, screen } from "@testing-library/react";
import { PromoCard } from "./PromoCard";

describe("PromoCard", () => {
  it("picks the variant's artwork by default", () => {
    const { container, rerender } = render(
      <PromoCard variant="updates" title="Better tools every day." body="Updates bring…" />,
    );
    expect(screen.getByText("Better tools every day.")).toBeInTheDocument();
    const card = () => container.firstElementChild as HTMLElement;
    expect(card()).toHaveClass("updates");
    expect(card().style.getPropertyValue("--art")).toContain("promo-updates");

    rerender(<PromoCard variant="profile" title="Good tools" body="Thanks" image="robot.webp" />);
    expect(card()).toHaveClass("profile");
    expect(card().style.getPropertyValue("--art")).toContain("robot.webp");
  });
});
