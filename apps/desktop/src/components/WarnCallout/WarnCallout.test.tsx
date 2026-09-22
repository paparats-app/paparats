import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarnCallout } from "./WarnCallout";

describe("WarnCallout", () => {
  it("renders the title, body and the action pair", async () => {
    const keep = vi.fn();
    const unsubscribe = vi.fn();
    render(
      <WarnCallout
        title="FOSS Friends hasn’t answered for 16 days."
        actions={[
          { label: "Keep", onClick: keep },
          { label: "Unsubscribe", onClick: unsubscribe, destructive: true },
        ]}
      >
        Installed apps keep working.
      </WarnCallout>,
    );
    expect(screen.getByText("FOSS Friends hasn’t answered for 16 days.")).toBeInTheDocument();
    expect(screen.getByText(/Installed apps keep working/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    await userEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect(keep).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("works as a plain note", () => {
    render(<WarnCallout>Not reviewed by Paparats.</WarnCallout>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
