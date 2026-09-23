import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import "@/i18n";
import { CommentThread, type CommentView } from "./CommentThread";

const comments: CommentView[] = [
  {
    id: "1",
    author: "Dzmitry P.",
    initials: "DP",
    date: "6 September 2026",
    text: "Ditto does part of this.",
  },
  {
    id: "2",
    author: "Nilesoft",
    initials: "Ni",
    date: "8 September 2026",
    text: "We're on it.",
    badge: { type: "developer", channel: "Nilesoft" },
    avatarTint: "#3b6fd1",
  },
  {
    id: "3",
    author: "Alena K.",
    initials: "AK",
    date: "9 September 2026",
    text: "Thanks!",
    badge: { type: "author" },
  },
];

function Harness({ onPost }: { onPost: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <CommentThread
      comments={comments}
      composer={{ value, onChange: setValue, onPost: () => onPost(value), initials: "SK" }}
    />
  );
}

describe("CommentThread", () => {
  it("renders comments with Developer and Author badges", () => {
    render(<CommentThread comments={comments} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Developer · Nilesoft")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();
  });

  it("shows the empty text without comments", () => {
    render(<CommentThread comments={[]} />);
    expect(screen.getByText("No comments yet. Start the discussion.")).toBeInTheDocument();
  });

  it("enables Post once there is text", async () => {
    const onPost = vi.fn();
    render(<Harness onPost={onPost} />);
    const post = screen.getByRole("button", { name: "Post" });
    expect(post).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Add to the discussion…" }), "   ");
    expect(post).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "Count me in");
    expect(post).toBeEnabled();
    expect(post).toHaveAttribute("data-variant", "primary");
    await userEvent.click(post);
    expect(onPost).toHaveBeenCalledWith("   Count me in");
  });
});

describe("CommentThread posting", () => {
  it("keeps Post busy and ignores a second submit while posting", async () => {
    const onPost = vi.fn();
    render(
      <CommentThread
        comments={[]}
        composer={{
          value: "Yes please",
          onChange: () => {},
          onPost,
          initials: "SK",
          posting: true,
        }}
      />,
    );
    const post = screen.getByRole("button", { name: "Post" });
    expect(post).toHaveAttribute("aria-busy", "true");
    await userEvent.click(post);
    expect(onPost).not.toHaveBeenCalled();
  });
});
