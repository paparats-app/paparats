import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { IdeaCard, type IdeaCardProps } from "./IdeaCard";

function renderCard(overrides: Partial<IdeaCardProps> = {}) {
  const props: IdeaCardProps = {
    title: "Clipboard history with pinned snippets",
    excerpt: "A tray app that remembers everything I copy.",
    votes: 214,
    voted: false,
    onVote: vi.fn(),
    kind: { type: "new", categoryLabel: "Utilities" },
    status: "open",
    author: "Alena K.",
    date: "11 days ago",
    comments: 2,
    onOpen: vi.fn(),
    ...overrides,
  };
  render(<IdeaCard {...props} />);
  return props;
}

describe("IdeaCard", () => {
  it("renders the meta row for a new-app idea", () => {
    renderCard();
    expect(screen.getByText("New app · Utilities")).toBeInTheDocument();
    expect(screen.getByText("Open")).toHaveAttribute("data-status", "open");
    expect(screen.getByText("by Alena K.")).toBeInTheDocument();
    expect(screen.getByText("11 days ago")).toBeInTheDocument();
    expect(screen.getByTitle("2 comments")).toHaveTextContent("2");
  });

  it("renders the app chip, developer line and Take button", async () => {
    const onTake = vi.fn();
    const props = renderCard({
      kind: { type: "app", appName: "Shell", icon: { mono: "Sh", tint: "#3b6fd1" } },
      status: "work",
      developer: { tint: "#3b6fd1", label: "Nilesoft is on it" },
      onTake,
    });
    expect(screen.getByText("For Shell")).toBeInTheDocument();
    expect(screen.getByText("In work")).toBeInTheDocument();
    expect(screen.getByText("Nilesoft is on it")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Take" }));
    expect(onTake).toHaveBeenCalledTimes(1);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("opens from the title and the card surface, but not from the vote", async () => {
    const props = renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: "Clipboard history with pinned snippets" }),
    );
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText("A tray app that remembers everything I copy."));
    expect(props.onOpen).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "214 votes" }));
    expect(props.onVote).toHaveBeenCalledTimes(1);
    expect(props.onOpen).toHaveBeenCalledTimes(2);
  });
});
