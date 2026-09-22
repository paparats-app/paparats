import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextArea } from "./TextArea";

describe("TextArea", () => {
  it("is a labelled multi-line field with 4 rows by default", async () => {
    const onChange = vi.fn();
    render(<TextArea label="What went wrong?" onChange={onChange} />);
    const area = screen.getByRole("textbox", { name: "What went wrong?" });
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("rows", "4");
    await userEvent.type(area, "a{Enter}b");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("reports errors", () => {
    render(<TextArea aria-label="Description" error="Required" />);
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
