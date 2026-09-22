import { render, screen } from "@testing-library/react";
import "@/i18n";
import { ReviewCard } from "./ReviewCard";

describe("ReviewCard", () => {
  it("renders the review with its stars and helpful count", () => {
    render(
      <ReviewCard
        author="Alena K."
        initials="AK"
        date="2 September 2026"
        stars={5}
        text="Does exactly what it says."
        helpful={42}
      />,
    );
    expect(screen.getByRole("article")).toHaveTextContent("Alena K.");
    expect(screen.getByRole("img", { name: "5" })).toBeInTheDocument();
    expect(screen.getByText("42 found this helpful")).toBeInTheDocument();
  });
});
