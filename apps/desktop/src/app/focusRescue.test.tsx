// The focus rescue (D61): a keyboard user's focus that would fall to <body> when its row or block
// disappears goes to the neighbour the next Tab would reach — Library ⋯ → Uninstall, the stale
// callout's Keep / Unsubscribe (Settings › Sources and the channel page), the Ideas note ×, an idea
// card's Take and Cancel plan — and focus let go on purpose is left alone.
import { act, screen, waitFor, within } from "@testing-library/react";
import { createTestServices } from "@/test/render";
import { content, openScreen } from "@/screens/shared/a11yTesting";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { neighbourOf, removalSpot } from "./focusRescue";

const row = (app: string) => {
  const li = screen.getByRole("button", { name: `More actions for ${app}` }).closest("li");
  if (!li) throw new Error(`no row for ${app}`);
  return li;
};

describe("focus rescue", () => {
  it("Library ⋯ → Uninstall hands the focus to the next row", async () => {
    const { user } = await openScreen("/library");
    const trigger = await screen.findByRole("button", { name: "More actions for Obsidian" });
    const next = row("Obsidian").nextElementSibling;
    if (!(next instanceof HTMLElement)) throw new Error("Obsidian is not followed by a row");
    const nextName = within(next).getAllByRole("button")[0];
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{End}{Enter}");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "More actions for Obsidian" })).toBeNull(),
    );
    await waitFor(() => expect(nextName).toHaveFocus());
  });

  it("Uninstall on the last row goes back to the row before it", async () => {
    const { user } = await openScreen("/library");
    await screen.findByRole("button", { name: "More actions for Visual Studio Code" });
    const rows = within(content()).getAllByRole("button", { name: /^More actions for / });
    const last = rows.at(-1);
    const before = rows.at(-2);
    if (!last || !before) throw new Error("expected two rows");
    last.focus();
    await user.keyboard("{ArrowUp}{Enter}");
    await waitFor(() => expect(last).not.toBeInTheDocument());
    await waitFor(() => expect(before).toHaveFocus());
  });

  it("Keep on the stale callout in Settings › Sources goes back to the channel's row", async () => {
    const { user } = await openScreen("/settings/sources");
    const keep = await within(content()).findByRole("button", { name: "Keep" });
    keep.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(keep).not.toBeInTheDocument());
    await waitFor(() =>
      expect(within(content()).getByRole("button", { name: "FOSS Friends" })).toHaveFocus(),
    );
  });

  it("Unsubscribe on the stale callout hands the focus to the neighbouring row", async () => {
    const { user } = await openScreen("/settings/sources");
    const callout = (await within(content()).findByRole("button", { name: "Keep" })).parentElement;
    if (!callout) throw new Error("no callout");
    const unsubscribe = within(callout).getByRole("button", { name: "Unsubscribe" });
    unsubscribe.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(unsubscribe).not.toBeInTheDocument());
    // FOSS Friends was the last row: the focus goes to the row above it.
    await waitFor(() =>
      expect(within(content()).getByRole("button", { name: "Nilesoft" })).toHaveFocus(),
    );
  });

  it("Keep on the channel page's stale callout goes back to the action row", async () => {
    const { user } = await openScreen("/channel/fossfriends");
    const keep = await within(content()).findByRole("button", { name: "Keep" });
    keep.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(keep).not.toBeInTheDocument());
    await waitFor(() =>
      expect(within(content()).getByRole("button", { name: "Sync now" })).toHaveFocus(),
    );
  });

  it("the Ideas note's × hands the focus to the board", async () => {
    const { user } = await openScreen("/ideas");
    const note = await screen.findByRole("region", { name: "Your idea became an app" });
    within(note).getByRole("button", { name: "Dismiss" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Your idea became an app" })).toBeNull(),
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: /^All/ })).toHaveFocus());
  });

  it("an idea card's Take hands the focus to the card's title", async () => {
    const services = createTestServices();
    const { user } = await openScreen("/ideas", services);
    await act(() => useSettingsStore.getState().update({ dev: true, viewAsDeveloper: true }));
    const heading = await screen.findByRole("heading", {
      level: 3,
      name: "Clipboard history with pinned snippets",
    });
    const card = heading.closest("article");
    if (!card) throw new Error("no card");
    const take = within(card).getByRole("button", { name: "Take" });
    take.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(take).not.toBeInTheDocument());
    // The rest of the card: its title (the keyboard route to the idea).
    await waitFor(() => expect(within(heading).getByRole("button")).toHaveFocus());
  });

  it("Cancel plan hands the focus to the button that replaces it", async () => {
    const services = createTestServices();
    services.world.account.subscription = {
      plan: "monthly",
      renewsOn: "2026-10-15",
      giftUntil: null,
    };
    const { user } = await openScreen("/subscription", services);
    const cancel = await within(content()).findByRole("button", { name: "Cancel plan" });
    const free = cancel.closest("article");
    if (!free) throw new Error("no free plan card");
    cancel.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(free).toHaveAttribute("aria-current", "true"));
    await waitFor(() =>
      expect(within(free).getByRole("button", { name: "Current plan" })).toHaveFocus(),
    );
  });

  it("leaves the focus alone when it was let go on purpose", async () => {
    const { user } = await openScreen("/library");
    const trigger = await screen.findByRole("button", { name: "More actions for Obsidian" });
    trigger.focus();
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    // A later removal elsewhere does not pull the focus back into the list.
    const other = screen.getByRole("button", { name: "More actions for Visual Studio Code" });
    other.focus();
    await user.click(document.body);
    other.blur();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(document.body);
  });
});

describe("neighbourOf", () => {
  function list(html: string) {
    const scope = document.createElement("div");
    scope.innerHTML = html;
    document.body.append(scope);
    return scope;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function removeAndSpot(scope: HTMLElement, el: Element) {
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(scope, { childList: true, subtree: true });
    el.remove();
    await Promise.resolve();
    records.push(...observer.takeRecords());
    observer.disconnect();
    const spot = removalSpot(records, el);
    if (!spot) throw new Error("no spot");
    return neighbourOf(scope, spot);
  }

  it("picks the first control after the spot, skipping disabled and hidden ones", async () => {
    const scope = list(
      `<ul><li id="a"><button>A</button></li><li id="b"><button>B</button></li>` +
        `<li id="c"><button disabled>C</button><button hidden>C2</button><a href="#d">D</a></li></ul>`,
    );
    const target = await removeAndSpot(scope, scope.querySelector("#b") as Element);
    expect(target?.textContent).toBe("D");
  });

  it("falls back to the last control before the spot", async () => {
    const scope = list(`<button>A</button><div id="gone"><button>B</button></div><p>text</p>`);
    const target = await removeAndSpot(scope, scope.querySelector("#gone") as Element);
    expect(target?.textContent).toBe("A");
  });

  it("finds a replacement rendered in the removed block's place", async () => {
    const scope = list(`<div id="row"><span>label</span><button id="old">Old</button></div>`);
    const old = scope.querySelector("#old") as Element;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(scope, { childList: true, subtree: true });
    const replacement = document.createElement("button");
    replacement.textContent = "New";
    old.replaceWith(replacement);
    await Promise.resolve();
    records.push(...observer.takeRecords());
    observer.disconnect();
    const spot = removalSpot(records, old);
    expect(spot && neighbourOf(scope, spot)).toBe(replacement);
  });
});
