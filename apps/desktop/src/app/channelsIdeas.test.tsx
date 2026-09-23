// M5 "Channels and Ideas" end to end through the whole shell (renderApp): adding channels by
// address, by handle (community → trust confirmation) and from the catalog; the Browse Source
// group and the app page's install-source rule following what is followed and paused; the stale
// callout, sync, copy address and report on the channel page; proposing an idea, voting and
// commenting; the developer view taking and releasing it; the author's note and the 3-month Pro
// gift reaching the sidebar, Subscription and Profile. Fails on any console error or warning.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp } from "@/test/render";

const toast = () => useUiStore.getState().toast?.message;
const sidebar = () => within(screen.getByRole("navigation", { name: "Main" }));
const navItem = (name: RegExp) => sidebar().getByRole("button", { name });
const h1 = () => screen.getByRole("heading", { level: 1 });
const avatar = () => screen.getByRole("button", { name: "Profile" });
const sourcesPanel = () => within(screen.getByRole("region", { name: "Sources" }));
const pageHeader = () => {
  const el = h1().closest("header");
  if (!el) throw new Error("no header");
  return within(el);
};
const SOURCE_RULE =
  "Also offered by Winaero. Paparats installs and updates from the most trusted channel that offers an app.";

/** Long flows through the whole shell: generous under a loaded full-suite run. */
const LONG = { timeout: 20_000 };

const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");

beforeEach(() => {
  errors.mockClear();
  warnings.mockClear();
});

afterEach(() => {
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

async function start(route: string, services = createTestServices()) {
  const rendered = await renderApp({ route, services });
  // No navigation skeleton: every screen is on screen right after a click.
  await act(async () => {
    await useSettingsStore.getState().update({ animations: false });
  });
  return rendered;
}

async function setView(view: "user" | "developer") {
  await act(async () => {
    await useSettingsStore
      .getState()
      .update({ dev: view === "developer", viewAsDeveloper: view === "developer" });
  });
}

async function openBrowse(user: ReturnType<typeof userEvent.setup>) {
  await user.click(navItem(/^Browse/));
  await screen.findByRole("heading", { level: 1, name: /Browse/ });
}

async function openSources(user: ReturnType<typeof userEvent.setup>) {
  await user.click(navItem(/^Settings/));
  await user.click(await screen.findByRole("button", { name: "Sources" }));
  // The official catalog's row is always there once the channels have loaded.
  await within(await screen.findByRole("region", { name: "Sources" })).findByText("Always on");
}

describe("M5 channels in the shell", () => {
  it(
    "adds channels by address, handle and catalog; Browse and the app page follow",
    LONG,
    async () => {
      const user = userEvent.setup();
      const services = createTestServices();
      // Only the official catalog is followed.
      await services.channels.unsubscribe("nilesoft");
      await services.channels.unsubscribe("fossfriends");
      await start("/browse", services);
      await screen.findByRole("heading", { level: 1, name: /Browse/ });
      expect(screen.queryByRole("group", { name: "Source" })).toBeNull();

      // By address: a verified channel is followed at once.
      await openSources(user);
      expect(sourcesPanel().queryByRole("switch")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Add channel" }));
      let dialog = within(screen.getByRole("dialog", { name: "Add channel" }));
      await user.type(dialog.getByRole("textbox"), "https://nilesoft.org/paparats/{Enter}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(toast()).toBe("Subscribed to Nilesoft");
      expect(await sourcesPanel().findByRole("switch", { name: "Nilesoft" })).toBeChecked();

      // Two active channels: Browse gains the Source group with per-channel counts.
      await openBrowse(user);
      const group = within(screen.getByRole("group", { name: "Source" }));
      expect(group.getByRole("checkbox", { name: /Paparats/ })).toBeInTheDocument();
      expect(group.getByRole("checkbox", { name: /Nilesoft/ })).toBeInTheDocument();

      // By handle: a community channel asks for the trust confirmation first.
      await openSources(user);
      await user.click(screen.getByRole("button", { name: "Add channel" }));
      dialog = within(screen.getByRole("dialog", { name: "Add channel" }));
      await user.type(dialog.getByRole("textbox"), "@winaero{Enter}");
      const confirm = within(await screen.findByRole("dialog", { name: "Add Winaero?" }));
      expect(screen.queryByRole("dialog", { name: "Add channel" })).toBeNull();
      expect(confirm.getByText(/community channel/i)).toBeInTheDocument();
      await user.click(confirm.getByRole("button", { name: "Add channel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(toast()).toBe("Subscribed to Winaero");
      expect(await sourcesPanel().findByRole("switch", { name: "Winaero" })).toBeChecked();

      // The install-source rule: Winaero Tweaker comes from the official catalog, Winaero is named.
      await user.click(sourcesPanel().getByRole("button", { name: "Winaero" }));
      await screen.findByRole("heading", { level: 1, name: "Winaero" });
      const apps = within(screen.getByRole("list", { name: "Apps in this channel" }));
      await user.click(apps.getByRole("button", { name: "Details" }));
      await screen.findByRole("heading", { level: 1, name: "Winaero Tweaker" });
      expect(screen.getByText(SOURCE_RULE)).toBeInTheDocument();
      // A detail opened from a detail keeps the original origin: Back returns to Sources.
      await user.click(screen.getByRole("button", { name: "Back" }));
      await sourcesPanel().findByRole("switch", { name: "Winaero" });

      // Pausing Winaero takes it out of the rule and toasts.
      await user.click(sourcesPanel().getByRole("switch", { name: "Winaero" }));
      await waitFor(() => expect(toast()).toBe("Winaero paused"));
      expect(sourcesPanel().getByRole("switch", { name: "Winaero" })).not.toBeChecked();
      await user.click(sourcesPanel().getByRole("button", { name: "Winaero" }));
      await screen.findByRole("heading", { level: 1, name: "Winaero" });
      await user.click(
        within(screen.getByRole("list", { name: "Apps in this channel" })).getByRole("button", {
          name: "Details",
        }),
      );
      await screen.findByRole("heading", { level: 1, name: "Winaero Tweaker" });
      expect(screen.queryByText(SOURCE_RULE)).toBeNull();
      await openSources(user);

      // From the catalog: FOSS Friends is back, unreachable for 16 days → the stale callout.
      await user.click(screen.getByRole("button", { name: "Add channel" }));
      dialog = within(screen.getByRole("dialog", { name: "Add channel" }));
      const fossSubscribe = dialog
        .getAllByRole("button", { name: "Subscribe" })
        .find((button) => button.parentElement?.textContent?.includes("FOSS Friends"));
      if (!fossSubscribe) throw new Error("no Subscribe for FOSS Friends");
      await user.click(fossSubscribe);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(toast()).toBe("Subscribed to FOSS Friends");
      expect(
        await sourcesPanel().findByText("FOSS Friends hasn’t answered for 16 days."),
      ).toBeVisible();
      expect(sourcesPanel().getByRole("button", { name: "Keep" })).toBeInTheDocument();
      expect(sourcesPanel().getByRole("button", { name: "Unsubscribe" })).toBeInTheDocument();
    },
  );

  it(
    "the channel page: stale callout, sync, copy address, report, Keep, pause and unsubscribe",
    LONG,
    async () => {
      const user = userEvent.setup();
      const { services } = await start("/settings/sources");
      const copy = vi.spyOn(services.system, "copyToClipboard");
      await sourcesPanel().findByRole("switch", { name: "Nilesoft" });

      await user.click(sourcesPanel().getByRole("button", { name: "FOSS Friends" }));
      await screen.findByRole("heading", { level: 1, name: "FOSS Friends" });
      // Settings stays the active section; the callout is the page's too.
      expect(navItem(/^Settings/)).toHaveAttribute("aria-current", "page");
      expect(pageHeader().getByText("FOSS Friends hasn’t answered for 16 days.")).toBeVisible();

      await user.click(pageHeader().getByRole("button", { name: "Sync now" }));
      await waitFor(() => expect(toast()).toBe("FOSS Friends is still unreachable"));
      await user.click(pageHeader().getByRole("button", { name: "Copy address" }));
      expect(copy).toHaveBeenCalledWith("fossfriends.dev/channel");
      await waitFor(() => expect(toast()).toBe("Address copied"));

      await user.click(pageHeader().getByRole("button", { name: "Report a problem" }));
      const report = within(
        screen.getByRole("dialog", { name: "Report a problem with FOSS Friends" }),
      );
      await user.type(report.getByRole("textbox"), "Downloads time out");
      await user.click(report.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(toast()).toBe("Sent to FOSS Friends · copy to Paparats"));

      await user.click(pageHeader().getByRole("button", { name: "Keep" }));
      await waitFor(() => expect(pageHeader().queryByRole("button", { name: "Keep" })).toBeNull());

      // Back to Sources: the callout is gone there too; the row still says unreachable.
      await user.click(screen.getByRole("button", { name: "Back" }));
      await sourcesPanel().findByRole("switch", { name: "FOSS Friends" });
      expect(sourcesPanel().queryByText(/hasn’t answered/)).toBeNull();
      expect(sourcesPanel().getByText("Unreachable for 16 days")).toBeInTheDocument();

      // Pause and unsubscribe from the Nilesoft page.
      await user.click(sourcesPanel().getByRole("button", { name: "Nilesoft" }));
      await screen.findByRole("heading", { level: 1, name: "Nilesoft" });
      await user.click(pageHeader().getByRole("switch", { name: "Enabled" }));
      await waitFor(() => expect(toast()).toBe("Nilesoft paused"));
      expect(pageHeader().getByRole("switch", { name: "Paused" })).not.toBeChecked();
      await user.click(pageHeader().getByRole("button", { name: "Unsubscribe" }));
      await waitFor(() => expect(toast()).toBe("Unsubscribed from Nilesoft"));
      expect(pageHeader().getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Back" }));
      await sourcesPanel().findByRole("switch", { name: "FOSS Friends" });
      expect(sourcesPanel().queryByRole("switch", { name: "Nilesoft" })).toBeNull();
    },
  );
});

describe("M5 ideas in the shell", () => {
  it(
    "propose, vote, comment; the developer takes and releases; the author activates Pro",
    LONG,
    async () => {
      const user = userEvent.setup();
      await start("/ideas");
      await screen.findByRole("heading", { level: 1, name: "Ideas" });
      expect(avatar()).toHaveTextContent("SK");

      // Propose: a title under six characters is refused.
      await user.click(screen.getByRole("button", { name: "Suggest an idea" }));
      const suggest = within(screen.getByRole("dialog", { name: "Suggest an idea" }));
      await user.type(suggest.getByRole("textbox", { name: "Title" }), "Clip");
      await user.click(suggest.getByRole("button", { name: "Publish" }));
      expect(suggest.getByText("Give the idea a title of at least 6 characters.")).toBeVisible();
      await user.type(suggest.getByRole("textbox", { name: "Title" }), "board sync for every PC");
      await user.click(suggest.getByRole("button", { name: "Publish" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(toast()).toBe("Idea published — developers can see it now");
      await screen.findByRole("heading", { level: 1, name: "Clipboard sync for every PC" });
      expect(pageHeader().getByText("by You")).toBeInTheDocument();

      // The author's vote is counted; unvote and vote again.
      const vote = () => pageHeader().getByRole("button", { name: /votes?$/ });
      expect(vote()).toHaveAttribute("aria-pressed", "true");
      expect(vote()).toHaveAccessibleName("1 vote");
      await user.click(vote());
      await waitFor(() => expect(vote()).toHaveAttribute("aria-pressed", "false"));
      expect(vote()).toHaveAccessibleName("0 votes");
      await user.click(vote());
      await waitFor(() => expect(vote()).toHaveAttribute("aria-pressed", "true"));

      // Comment as the user.
      await user.type(screen.getByRole("textbox", { name: "Add to the discussion…" }), "Please!");
      await user.click(screen.getByRole("button", { name: "Post" }));
      const discussion = within(screen.getByRole("region", { name: /^Discussion/ }));
      expect(await discussion.findByText("Please!")).toBeInTheDocument();
      expect(discussion.getByText("You")).toBeInTheDocument();

      // The developer view: the avatar is the channel's monogram; take, then release.
      await setView("developer");
      expect(avatar()).toHaveTextContent("Ni");
      await user.click(pageHeader().getByRole("button", { name: "Take this idea" }));
      await waitFor(() => expect(toast()).toBe("Pinned to Nilesoft · author notified"));
      await user.click(await pageHeader().findByRole("button", { name: "Mark as released" }));
      const release = within(await screen.findByRole("dialog", { name: "Release the idea" }));
      const version = release.getByRole("textbox", { name: "Version" });
      await user.clear(version);
      await user.type(version, "2.0.0");
      await user.click(release.getByRole("button", { name: "Release" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(toast()).toMatch(/^Released · \d+ (person|people) notified$/);
      expect(pageHeader().getByText(/^Shipped as Nilesoft Shell 2\.0\.0 on /)).toBeInTheDocument();

      // The author (user view) sees the note and activates the gift: Pro everywhere.
      await setView("user");
      expect(avatar()).toHaveTextContent("SK");
      expect(navItem(/^Ideas/)).toHaveTextContent(/^Ideas2$/);
      await user.click(navItem(/^Ideas/));
      const note = await screen.findByRole("region", { name: "Your idea became an app" });
      expect(note).toHaveTextContent("Nilesoft Shell");
      await user.click(within(note).getByRole("button", { name: "Activate 3 months of Pro" }));
      await waitFor(() => expect(toast()).toBe("Paparats Pro is active until 15 December 2026"));
      expect(screen.queryByRole("region", { name: "Your idea became an app" })).toBeNull();
      expect(navItem(/^Ideas/)).toHaveTextContent(/^Ideas$/);
      expect(navItem(/^Subscription/)).toHaveTextContent(/^SubscriptionPro$/);

      await user.click(navItem(/^Subscription/));
      await screen.findByRole("heading", { level: 1, name: "Subscription" });
      expect(screen.getByText("Idea bonus · active until 15 December 2026")).toBeInTheDocument();
      await user.click(avatar());
      await screen.findByRole("heading", { level: 1, name: "Profile" });
      expect(screen.getAllByText(/Paparats Pro · gift/).length).toBeGreaterThan(0);
    },
  );
});
