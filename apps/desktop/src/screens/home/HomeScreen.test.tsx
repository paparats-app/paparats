import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MockServices } from "@/services";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { HomeScreen } from "./HomeScreen";

async function renderHome(services?: MockServices) {
  const rendered = await renderWithProviders(<HomeScreen />, { route: "/home", services });
  await screen.findByRole("heading", { level: 1 });
  return { ...rendered, path: () => rendered.router.state.location.pathname };
}

const section = (name: string | RegExp) => screen.getByRole("region", { name });

/** The store card whose identity button starts with `name`. */
function card(name: string): HTMLElement {
  const identity = within(section("Featured apps")).getByRole("button", {
    name: new RegExp(`^${name}`),
  });
  const root = identity.closest<HTMLElement>("[data-app-card]");
  if (!root) throw new Error(`no card for ${name}`);
  return root;
}

/** Services with `appIds` uninstalled (every featured and recent app is installed in the fixtures). */
function withoutInstalled(...appIds: string[]): MockServices {
  const services = createTestServices();
  services.world.library.installed = services.world.library.installed.filter(
    (entry) => !appIds.includes(entry.appId),
  );
  return services;
}

describe("HomeScreen", () => {
  it("renders the hero and every section in English", async () => {
    await renderHome();

    const hero = screen.getByRole("region", { name: "Highlights" });
    expect(within(hero).getByText("Discover")).toBeInTheDocument();
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Great toolshide in plain sight.",
    );
    expect(within(hero).getByRole("button", { name: "Explore apps" })).toBeInTheDocument();

    const featured = section("Featured apps");
    expect(featured.querySelectorAll("[data-app-card]")).toHaveLength(6);
    expect(within(featured).getByRole("button", { name: /^Obsidian/ })).toBeInTheDocument();
    expect(within(featured).getAllByRole("button", { name: "Details" })).toHaveLength(6);

    const collections = within(section("Collections")).getAllByRole("button", {
      name: /Essential Windows Apps|For Creators|For Developers|Work Smarter/,
    });
    expect(collections).toHaveLength(4);

    const notable = section("New and notable");
    for (const name of ["Nilesoft Shell", "LocalSend", "Czkawka", "RustDesk"]) {
      expect(within(notable).getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    }

    // Six visible apps, newest first: mpv and Slounik come from channels the user does not follow.
    const recent = section("Recently updated");
    const names = within(recent)
      .getAllByRole("button", { name: /Updated/ })
      .map((button) => button.textContent);
    expect(names).toHaveLength(6);
    expect(names[0]).toMatch(/Nilesoft Shell1\.9\.15 · Updated 2 days ago$/);
    expect(names.join()).not.toMatch(/mpv|Slounik/);
  });

  it("renders every section in Russian", async () => {
    await renderHome();
    await act(() => useSettingsStore.getState().update({ locale: "ru" }));

    const hero = screen.getByRole("region", { name: "Главное" });
    expect(within(hero).getByRole("button", { name: "Следующий слайд" })).toBeInTheDocument();
    for (const title of ["Рекомендуемые", "Коллекции", "Новое и заметное", "Недавно обновлённые"]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /^Показать все/ })).toHaveLength(4);
    expect(within(section("Недавно обновлённые")).getAllByText(/Обновлено/)).toHaveLength(6);
  });

  it("steps through the hero with next, previous and the dots, and keeps the slide", async () => {
    const { unmount } = await renderHome();
    const hero = () => screen.getByRole("region", { name: "Highlights" });
    const kicker = (text: string) => within(hero()).getByText(text);

    await userEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(kicker("Tools for real life")).toBeInTheDocument();
    expect(useHomeStore.getState().heroIndex).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(kicker("Paparats Pro")).toBeInTheDocument();
    expect(within(hero()).getByRole("button", { name: "See plans" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Slide 3 of 4" }));
    expect(kicker("Curated for Windows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slide 3 of 4" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // The slide survives leaving Home and coming back.
    unmount();
    await renderHomeAgain();
    expect(kicker("Curated for Windows")).toBeInTheDocument();
  });

  it("sends each hero CTA to its target; Browse opens unfiltered", async () => {
    const { path } = await renderHome();
    useBrowseStore.getState().apply({ pro: true, sort: "name" });

    const cta = (name: string) =>
      within(screen.getByRole("region", { name: "Highlights" })).getByRole("button", { name });
    const expected = ["/browse", "/library", "/categories", "/subscription"];
    for (const [i, target] of expected.entries()) {
      act(() => useHomeStore.getState().setHeroIndex(i));
      await userEvent.click(cta(i === 3 ? "See plans" : "Explore apps"));
      expect(path()).toBe(target);
    }
    expect(useBrowseStore.getState()).toMatchObject({ pro: false, sort: "featured" });
  });

  it("opens app pages, collections, Categories and Browse from the sections", async () => {
    const { path } = await renderHome();

    await userEvent.click(within(card("Obsidian")).getByRole("button", { name: /^Obsidian/ }));
    expect(path()).toBe("/app/obsidian");
    await userEvent.click(within(card("ShareX")).getByRole("button", { name: "Details" }));
    expect(path()).toBe("/app/sharex");
    await userEvent.click(
      within(section("New and notable")).getByRole("button", { name: /^LocalSend/ }),
    );
    expect(path()).toBe("/app/localsend");
    await userEvent.click(
      within(section("Recently updated")).getByRole("button", { name: /^RustDesk/ }),
    );
    expect(path()).toBe("/app/rustdesk");

    useBrowseStore.getState().apply({ portable: true });
    await userEvent.click(
      within(section("Collections")).getByRole("button", { name: /^For Developers/ }),
    );
    expect(path()).toBe("/browse");
    expect(useBrowseStore.getState()).toMatchObject({ collection: "developers", portable: false });

    await userEvent.click(within(section("Collections")).getByRole("button", { name: /^See all/ }));
    expect(path()).toBe("/categories");

    for (const name of ["Featured apps", "New and notable", "Recently updated"]) {
      useBrowseStore.getState().apply({ collection: "work" });
      await userEvent.click(within(section(name)).getByRole("button", { name: /^See all/ }));
      expect(path()).toBe("/browse");
      expect(useBrowseStore.getState().collection).toBeNull();
    }
  });

  it("starts a download from Get on a featured card and shows its progress", async () => {
    await renderHome(withoutInstalled("everything"));

    const everything = card("Everything");
    await userEvent.click(within(everything).getByRole("button", { name: "Get" }));
    expect(
      await within(everything).findByRole("button", { name: /^\d+% · Pause$/ }),
    ).toBeInTheDocument();
  });

  it("skips apps whose channel is not followed", async () => {
    const services = withoutInstalled("czkawka");
    services.world.subscriptions = services.world.subscriptions.filter(
      (s) => s.channelId !== "fossfriends",
    );
    await renderHome(services);

    const notable = section("New and notable");
    expect(within(notable).queryByRole("button", { name: /^Czkawka/ })).toBeNull();
    expect(within(notable).getAllByRole("button", { name: /^(?!See all)/ })).toHaveLength(3);
  });

  it("wires the first-launch glow to the Home store", async () => {
    const { container } = await renderHome();
    expect(container.querySelector(".glowOn")).toBeNull();
    act(() => useHomeStore.getState().setHeroGlow(true));
    await waitFor(() => expect(container.querySelector(".glowOn")).not.toBeNull());
  });
});

/** Renders Home again after an unmount (the stores keep their state within a test). */
async function renderHomeAgain() {
  await renderWithProviders(<HomeScreen />, { route: "/home" });
  await screen.findByRole("heading", { level: 1 });
}
