import { getDefaultNormalizer, render, screen, within } from "@testing-library/react";
import "@/i18n";
import { changeLocale } from "@/i18n";
import { IdeaCard } from "./IdeaCard";
import { RatingSummary } from "./RatingSummary";
import { ReviewCard } from "./ReviewCard";
import { VoteButton } from "./VoteButton";

const NBSP = "\u00a0";
/** Text matching that keeps the no-break space (the default normalizer turns it into a space). */
const exact = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

/**
 * Chromium ships no Belarusian ICU data: Chrome formats `be` as en-US, WebView2 as ru-BY
 * (docs/decisions.md D62). Node has the data, so the runtime is simulated by resolving `be` to
 * the fallback locale in `Intl.NumberFormat` and `Intl.DateTimeFormat`.
 */
function simulateRuntimeWithoutBelarusian(fallback: string): void {
  const Real = Intl;
  const resolve = (locales?: string | string[]) => (locales === "be" ? fallback : locales);
  class NumberFormat extends Real.NumberFormat {
    constructor(locales?: string | string[], options?: Intl.NumberFormatOptions) {
      super(resolve(locales), options);
    }
  }
  class DateTimeFormat extends Real.DateTimeFormat {
    constructor(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      super(resolve(locales), options);
    }
  }
  vi.stubGlobal(
    "Intl",
    Object.assign(Object.create(Real) as typeof Intl, { NumberFormat, DateTimeFormat }),
  );
}

describe.each([
  ["Chrome", "en-US"],
  ["WebView2", "ru-BY"],
])("numbers in Belarusian where the runtime lacks be (%s)", (_runtime, fallback) => {
  beforeEach(async () => {
    simulateRuntimeWithoutBelarusian(fallback);
    await changeLocale("be");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await changeLocale("en");
  });

  it("RatingSummary writes the average, bars and rate stars with the be patterns", () => {
    render(
      <RatingSummary
        average={4.6}
        ratingsCount={781}
        histogram={[
          { stars: 5, pct: 62 },
          { stars: 4, pct: 38 },
        ]}
        myRating={0}
        onRate={() => {}}
      />,
    );
    expect(screen.getByText("4,6")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4,6" })).toBeInTheDocument();
    expect(screen.getByText(`62${NBSP}%`, exact)).toBeInTheDocument();
    const group = screen.getByRole("radiogroup");
    expect(within(group).getByRole("radio", { name: "5" })).toBeInTheDocument();
  });

  it("VoteButton and IdeaCard group counts from five digits, like CLDR be", () => {
    render(<VoteButton votes={1204} voted={false} onVote={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent(/^1204$/);
    render(
      <IdeaCard
        title="Clipboard history"
        excerpt="Remembers everything I copy."
        votes={12345}
        voted={false}
        onVote={() => {}}
        kind={{ type: "new", categoryLabel: "Утыліты" }}
        status="open"
        author="Алена К."
        date="учора"
        comments={1204}
        onOpen={() => {}}
      />,
    );
    const article = screen.getByRole("article");
    expect(within(article).getByText(`12${NBSP}345`, exact)).toBeInTheDocument();
    expect(within(article).getByText("1204")).toBeInTheDocument();
  });

  it("ReviewCard labels its stars with the be number", () => {
    render(
      <ReviewCard
        author="Алена К."
        initials="АК"
        date="учора"
        stars={4}
        text="Добра."
        helpful={3}
      />,
    );
    expect(screen.getByRole("img", { name: "4" })).toBeInTheDocument();
  });
});
