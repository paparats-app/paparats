import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { renderApp, renderWithProviders } from "@/test/render";
import { SearchScreen } from "./SearchScreen";

const searchBox = () => screen.getByRole("searchbox", { name: "Search for apps, tools, ideas…" });
/** The results section (labelled by its "Results for …" heading in any language). */
const results = () => screen.getByRole("region", { name: /^(Results for|Результаты для) / });
const status = () => within(results()).getByRole("status");
const update = (patch: Parameters<ReturnType<typeof useSettingsStore.getState>["update"]>[0]) =>
  act(async () => {
    await useSettingsStore.getState().update(patch);
  });
/** The card whose name is `name` (the identity button opens the app page). */
const card = (name: string) =>
  within(results()).getByText(name, { selector: "span" }).closest<HTMLElement>("[data-app-card]");

describe("SearchScreen", () => {
  it("renders the results for the query (smoke)", async () => {
    useUiStore.setState({ query: "  obs " });
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Results for “obs”" })).toBeVisible();
    expect(await within(status()).findByText("2 apps")).toBeInTheDocument();
    expect(card("Obsidian")).not.toBeNull();
    expect(card("OBS Studio")).not.toBeNull();
    // Category chip on every result; official apps have no channel chip.
    expect(within(card("Obsidian") as HTMLElement).getByText("Productivity")).toBeInTheDocument();
  });

  it("shows the skeleton while typing, then the results", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.type(searchBox(), "obs");

    expect(screen.getByRole("heading", { level: 1, name: "Results for “obs”" })).toBeVisible();
    expect(status()).toHaveTextContent("Searching…");
    expect(screen.getByTestId("search-skeleton").children).toHaveLength(6);
    expect(within(results()).queryByText("Obsidian")).toBeNull();

    await waitFor(() => expect(screen.queryByTestId("search-skeleton")).toBeNull());
    expect(status()).toHaveTextContent("2 apps");
    expect(card("Obsidian")).not.toBeNull();
    expect(card("OBS Studio")).not.toBeNull();
    // The route underneath stays mounted but hidden.
    expect(screen.getByTestId("screen").firstElementChild).not.toBeVisible();
  });

  it("matches the source channel and shows its chip", async () => {
    useUiStore.setState({ query: "nilesoft" });
    await renderWithProviders(<SearchScreen />);
    const shell = await waitFor(() => {
      const found = card("Nilesoft Shell");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(within(shell).getByText("System")).toBeInTheDocument();
    expect(within(shell).getByText("Nilesoft")).toBeInTheDocument();
  });

  it("offers featured apps when nothing is found; a chip searches for it", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.type(searchBox(), "zzzz");

    expect(await screen.findByText("Nothing found")).toBeInTheDocument();
    expect(status()).toHaveTextContent("0 apps");
    expect(screen.getByText("Try a shorter query or browse the categories.")).toBeInTheDocument();
    const chips = within(screen.getByRole("group", { name: "Try one of these" })).getAllByRole(
      "button",
    );
    // The first four featured apps; the monogram tiles are decorative.
    const names = ["Obsidian", "ShareX", "VLC media player", "PowerToys"];
    expect(chips).toHaveLength(names.length);
    chips.forEach((chip, i) => expect(chip).toHaveAccessibleName(names[i]));

    await user.click(screen.getByRole("button", { name: "ShareX" }));
    // No "Searching…" pause after a suggestion.
    expect(searchBox()).toHaveValue("ShareX");
    expect(useUiStore.getState().searching).toBe(false);
    expect(screen.getByRole("heading", { level: 1, name: "Results for “ShareX”" })).toBeVisible();
    expect(status()).toHaveTextContent("1 app");
    expect(card("ShareX")).not.toBeNull();
  });

  it("links to Categories from the empty state and clears the search", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ query: "zzzz" });
    const { router } = await renderWithProviders(<SearchScreen />);
    await screen.findByText("Nothing found");

    await user.click(within(results()).getByRole("button", { name: "Categories" }));
    expect(router.state.location.pathname).toBe("/categories");
    expect(useUiStore.getState().query).toBe("");
  });

  it("shows the offline state instead of results", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<SearchScreen />);
    await update({ dev: true, simulateOffline: true });
    act(() => useUiStore.getState().setQuery("obs"));

    expect(screen.getByText("Search needs a connection")).toBeInTheDocument();
    expect(screen.getByText("You can still open apps from your Library.")).toBeInTheDocument();
    // No skeleton, no count, no results while offline.
    expect(screen.queryByTestId("search-skeleton")).toBeNull();
    expect(status()).toHaveTextContent("");
    expect(within(results()).queryByText("Obsidian")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(router.state.location.pathname).toBe("/library");
    expect(useUiStore.getState().query).toBe("");
  });

  it("opens the app page from a result and clears the query", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ query: "obsidian" });
    const { router } = await renderWithProviders(<SearchScreen />);
    const obsidian = await waitFor(() => {
      const found = card("Obsidian");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });

    await user.click(within(obsidian).getByRole("button", { name: "Details" }));
    expect(router.state.location.pathname).toBe("/app/obsidian");
    expect(useUiStore.getState().query).toBe("");
  });

  it("searches the Russian category labels and taglines", async () => {
    await renderWithProviders(<SearchScreen />);
    await update({ locale: "ru" });
    act(() => useUiStore.getState().setQuery("утилиты", { skeleton: false }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Результаты для «утилиты»" }),
    ).toBeVisible();
    await waitFor(() => expect(card("ShareX")).not.toBeNull());
    expect(within(card("ShareX") as HTMLElement).getByText("Утилиты")).toBeInTheDocument();
    expect(within(results()).queryByText("VLC media player")).toBeNull();
    expect(status()).toHaveTextContent(/^\d+ приложени(е|я|й)$/);

    // Taglines in the current language: "Мгновенно" is in Everything's Russian tagline.
    act(() => useUiStore.getState().setQuery("мгновенно", { skeleton: false }));
    expect(status()).toHaveTextContent("1 приложение");
    expect(card("Everything")).not.toBeNull();
  });
});
