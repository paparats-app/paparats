// Report a problem (prototype lines 1404–1416): title, routing line, Send gating, receipt toast.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { changeLocale } from "@/i18n";
import { ServiceError } from "@/services";
import type { ReportTarget } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { DialogHost } from "../DialogHost";
import { ToastHost } from "../ToastHost";

async function openReport(target: ReportTarget, services = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <DialogHost />
      <ToastHost />
    </>,
    { services },
  );
  act(() => useDialogStore.getState().open({ kind: "report", target }));
  return rendered;
}

describe("ReportDialog", () => {
  it("routes a channel report to its author with a copy to Paparats", async () => {
    const user = userEvent.setup();
    await openReport({ appId: null, channelId: "winaero" });
    const dialog = await screen.findByRole("dialog", { name: "Report a problem with Winaero" });
    expect(
      await within(dialog).findByText(
        "Your report goes to Sergey Tkachenko, the author of Winaero. Paparats receives a copy to spot channels that cause repeated problems.",
      ),
    ).toBeInTheDocument();
    const text = within(dialog).getByRole("textbox", { name: "What went wrong?" });
    expect(text).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Send" })).toBeDisabled();

    await user.type(text, "Tweaks reset after reboot");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("Sent to Winaero · copy to Paparats");
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("titles an app report with the app and sends only trimmed text", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const report = vi.spyOn(services.channels, "report");
    await openReport({ appId: "czkawka", channelId: "fossfriends" }, services);
    const dialog = await screen.findByRole("dialog", { name: "Report a problem with Czkawka" });
    expect(
      await within(dialog).findByText(
        /^Your report goes to Kasia L\., the author of FOSS Friends\./,
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "  Crashes on scan  ");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(useUiStore.getState().toast?.message).toBeDefined());
    expect(report).toHaveBeenCalledWith(
      { appId: "czkawka", channelId: "fossfriends" },
      "Crashes on scan",
    );
    expect(useUiStore.getState().toast?.message).toBe("Sent to FOSS Friends · copy to Paparats");
  });

  it("goes to the Paparats team for the official catalog", async () => {
    const user = userEvent.setup();
    await openReport({ appId: "vlc", channelId: "paparats" });
    const dialog = await screen.findByRole("dialog", { name: /^Report a problem with VLC/ });
    expect(
      await within(dialog).findByText("Your report goes to the Paparats team."),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "No sound");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(useUiStore.getState().toast?.message).toBe("Sent to Paparats"));
  });

  it("keeps the dialog and the text when sending fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    vi.spyOn(services.channels, "report").mockRejectedValue(new ServiceError("internal", "down"));
    await openReport({ appId: "shell", channelId: "nilesoft" }, services);
    const dialog = await screen.findByRole("dialog", {
      name: "Report a problem with Nilesoft Shell",
    });
    await user.type(within(dialog).getByRole("textbox"), "Broken");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Send" })).not.toHaveAttribute("aria-busy"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox")).toHaveValue("Broken");
    expect(useUiStore.getState().toast).toBeNull();
  });

  it("closes on Escape without sending", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const report = vi.spyOn(services.channels, "report");
    await openReport({ appId: "shell", channelId: "nilesoft" }, services);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });

  it("speaks Belarusian", async () => {
    await openReport({ appId: null, channelId: "nilesoft" });
    await act(() => changeLocale("be"));
    expect(await screen.findByRole("dialog", { name: "Праблема з Nilesoft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Адправіць" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Што пайшло не так?" })).toBeInTheDocument();
  });
});
