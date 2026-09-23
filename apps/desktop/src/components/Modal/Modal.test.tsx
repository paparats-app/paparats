import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Modal, ModalIcon } from "./Modal";

function ConfirmDemo({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Choose plan</Button>
      <Modal
        open={open}
        onClose={close}
        title="Confirm Paparats Pro"
        icon={<ModalIcon name="crown" />}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={close}>
              Confirm
            </Button>
          </>
        }
      >
        <p>You will be charged $4.99 today.</p>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("draws the header icon at 18px, stroke 2, like every prototype dialog", () => {
    const { container } = render(<ModalIcon name="flag" tone="neutral" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("stroke-width", "2");
  });

  it("is a labelled modal dialog that focuses the first footer button", async () => {
    render(<ConfirmDemo />);
    await userEvent.click(screen.getByRole("button", { name: "Choose plan" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm Paparats Pro" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("traps Tab inside and restores focus to the opener on close", async () => {
    const onClose = vi.fn();
    render(<ConfirmDemo onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Choose plan" });
    await userEvent.click(opener);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("closes on a backdrop press but not on a press inside", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Report a problem" closeLabel="Close" layout="form">
        <TextField aria-label="What went wrong?" />
      </Modal>,
    );
    expect(screen.getByRole("textbox", { name: "What went wrong?" })).toHaveFocus();
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    // The × is the prototype's 16px glyph at stroke 2 (lines 1373, 1423).
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.querySelector("svg")).toHaveAttribute("stroke-width", "2");
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Modal focus containment", () => {
  function WithPage({ onClose }: { onClose: () => void }) {
    return (
      <>
        <button type="button">Library</button>
        <p>Plain text on the page</p>
        <Modal
          open
          onClose={onClose}
          title="Report a problem"
          footer={<Button onClick={onClose}>Cancel</Button>}
        >
          <TextField aria-label="What went wrong?" />
        </Modal>
      </>
    );
  }

  it("brings back focus that leaves the dialog to where it was inside", async () => {
    render(<WithPage onClose={() => {}} />);
    const field = screen.getByRole("textbox", { name: "What went wrong?" });
    expect(field).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    // E.g. a press on the uncovered sidebar: the press works, the focus comes back.
    screen.getByRole("button", { name: "Library" }).focus();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on Escape pressed outside the dialog", async () => {
    const onClose = vi.fn();
    render(<WithPage onClose={onClose} />);
    (document.activeElement as HTMLElement).blur();
    expect(document.body).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
