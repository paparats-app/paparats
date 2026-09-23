// First launch: the phase timeline, skip, the three steps (language / appearance / account), the
// finish (record, Home, hero glow, exit), sign-in toast, reduced motion, replay, and the shell.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_RUN_KEY, useFirstLaunchStore } from "@/stores/useFirstLaunchStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, flush, renderApp, renderWithProviders } from "@/test/render";
import { FirstLaunch } from "./FirstLaunch";
import { SIGNUP_URL } from "./FirstLaunchSteps";

const scene = () => screen.queryByTestId("first-launch");
const phase = () => scene()?.dataset.phase ?? null;
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** The `››` button, also while it is faded out (then hidden from assistive tech). */
const skipButton = () => screen.getByTitle("Skip");
const record = () => JSON.parse(localStorage.getItem(FIRST_RUN_KEY) ?? "null") as unknown;
const toast = () => useUiStore.getState().toast?.message ?? null;

/** Renders the overlay alone (at `route`) and starts a run with fake timers. */
async function play(options: { route?: string; animations?: boolean } = {}) {
  const services = createTestServices();
  const rendered = await renderWithProviders(<FirstLaunch />, {
    route: options.route ?? "/home",
    services,
  });
  if (options.animations === false) {
    await act(async () => {
      await useSettingsStore.getState().update({ animations: false });
    });
  }
  vi.useFakeTimers();
  act(() => useFirstLaunchStore.getState().start());
  return { ...rendered, path: () => rendered.router.state.location.pathname };
}

/** Straight to a step: skip the intro, then Continue as often as needed. */
async function toStep(step: "lang" | "theme" | "signin") {
  fireEvent.click(button("Skip"));
  if (step === "lang") return;
  fireEvent.click(button(/^Continue/));
  if (step === "theme") return;
  fireEvent.click(button(/^Continue/));
  await flush();
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  localStorage.clear();
});

describe("FirstLaunch", () => {
  it("renders nothing until a run starts", async () => {
    await renderWithProviders(<FirstLaunch />);
    expect(scene()).toBeNull();
  });

  it("plays seed → fern → part → bloom → logo → lang on the spec's timings, then stops", async () => {
    await play();
    const dialog = screen.getByRole("dialog", { name: "Welcome to Paparats" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(phase()).toBe("seed");
    const steps: [number, string][] = [
      [120, "fern"],
      [1400, "part"],
      [2800, "bloom"],
      [4300, "logo"],
      [5400, "lang"],
    ];
    let now = 0;
    for (const [at, next] of steps) {
      await flush(at - 1 - now);
      expect(phase()).not.toBe(next);
      await flush(1);
      expect(phase()).toBe(next);
      now = at;
    }
    // The shock ring is drawn from the bloom on; the first step shows its panel.
    expect(screen.getByTestId("first-launch-ring")).toBeInTheDocument();
    expect(heading()).toBe("Choose your language");
    await flush(10_000);
    expect(phase()).toBe("lang");
  });

  it("skips to the language step from the scene or ››, not once a step shows", async () => {
    await play();
    await flush(1500);
    expect(phase()).toBe("part");
    fireEvent.click(screen.getByTestId("first-launch-scene"));
    expect(phase()).toBe("lang");
    // The pending timeline does not drag the scene back.
    await flush(6000);
    expect(phase()).toBe("lang");
    expect(skipButton()).toBeDisabled();
    expect(skipButton()).toHaveAttribute("aria-hidden", "true");

    act(() => useFirstLaunchStore.getState().start());
    await flush(200);
    expect(phase()).toBe("fern");
    fireEvent.click(button("Skip"));
    expect(phase()).toBe("lang");
    fireEvent.click(button(/^Continue/));
    fireEvent.click(screen.getByTestId("first-launch-scene"));
    expect(phase()).toBe("theme");
  });

  it("moves between the steps with Continue and Back; the indicator follows", async () => {
    await play();
    await toStep("lang");
    const indicator = () => within(screen.getByRole("list", { name: "Setup steps" }));
    expect(indicator().getByText("Language").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    // The step takes focus as it appears, so Tab starts on its cards.
    expect(document.activeElement).toHaveAttribute("data-step", "lang");

    fireEvent.click(button(/^Continue/));
    expect(heading()).toBe("Choose appearance");
    expect(indicator().getByText("Appearance").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
    fireEvent.click(button(/^Continue/));
    expect(heading()).toBe("Sign in to Paparats");
    expect(indicator().getByText("Account").closest("li")).toHaveAttribute("aria-current", "step");

    fireEvent.click(button("Back"));
    expect(heading()).toBe("Choose appearance");
    fireEvent.click(button("Back"));
    expect(heading()).toBe("Choose your language");
  });

  it("language: every card speaks its own language; a pick re-renders the panel at once", async () => {
    await play();
    await toStep("lang");
    expect(screen.getByText("Абярыце мову · Выберите язык")).toBeInTheDocument();
    const english = button(/^English/);
    expect(english).toHaveAttribute("aria-pressed", "true");
    expect(english).toHaveTextContent("Hidden gems for Windows.");
    expect(button(/^Беларуская/)).toHaveTextContent("Схаваныя скарбы для Windows.");
    expect(button(/^Русский/)).toHaveTextContent("Скрытые сокровища для Windows.");

    fireEvent.click(button(/^Беларуская/));
    await flush();
    expect(useSettingsStore.getState().settings.locale).toBe("be");
    expect(heading()).toBe("Абярыце мову");
    expect(screen.getByText("Choose your language · Выберите язык")).toBeInTheDocument();
    expect(button(/^Беларуская/)).toHaveAttribute("aria-pressed", "true");
    expect(button(/^Далей/)).toBeInTheDocument();
    expect(screen.getByText("Мова")).toBeInTheDocument();

    fireEvent.click(button(/^Русский/));
    await flush();
    expect(heading()).toBe("Выберите язык");
    expect(document.documentElement.lang).toBe("ru");
  });

  it("appearance: Light / Dark / System apply instantly", async () => {
    await play();
    await toStep("theme");
    expect(button("Dark")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("Light"));
    await flush();
    expect(useSettingsStore.getState().settings.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button("Light")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("System"));
    await flush();
    expect(useSettingsStore.getState().settings.theme).toBe("system");
  });

  it("Later persists the choice, lands on Home and hands the light to the hero", async () => {
    const { path } = await play({ route: "/settings/advanced" });
    await toStep("signin");
    await act(async () => {
      await useSettingsStore.getState().update({ locale: "ru", theme: "light" });
    });
    act(() => useUiStore.getState().setQuery("notes"));

    fireEvent.click(button("Позже"));
    expect(phase()).toBe("done");
    expect(path()).toBe("/home");
    expect(useUiStore.getState().query).toBe("");
    expect(useUiStore.getState().loading).toBe(false);
    expect(record()).toMatchObject({ seen: true, locale: "ru", theme: "light" });
    expect(useHomeStore.getState().heroGlow).toBe(true);
    // The step content goes at once; the overlay stays for the fade, then unmounts at 1.5 s.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    await flush(1499);
    expect(scene()).not.toBeNull();
    await flush(1);
    expect(scene()).toBeNull();
    expect(useHomeStore.getState().heroGlow).toBe(true);
    await flush(200);
    expect(useHomeStore.getState().heroGlow).toBe(false);
    expect(toast()).toBeNull();
  });

  it("Sign in with a typed email signs in and toasts 1.6 s later", async () => {
    const { services } = await play();
    await toStep("signin");
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "  new@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(button("Sign in"));
    expect(phase()).toBe("done");
    await flush(1599);
    expect(toast()).toBeNull();
    await flush(1);
    expect(toast()).toBe("Signed in as new@example.com");
    const account = await services.account.getAccount();
    expect(account.signedIn).toBe(true);
    expect(account.profile.email).toBe("new@example.com");
    expect(record()).toMatchObject({ seen: true });
  });

  it("Sign in without an email keeps the signed-in account and names it", async () => {
    const { services } = await play();
    const before = (await services.account.getAccount()).profile.email;
    await toStep("signin");
    await flush();
    fireEvent.click(button("Sign in"));
    await flush(1600);
    expect(toast()).toBe(`Signed in as ${before}`);
  });

  it("No account? Create one opens the sign-up page", async () => {
    const { services } = await play();
    const open = vi.spyOn(services.system, "openExternal");
    await toStep("signin");
    fireEvent.click(button("No account? Create one"));
    expect(open).toHaveBeenCalledWith(SIGNUP_URL);
    expect(phase()).toBe("signin");
  });

  it("without motion (Subtle animations off) it starts at the language step and stays", async () => {
    await play({ animations: false });
    expect(phase()).toBe("lang");
    expect(heading()).toBe("Choose your language");
    expect(skipButton()).toBeDisabled();
    expect(skipButton()).toHaveAttribute("aria-hidden", "true");
    await flush(6000);
    expect(phase()).toBe("lang");
  });

  it("with prefers-reduced-motion it starts at the language step", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      await play();
      expect(phase()).toBe("lang");
    } finally {
      window.matchMedia = original;
    }
  });

  it("replays from the start after finishing (Settings › Advanced › Replay first launch)", async () => {
    await play();
    await toStep("theme");
    fireEvent.click(button(/^Continue/));
    fireEvent.click(button("Later"));
    await flush(1500);
    expect(scene()).toBeNull();

    act(() => useFirstLaunchStore.getState().replay());
    expect(phase()).toBe("seed");
    expect(useHomeStore.getState().heroGlow).toBe(false);
    await flush(5400);
    expect(heading()).toBe("Choose your language");
  });

  it("does not play when the record says it was seen", async () => {
    localStorage.setItem(
      FIRST_RUN_KEY,
      JSON.stringify({ seen: true, locale: "en", theme: "dark", at: "2026-09-15T10:00:00Z" }),
    );
    await renderWithProviders(<FirstLaunch />);
    act(() => useFirstLaunchStore.getState().launch());
    expect(scene()).toBeNull();
  });
});

describe("FirstLaunch in the shell", () => {
  it("covers the shell (inert underneath) and hands over to Home", async () => {
    await renderApp({ route: "/library" });
    await screen.findByRole("heading", { level: 1, name: "Library" });
    vi.useFakeTimers();
    act(() => useFirstLaunchStore.getState().launch());
    const sidebar = screen.getByRole("navigation", { name: "Main" });
    expect(sidebar.closest("[inert]")).not.toBeNull();
    // The shell's drag strip is inert under the scene: the scene carries its own.
    expect(scene()?.querySelector("[data-tauri-drag-region]")).not.toBeNull();

    await flush(5400);
    expect(screen.getByRole("heading", { level: 1, name: "Choose your language" })).toBeVisible();
    fireEvent.click(button(/^Continue/));
    fireEvent.click(button(/^Continue/));
    const later = button("Later");
    later.focus();
    fireEvent.click(later);
    await flush();
    expect(sidebar.closest("[inert]")).toBeNull();
    // The focus leaves the finishing button for Home's column (no ring), ready for the next Tab.
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(useHomeStore.getState().heroGlow).toBe(true);
    await flush(1500);
    expect(scene()).toBeNull();
    expect(screen.getByRole("region", { name: "Highlights" })).toBeInTheDocument();
  });
});
