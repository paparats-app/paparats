import { render, screen } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("announces its message politely", () => {
    render(<Toast message="All updates installed" floating={false} />);
    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveTextContent("All updates installed");
    expect(toast.querySelector('[data-icon="check"]')).not.toBeNull();
  });
});
