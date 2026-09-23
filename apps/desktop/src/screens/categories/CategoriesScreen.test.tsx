import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { renderWithProviders } from "@/test/render";
import { CategoriesScreen } from "./CategoriesScreen";

/** A category tile (its accessible name starts with the label). */
const tile = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

describe("CategoriesScreen", () => {
  it("renders the banner, the nine tiles, Featured in Productivity and the brand line", async () => {
    await renderWithProviders(<CategoriesScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Categories" })).toBeInTheDocument();
    expect(screen.getByText("Explore our curated collection of apps.")).toBeInTheDocument();
    expect(screen.getByText("Same tools. New possibilities.")).toBeInTheDocument();

    // Label, description and the catalog count (not the apps in this data set).
    expect(await screen.findByRole("button", { name: /^Productivity/ })).toHaveTextContent(
      /^Productivity\s*Get more done\.\s*142 apps$/,
    );
    const labels = [
      "Productivity",
      "Development",
      "Design",
      "Media",
      "Utilities",
      "System",
      "Lifestyle",
      "Games",
      "Education",
    ];
    for (const label of labels) expect(tile(label)).toBeInTheDocument();
    expect(tile("Utilities")).toHaveTextContent("164 apps");

    expect(
      screen.getByRole("heading", { level: 2, name: "Featured in Productivity" }),
    ).toBeInTheDocument();
    // The visible productivity apps, with their actions.
    for (const name of ["Obsidian", "Flow Launcher", "Joplin", "Ditto"]) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
    expect(screen.queryByText("ShareX")).toBeNull();
    const featured = screen.getByText("Obsidian").closest<HTMLElement>("[data-app-card]");
    expect(featured).not.toBeNull();
    expect(within(featured as HTMLElement).getByRole("button", { name: "Details" })).toBeVisible();

    expect(screen.getByText("“Small apps. Big possibilities.”")).toBeInTheDocument();
    expect(screen.getByText("— Paparats")).toBeInTheDocument();
  });

  it("opens Browse with the tile's category applied (and every other filter reset)", async () => {
    const user = userEvent.setup();
    useBrowseStore.setState({ pro: true, sort: "size", collection: "essential" });
    const { router } = await renderWithProviders(<CategoriesScreen />, { route: "/categories" });
    await user.click(await screen.findByRole("button", { name: /^Utilities/ }));

    expect(router.state.location.pathname).toBe("/browse");
    const browse = useBrowseStore.getState();
    expect(browse.categories).toEqual(["utilities"]);
    expect(browse.pro).toBe(false);
    expect(browse.sort).toBe("featured");
    expect(browse.collection).toBeNull();
  });

  it("“See all” opens Browse filtered to Productivity", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<CategoriesScreen />, { route: "/categories" });
    await user.click(screen.getByRole("button", { name: "See all" }));
    expect(router.state.location.pathname).toBe("/browse");
    expect(useBrowseStore.getState().categories).toEqual(["productivity"]);
    expect(useUiStore.getState().navCount).toBe(1);
  });

  it("starts a download from a featured card", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<CategoriesScreen />);
    // Joplin is not installed: "Get" queues it.
    const joplin = (await screen.findByText("Joplin")).closest<HTMLElement>("[data-app-card]");
    await user.click(within(joplin as HTMLElement).getByRole("button", { name: "Get" }));
    await waitFor(() =>
      expect(within(joplin as HTMLElement).queryByRole("button", { name: "Get" })).toBeNull(),
    );
  });

  it("speaks Russian and Belarusian with the right plural forms", async () => {
    await renderWithProviders(<CategoriesScreen />);
    await act(async () => {
      await useSettingsStore.getState().update({ locale: "ru" });
    });
    expect(screen.getByRole("heading", { level: 1, name: "Категории" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Продуктивность/ })).toHaveTextContent(
      "142 приложения",
    );
    expect(tile("Утилиты")).toHaveTextContent("164 приложения");
    expect(tile("Система")).toHaveTextContent("76 приложений");
    expect(
      screen.getByRole("heading", { level: 2, name: "Рекомендуемые: Продуктивность" }),
    ).toBeInTheDocument();
    expect(screen.getByText("«Маленькие приложения. Большие возможности.»")).toBeInTheDocument();

    await act(async () => {
      await useSettingsStore.getState().update({ locale: "be" });
    });
    expect(tile("Гульні")).toHaveTextContent("38 праграм");
    expect(tile("Адукацыя")).toHaveTextContent("47 праграм");
    expect(tile("Утыліты")).toHaveTextContent("164 праграмы");
  });
});
