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
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
