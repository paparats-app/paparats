import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, IconButton } from "./Button";

describe("Button", () => {
  it("is a secondary 36px button by default and never submits forms", () => {
    render(<Button>Open</Button>);
    const button = screen.getByRole("button", { name: "Open" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("calls onClick and forwards the ref", async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} variant="primary" size="lg" leadingIcon="download" onClick={onClick}>
        Update all
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Update all" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.querySelector('[data-icon="download"]')).not.toBeNull();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Get
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Get" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a spinner and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading leadingIcon="refresh-cw" onClick={onClick}>
        Checking…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Checking…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector('[data-icon="loader-circle"]')).not.toBeNull();
    expect(button.querySelector('[data-icon="refresh-cw"]')).toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("is named by its label", async () => {
    const onClick = vi.fn();
    render(<IconButton icon="x" label="Close" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "ghost");
  });
});
