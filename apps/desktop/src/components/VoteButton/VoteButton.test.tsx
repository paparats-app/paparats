import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { VoteButton } from "./VoteButton";

describe("VoteButton", () => {
  it("toggles the vote without bubbling to a clickable card", async () => {
    const onVote = vi.fn();
    const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <VoteButton votes={214} voted={false} onVote={onVote} />
      </div>,
    );
    const button = screen.getByRole("button", { name: "214 votes" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", "Vote");
    await userEvent.click(button);
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onCard).not.toHaveBeenCalled();
  });

  it("detail size shows the Vote/Voted label and formats the count", () => {
    render(<VoteButton votes={1204} voted size="detail" onVote={() => {}} />);
    const button = screen.getByRole("button", { name: "1,204 votes" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("1,204Voted");
  });
});
