import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it.each([
    ["open", "Open"],
    ["work", "In work"],
    ["released", "Released"],
  ] as const)("renders the %s status", (status, label) => {
    render(<StatusPill status={status} label={label} />);
    expect(screen.getByText(label)).toHaveAttribute("data-status", status);
  });
});
