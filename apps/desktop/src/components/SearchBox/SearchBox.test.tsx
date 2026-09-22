import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBox } from "./SearchBox";

function Controlled({ onOuterKeyDown }: { onOuterKeyDown?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div onKeyDown={onOuterKeyDown}>
      <SearchBox
        label="Search"
        placeholder="Search for apps…"
        value={value}
        onValueChange={setValue}
      />
    </div>
  );
}

describe("SearchBox", () => {
  it("is a labelled search field that reports every keystroke", async () => {
    render(<Controlled />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    await userEvent.type(input, "obs");
    expect(input).toHaveValue("obs");
  });

  it("clears on Escape without letting the key bubble", async () => {
    const outer = vi.fn();
    render(<Controlled onOuterKeyDown={outer} />);
    const input = screen.getByRole("searchbox");
    await userEvent.type(input, "vlc");
    outer.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(outer).not.toHaveBeenCalled();
    // An empty field lets Escape through (e.g. to close a panel).
    await userEvent.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("renders the compact variant", () => {
    render(
      <SearchBox variant="compact" label="Search filters" value="" onValueChange={() => {}} />,
    );
    expect(screen.getByRole("searchbox", { name: "Search filters" })).toBeInTheDocument();
  });
});
