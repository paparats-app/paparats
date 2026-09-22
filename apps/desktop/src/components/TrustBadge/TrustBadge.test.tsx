import { render, screen } from "@testing-library/react";
import { TrustBadge } from "./TrustBadge";

describe("TrustBadge", () => {
  it.each([
    ["official", "shield"],
    ["verified", "badge-check"],
    ["community", "users"],
  ] as const)("uses the %s icon", (level, icon) => {
    render(<TrustBadge level={level} label={level} />);
    const badge = screen.getByText(level);
    expect(badge).toHaveAttribute("data-level", level);
    expect(badge.querySelector(`[data-icon="${icon}"]`)).not.toBeNull();
  });
});
