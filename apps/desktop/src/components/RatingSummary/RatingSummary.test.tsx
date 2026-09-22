import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { changeLocale } from "@/i18n";
import { RatingSummary } from "./RatingSummary";
import { Stars } from "./Stars";

const histogram = [
  { stars: 5, pct: 62 },
  { stars: 4, pct: 24 },
  { stars: 3, pct: 8 },
  { stars: 2, pct: 4 },
  { stars: 1, pct: 2 },
];

describe("RatingSummary", () => {
  afterEach(async () => {
    await changeLocale("en");
  });

  it("shows the average, count and histogram", () => {
    render(
      <RatingSummary
        average={4.6}
        ratingsCount={781}
        histogram={histogram}
        myRating={0}
        onRate={() => {}}
      />,
    );
    expect(screen.getByText("4.6")).toBeInTheDocument();
    expect(screen.getByText("781 ratings")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.6" })).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("formats the average for the current language", async () => {
    await changeLocale("ru");
    render(
      <RatingSummary
        average={4.3}
        ratingsCount={2}
        histogram={[]}
        myRating={0}
        onRate={() => {}}
      />,
    );
    expect(screen.getByText("4,3")).toBeInTheDocument();
  });

  it("rates by click and by arrow keys", async () => {
    const onRate = vi.fn();
    render(
      <RatingSummary
        average={4.6}
        ratingsCount={10}
        histogram={histogram}
        myRating={3}
        onRate={onRate}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Rate this app" });
    const stars = within(group).getAllByRole("radio");
    expect(stars[2]).toHaveAttribute("aria-checked", "true");
    expect(stars[2]).toHaveAttribute("tabindex", "0");
    await userEvent.click(stars[4] as HTMLElement);
    expect(onRate).toHaveBeenLastCalledWith(5);
    (stars[2] as HTMLElement).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onRate).toHaveBeenLastCalledWith(2);
  });
});

describe("Stars", () => {
  it("fills stars up to the rounded value", () => {
    const { container } = render(<Stars value={3.6} />);
    expect(container.querySelectorAll(".on")).toHaveLength(4);
    expect(container.querySelectorAll(".off")).toHaveLength(1);
  });
});
