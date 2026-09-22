import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionCard } from "./CollectionCard";

describe("CollectionCard", () => {
  it("renders the store and library variants", async () => {
    const onClick = vi.fn();
    render(
      <>
        <CollectionCard
          icon="laptop"
          title="Essential Windows Apps"
          subtitle="A great start for any setup."
          onClick={onClick}
        />
        <CollectionCard variant="library" icon="briefcase" title="Work" subtitle="5 apps" />
      </>,
    );
    const store = screen.getByRole("button", { name: /Essential Windows Apps/ });
    expect(store).toHaveAttribute("data-variant", "store");
    expect(screen.getByRole("button", { name: /Work/ })).toHaveAttribute("data-variant", "library");
    await userEvent.click(store);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
