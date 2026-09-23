// Idea page (prototype lines 1284–1349) against the mock services: the status card and timeline
// for open, in-work and released ideas, voting, the discussion as the user and as the developer,
// taking an idea, the release dialog and Back.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Route, Routes } from "react-router";
import { useNav } from "@/app/navigation";
import { changeLocale } from "@/i18n";
import { useDialogStore } from "@/stores/useDialogStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { IdeaScreen } from "./IdeaScreen";

const toast = () => useUiStore.getState().toast?.message;
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

/** Opens `/ideas/<id>` in the whole shell (dialogs, toast), optionally in the developer view. */
async function openIdea(id: string, view: "user" | "developer" = "user") {
  const rendered = await renderApp({ route: `/ideas/${id}` });
  await act(async () => {
    await useSettingsStore.getState().update({
      animations: false,
      dev: view === "developer",
      viewAsDeveloper: view === "developer",
    });
  });
  await screen.findByRole("heading", { level: 1 });
  return rendered;
}

const header = () => {
  const el = screen.getByRole("heading", { level: 1 }).closest("header");
  if (!el) throw new Error("no header");
  return el;
};

/** The status card: the parent of its status hint. */
function statusCard(hint: string | RegExp) {
  const el = within(header()).getByText(hint).parentElement;
  if (!el) throw new Error("no status card");
  return within(el);
}

const timeline = () => within(screen.getByRole("list", { name: "Progress" }));
const discussion = () => within(screen.getByRole("region", { name: /^Discussion/ }));
const composer = () => screen.getByRole("textbox", { name: "Add to the discussion…" });
const postButton = () => screen.getByRole("button", { name: "Post" });

describe("IdeaScreen", () => {
  it("renders an open idea: meta, open status card, timeline and discussion", async () => {
    await openIdea("clip");
    const top = within(header());
    expect(
      top.getByRole("heading", { name: "Clipboard history with pinned snippets" }),
    ).toBeInTheDocument();
    expect(top.getByText("New app · Utilities")).toBeInTheDocument();
    expect(top.getByText("by Alena K.")).toBeInTheDocument();
    expect(top.getByText("4 September 2026")).toBeInTheDocument();
    expect(top.getByText(/^A tray app that remembers everything I copy/)).toBeInTheDocument();
    expect(top.getByRole("button", { name: "214 votes" })).toHaveAttribute("aria-pressed", "false");
    expect(top.getAllByText("Open")).toHaveLength(2);

    const card = statusCard("Open to developers. The more votes, the sooner someone picks it up.");
    expect(card.queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Ideas" })).toBeInTheDocument();

    const steps = timeline().getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual([
      "ProposedAlena K. · 4 September 2026",
      "In workNot yet",
      "ReleasedNot yet",
    ]);
    expect(steps[0]).toHaveAttribute("aria-current", "step");

    expect(screen.getByRole("heading", { name: "Discussion 2" })).toBeInTheDocument();
    expect(discussion().getAllByRole("listitem")).toHaveLength(2);
    expect(discussion().getByText("Dzmitry P.")).toBeInTheDocument();
    expect(discussion().getByText("6 September 2026")).toBeInTheDocument();
    // In the user view nobody can take the idea.
    expect(screen.queryByRole("button", { name: "Take this idea" })).toBeNull();
  });

  it("renders an idea in work: the user's own idea, the developer and its comment", async () => {
    await openIdea("battery");
    const top = within(header());
    expect(top.getByText("by You")).toBeInTheDocument();
    const card = statusCard("Winaero has been on it since 20 August 2026.");
    expect(card.getByText("In work")).toBeInTheDocument();
    expect(card.getByText("Winaero")).toBeInTheDocument();
    expect(
      timeline()
        .getAllByRole("listitem")
        .map((s) => s.textContent),
    ).toEqual([
      "ProposedYou · 12 August 2026",
      "In workWinaero · 20 August 2026",
      "ReleasedNot yet",
    ]);
    const developerComment = discussion().getByText("Sergey Tkachenko").closest("li");
    if (!developerComment) throw new Error("no comment");
    expect(within(developerComment).getByText("Developer · Winaero")).toBeInTheDocument();
    // A reader who is not the author gets no badge.
    const reader = discussion().getByText("Alena K.").closest("li");
    if (!reader) throw new Error("no comment");
    expect(within(reader).queryByText("Author")).toBeNull();
  });

  it("renders a released idea: the shipped app, the author's thank-you and Open", async () => {
    await openIdea("ctxmenu");
    const card = statusCard("Shipped as Nilesoft Shell 1.9.15 on 13 September 2026.");
    expect(card.getByText("Released")).toBeInTheDocument();
    expect(card.getByText("Nilesoft")).toBeInTheDocument();
    expect(card.getByText("Nilesoft Shell")).toBeInTheDocument();
    expect(card.getByText("Version 1.9.15")).toBeInTheDocument();
    expect(card.getByText("The author received 3 months of Paparats Pro.")).toBeInTheDocument();
    expect(
      timeline()
        .getAllByRole("listitem")
        .map((s) => s.textContent),
    ).toEqual([
      "ProposedKasia L. · 2 April 2026",
      "In workNilesoft · 11 May 2026",
      "ReleasedNilesoft Shell 1.9.15 · 13 September 2026",
    ]);
    expect(timeline().getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");

    await userEvent.setup().click(card.getByRole("button", { name: "Open Nilesoft Shell" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nilesoft Shell" }),
    ).toBeInTheDocument();
  });

  it("names the catalog developer of an improvement and shows no comments line", async () => {
    await openIdea("multisend");
    const card = statusCard("Tien Do Nam has been on it since 15 August 2026.");
    expect(card.getByText("Tien Do Nam")).toBeInTheDocument();
    expect(within(header()).getByText("For LocalSend")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discussion 0" })).toBeInTheDocument();
    expect(discussion().getByText("No comments yet. Start the discussion.")).toBeInTheDocument();
  });

  it("votes and unvotes on the detail page", async () => {
    const user = userEvent.setup();
    await openIdea("clip");
    await user.click(screen.getByRole("button", { name: "214 votes" }));
    const voted = await screen.findByRole("button", { name: "215 votes" });
    expect(voted).toHaveAttribute("aria-pressed", "true");
    expect(voted).toHaveTextContent("Voted");
    await user.click(voted);
    expect(await screen.findByRole("button", { name: "214 votes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("posts a comment as the user: “You”, today's date, the box cleared", async () => {
    const user = userEvent.setup();
    await openIdea("clip");
    expect(postButton()).toHaveAttribute("aria-disabled", "true");
    await user.type(composer(), "   ");
    await user.click(postButton());
    expect(discussion().queryByText("You")).toBeNull();
    await user.clear(composer());
    await user.type(composer(), "  Please add image previews too.  ");
    await user.click(postButton());

    expect(await discussion().findByText("Please add image previews too.")).toBeInTheDocument();
    const mine = discussion().getByText("Please add image previews too.").closest("li");
    if (!mine) throw new Error("no comment");
    expect(within(mine).getByText("You")).toBeInTheDocument();
    expect(within(mine).getByText("15 September 2026")).toBeInTheDocument();
    expect(within(mine).getByText("SK")).toBeInTheDocument();
    expect(within(mine).queryByText(/Developer/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Discussion 3" })).toBeInTheDocument();
    expect(composer()).toHaveValue("");
  });

  it("marks the author's own comments with the Author badge", async () => {
    const user = userEvent.setup();
    await openIdea("battery");
    await user.type(composer(), "Thanks for taking it!");
    await user.click(postButton());
    const mine = (await discussion().findByText("Thanks for taking it!")).closest("li");
    if (!mine) throw new Error("no comment");
    expect(within(mine).getByText("You")).toBeInTheDocument();
    expect(within(mine).getByText("Author")).toBeInTheDocument();
  });

  it("posts a comment as the developer: the channel's author and the Developer badge", async () => {
    const user = userEvent.setup();
    const { services } = await openIdea("clip", "developer");
    // The composer shows the channel's monogram.
    const form = composer().closest("form");
    if (!form) throw new Error("no composer");
    expect(within(form).getByText("Ni")).toBeInTheDocument();

    await user.type(composer(), "We could ship this in Shell 2.0.");
    await user.click(postButton());
    const posted = (await discussion().findByText("We could ship this in Shell 2.0.")).closest(
      "li",
    );
    if (!posted) throw new Error("no comment");
    expect(within(posted).getByText("Nilesoft", { selector: "span" })).toBeInTheDocument();
    expect(within(posted).getByText("Developer · Nilesoft")).toBeInTheDocument();
    const stored = (await services.ideas.getIdeas()).find((i) => i.id === "clip")?.comments.at(-1);
    expect(stored).toMatchObject({ author: "Nilesoft", dev: "nilesoft", mine: false });
  });

  it("shows the user's own comment under the profile name in the developer view", async () => {
    const user = userEvent.setup();
    await openIdea("battery");
    await user.type(composer(), "Any news?");
    await user.click(postButton());
    await discussion().findByText("Any news?");
    await act(async () => {
      await useSettingsStore.getState().update({ dev: true, viewAsDeveloper: true });
    });
    const mine = discussion().getByText("Any news?").closest("li");
    if (!mine) throw new Error("no comment");
    expect(within(mine).getByText("Serj Kaje")).toBeInTheDocument();
    expect(within(header()).getByText("by Serj Kaje")).toBeInTheDocument();
  });

  it("takes an open idea in the developer view", async () => {
    const user = userEvent.setup();
    await openIdea("clip", "developer");
    const card = statusCard("Open to developers. The more votes, the sooner someone picks it up.");
    expect(
      card.getByText(
        "It will be pinned to Nilesoft. The author and everyone who voted will be notified.",
      ),
    ).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Take this idea" }));

    const working = await waitFor(() =>
      statusCard("Nilesoft has been on it since 15 September 2026."),
    );
    expect(working.getByText("In work")).toBeInTheDocument();
    expect(working.getByRole("button", { name: "Mark as released" })).toBeInTheDocument();
    expect(working.queryByRole("button", { name: "Take this idea" })).toBeNull();
    expect(toast()).toBe("Pinned to Nilesoft · author notified");
    expect(timeline().getAllByRole("listitem")[1]).toHaveTextContent(
      "In workNilesoft · 15 September 2026",
    );
  });

  it("offers Take only on ideas the channel may take", async () => {
    await openIdea("iconpacks", "developer");
    // An improvement to Nilesoft Shell, the channel's own app.
    expect(screen.getByRole("button", { name: "Take this idea" })).toBeInTheDocument();
  });

  it("offers nothing on an improvement to another publisher's app", async () => {
    await openIdea("scrollcap", "developer");
    expect(screen.queryByRole("button", { name: "Take this idea" })).toBeNull();
  });

  it("says who is on an idea in work elsewhere", async () => {
    await openIdea("battery", "developer");
    const card = statusCard("Winaero has been on it since 20 August 2026.");
    expect(card.getByText("In work at Winaero")).toBeInTheDocument();
    expect(card.queryByRole("button")).toBeNull();
  });

  it("releases a taken idea through the release dialog", async () => {
    const user = userEvent.setup();
    await openIdea("clip", "developer");
    await user.click(screen.getByRole("button", { name: "Take this idea" }));
    await user.click(await screen.findByRole("button", { name: "Mark as released" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Release the idea" }));
    expect(dialog.getByText("Clipboard history with pinned snippets")).toBeInTheDocument();
    expect(dialog.getByRole("combobox", { name: "Which app implements it?" })).toHaveValue("shell");
    const version = dialog.getByRole("textbox", { name: "Version" });
    expect(version).toHaveValue("1.9.16");
    expect(
      dialog.getByText(
        "Alena K. and 214 voters will be notified. The author gets 3 months of Paparats Pro.",
      ),
    ).toBeInTheDocument();

    await user.clear(version);
    expect(dialog.getByRole("button", { name: "Release" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.type(version, "2.0.0");
    await user.click(dialog.getByRole("button", { name: "Release" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Released · 214 people notified");
    const card = statusCard("Shipped as Nilesoft Shell 2.0.0 on 15 September 2026.");
    expect(card.getByText("Released")).toBeInTheDocument();
    expect(card.getByText("Version 2.0.0")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Mark as released" })).toBeNull();
    expect(timeline().getAllByRole("listitem")[2]).toHaveTextContent(
      "ReleasedNilesoft Shell 2.0.0 · 15 September 2026",
    );
  });

  it("closes the release dialog with Cancel without releasing", async () => {
    const user = userEvent.setup();
    await openIdea("iconpacks", "developer");
    await user.click(screen.getByRole("button", { name: "Take this idea" }));
    await user.click(await screen.findByRole("button", { name: "Mark as released" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Release the idea" }));
    // An improvement ships in its own app: no picker, the app and its current version.
    expect(dialog.queryByRole("combobox")).toBeNull();
    expect(dialog.getByText("Nilesoft Shell")).toBeInTheDocument();
    expect(dialog.getByText("Version 1.9.15")).toBeInTheDocument();
    expect(dialog.getByRole("textbox", { name: "Version" })).toHaveValue("1.9.16");
    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useDialogStore.getState().dialog).toBeNull();
    expect(screen.getByRole("button", { name: "Mark as released" })).toBeInTheDocument();
  });

  it("shows “Idea not found” for an unknown id", async () => {
    await renderApp({ route: "/ideas/nope" });
    expect(await screen.findByText("Idea not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ideas" })).toBeInTheDocument();
  });

  it("renders in Russian", async () => {
    await openIdea("ctxmenu");
    await act(() => changeLocale("ru"));
    // Intl puts a no-break space before "г.".
    expect(
      screen.getByText(/^Вышла как Nilesoft Shell 1\.9\.15 13 сентября 2026\sг\.\.$/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Идеи" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Обсуждение 1" })).toBeInTheDocument();
  });
});

/** Opens an idea from the board with `useNav`, like a card would. */
function Harness() {
  const { go, section } = useNav();
  return (
    <Routes>
      <Route
        path="/ideas/:ideaId"
        element={
          <>
            <output aria-label="section">{section}</output>
            <IdeaScreen />
          </>
        }
      />
      <Route
        path="*"
        element={
          <button type="button" onClick={() => go({ to: "idea", ideaId: "ctxmenu" })}>
            open
          </button>
        }
      />
    </Routes>
  );
}

describe("IdeaScreen navigation", () => {
  it("renders under the providers, keeps Ideas active and Back returns to the board", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<Harness />, { route: "/ideas" });
    // Let the providers' first effects (downloads snapshot, settings) settle.
    await act(async () => {});
    await user.click(screen.getByRole("button", { name: "open" }));
    expect(
      await screen.findByRole("heading", { name: "A context menu editor without registry hacks" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ideas/ctxmenu");
    expect(screen.getByRole("status", { name: "section" })).toHaveTextContent("ideas");

    await user.click(screen.getByRole("button", { name: "Ideas" }));
    expect(router.state.location.pathname).toBe("/ideas");
  });
});

describe("A released idea reaches its author", () => {
  it("the developer takes and releases the user's idea; the author sees the note on the board", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const mine = await services.ideas.propose({
      kind: "new",
      appId: null,
      category: "utilities",
      title: "Right-click “Copy as path” for every file",
      body: "",
    });
    await renderApp({ route: `/ideas/${mine.id}`, services });
    await act(async () => {
      await useSettingsStore
        .getState()
        .update({ animations: false, dev: true, viewAsDeveloper: true });
    });
    const sidebar = within(screen.getByRole("navigation", { name: "Main" }));
    // The developer view has no release notes.
    expect(sidebar.getByRole("button", { name: /^Ideas$/ })).toBeInTheDocument();

    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).getByText("by Serj Kaje")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Take this idea" }));
    await user.click(await screen.findByRole("button", { name: "Mark as released" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Release the idea" }));
    expect(
      dialog.getByText(
        "Serj Kaje and 1 voter will be notified. The author gets 3 months of Paparats Pro.",
      ),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Release" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Released · 1 person notified");

    // Back in the user view: the idea is "You"rs, released, and the board shows the note.
    await act(async () => {
      await useSettingsStore.getState().update({ viewAsDeveloper: false });
    });
    expect(within(header()).getByText("by You")).toBeInTheDocument();
    expect(sidebar.getByRole("button", { name: /^Ideas\s*2$/ })).toBeInTheDocument();
    await user.click(sidebar.getByRole("button", { name: /^Ideas/ }));
    const note = await screen.findByRole("region", { name: "Your idea became an app" });
    expect(note).toHaveTextContent(
      "“Right-click “Copy as path” for every file” is now available as Nilesoft Shell, by Nilesoft.",
    );
  });
});
