import { NAV_SKELETON_MS, SEARCH_SKELETON_MS, TOAST_MS, useUiStore } from "./useUiStore";

const ui = () => useUiStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState(useUiStore.getInitialState(), true);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("search", () => {
  it("shows the searching state for 340 ms after typing", () => {
    ui().setQuery("obs");
    expect(ui()).toMatchObject({ query: "obs", searching: true });
    vi.advanceTimersByTime(SEARCH_SKELETON_MS - 1);
    expect(ui().searching).toBe(true);
    vi.advanceTimersByTime(1);
    expect(ui().searching).toBe(false);
    expect(SEARCH_SKELETON_MS).toBe(340);
  });

  it("restarts the timer on every keystroke", () => {
    ui().setQuery("o");
    vi.advanceTimersByTime(300);
    ui().setQuery("ob");
    vi.advanceTimersByTime(300);
    expect(ui().searching).toBe(true);
    vi.advanceTimersByTime(40);
    expect(ui().searching).toBe(false);
  });

  it("does not search for a blank query", () => {
    ui().setQuery("obs");
    ui().setQuery("   ");
    expect(ui()).toMatchObject({ query: "   ", searching: false });
    vi.advanceTimersByTime(SEARCH_SKELETON_MS);
    expect(ui().searching).toBe(false);
  });

  it("can set the query without the skeleton (suggestion chips)", () => {
    ui().setQuery("Obsidian", { skeleton: false });
    expect(ui()).toMatchObject({ query: "Obsidian", searching: false });
  });

  it("clears the query and a pending timer", () => {
    ui().setQuery("obs");
    ui().clearQuery();
    expect(ui()).toMatchObject({ query: "", searching: false });
    ui().setQuery("x", { skeleton: false });
    vi.advanceTimersByTime(SEARCH_SKELETON_MS);
    expect(ui().query).toBe("x");
  });
});

describe("toast", () => {
  it("shows a toast for 2.8 s", () => {
    ui().notify("Saved");
    expect(ui().toast?.message).toBe("Saved");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(ui().toast).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(ui().toast).toBeNull();
  });

  it("replaces the toast and restarts the timer", () => {
    ui().notify("First");
    const firstId = ui().toast?.id;
    vi.advanceTimersByTime(2000);
    ui().notify("First");
    expect(ui().toast?.id).not.toBe(firstId);
    vi.advanceTimersByTime(2000);
    expect(ui().toast?.message).toBe("First");
    ui().notify("Second");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(ui().toast?.message).toBe("Second");
    vi.advanceTimersByTime(1);
    expect(ui().toast).toBeNull();
  });

  it("can be dismissed", () => {
    ui().notify("Bye");
    ui().dismissToast();
    expect(ui().toast).toBeNull();
  });
});

describe("navigation", () => {
  it("bumps navCount and shows the skeleton for 420 ms", () => {
    ui().beginNavigation({ skeleton: true });
    expect(ui()).toMatchObject({ navCount: 1, loading: true });
    vi.advanceTimersByTime(NAV_SKELETON_MS - 1);
    expect(ui().loading).toBe(true);
    vi.advanceTimersByTime(1);
    expect(ui().loading).toBe(false);
  });

  it("skips the skeleton when animations are off", () => {
    ui().beginNavigation({ skeleton: false });
    expect(ui()).toMatchObject({ navCount: 1, loading: false });
  });

  it("restarts the skeleton on a quick second navigation and clears the search", () => {
    ui().setQuery("obs");
    ui().beginNavigation({ skeleton: true });
    expect(ui()).toMatchObject({ query: "", searching: false });
    vi.advanceTimersByTime(300);
    ui().beginNavigation({ skeleton: true });
    vi.advanceTimersByTime(300);
    expect(ui()).toMatchObject({ navCount: 2, loading: true });
    vi.advanceTimersByTime(120);
    expect(ui().loading).toBe(false);
  });
});
