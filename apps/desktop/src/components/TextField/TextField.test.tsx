import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("wires the label and hint", () => {
    render(
      <TextField
        label="Channel address"
        hint="Paste a link from the author or a short code like @vitrazh."
        placeholder="https://… or @name"
        size="lg"
      />,
    );
    const input = screen.getByRole("textbox", { name: "Channel address" });
    expect(input).toHaveAccessibleDescription(
      "Paste a link from the author or a short code like @vitrazh.",
    );
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error instead of the hint and marks the input invalid", () => {
    render(
      <TextField
        label="Title"
        hint="A short, clear name"
        error="Give the idea a title of at least 6 characters."
      />,
    );
    const input = screen.getByRole("textbox", { name: "Title" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Give the idea a title of at least 6 characters.");
    expect(screen.queryByText("A short, clear name")).toBeNull();
  });

  it("passes input props through", async () => {
    const onChange = vi.fn();
    render(<TextField aria-label="Name" defaultValue="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Ana");
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
