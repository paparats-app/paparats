import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders the requested element with its content", () => {
    render(
      <Card as="section" aria-label="Library stats" padding="lg" radius={12}>
        Stats
      </Card>,
    );
    const card = screen.getByRole("region", { name: "Library stats" });
    expect(card.tagName).toBe("SECTION");
    expect(card).toHaveTextContent("Stats");
  });

  it("forwards the ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>x</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
