import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryStorage, createMockServices } from "@/services/mock";
import type { MockServices } from "@/services/mock";
import { ServicesProvider } from "@/services/registry";
import type { Account, ChannelInfo, ChannelSubscription, Idea, Library } from "@/services/types";
import {
  createQueryClient,
  queryKeys,
  upsertIdea,
  useAccount,
  useAccountActions,
  useCatalog,
  useChannelActions,
  useChannels,
  useIdeaActions,
  useIdeas,
  useLibrary,
  useLibraryActions,
  usePlatform,
  useSubscriptions,
} from "./index";

let services: MockServices;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>{children}</ServicesProvider>
    </QueryClientProvider>
  );
}

/** The cache right now: actions write it as soon as the service answers. */
function cached<T>(key: readonly unknown[]): T | undefined {
  return queryClient.getQueryData<T>(key);
}

/**
 * Renders a read hook next to its action hook and waits for the first load. `data` is read during
 * render, as a component would (TanStack only re-renders for properties read while rendering).
 */
async function setup<T, A>(read: () => UseQueryResult<T>, actions: () => A) {
  const view = renderHook(
    () => {
      const { data, isSuccess } = read();
      return { data, isSuccess, act: actions() };
    },
    { wrapper },
  );
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  return view;
}

beforeEach(() => {
  services = createMockServices({ latencyMs: 0, storage: createMemoryStorage() });
  queryClient = createQueryClient();
});

afterEach(() => {
  services.dispose();
  queryClient.clear();
  vi.restoreAllMocks();
});

describe("createQueryClient", () => {
  it("keeps data fresh forever and does not retry in tests", () => {
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(Infinity);
    expect(defaults?.retry).toBe(false);
    expect(createQueryClient({ retry: 2 }).getDefaultOptions().queries?.retry).toBe(2);
  });
});

describe("read hooks", () => {
  it("useCatalog / usePlatform load under [service, method] keys", async () => {
    const { result } = renderHook(() => ({ catalog: useCatalog(), platform: usePlatform() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.catalog.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.platform.isSuccess).toBe(true));
    expect(result.current.catalog.data?.apps).toHaveLength(32);
    expect(cached(["catalog", "getPlatform"])).toEqual(result.current.platform.data);
  });

  it("surfaces a rejected service call as the query error", async () => {
    vi.spyOn(services.account, "getAccount").mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");
  });
});

describe("useLibraryActions", () => {
  it("writes the returned library into the cache without refetching", async () => {
    const getLibrary = vi.spyOn(services.install, "getLibrary");
    const view = await setup(useLibrary, useLibraryActions);
    const { act: actions } = view.result.current;

    await act(() => actions.setFavorite("krita", true));
    expect(cached<Library>(queryKeys.library)?.favorites).toContain("krita");
    await waitFor(() => expect(view.result.current.data?.favorites).toContain("krita"));

    await act(() => actions.uninstall("vlc"));
    const installed = cached<Library>(queryKeys.library)?.installed ?? [];
    expect(installed.some((a) => a.appId === "vlc")).toBe(false);
    expect(getLibrary).toHaveBeenCalledTimes(1);

    await expect(actions.open("vlc")).resolves.toBeUndefined();
    await expect(actions.openInstallFolder("vlc")).resolves.toBeUndefined();
  });

  it("keeps the same action object across renders", async () => {
    const view = await setup(useLibrary, useLibraryActions);
    const first = view.result.current.act;
    view.rerender();
    expect(view.result.current.act).toBe(first);
  });
});

describe("useChannelActions", () => {
  it("writes subscriptions after subscribe / setPaused / acknowledgeStale / unsubscribe", async () => {
    const view = await setup(useSubscriptions, useChannelActions);
    const { act: actions } = view.result.current;
    const list = () => cached<ChannelSubscription[]>(queryKeys.subscriptions) ?? [];
    const ids = () => list().map((s) => s.channelId);

    await act(() => actions.subscribe("vitrazh"));
    expect(ids()).toEqual(["paparats", "kvetka", "fossfriends", "vitrazh"]);
    await waitFor(() => expect(view.result.current.data).toHaveLength(4));

    await act(() => actions.setPaused("vitrazh", true));
    expect(list().at(-1)?.paused).toBe(true);

    await act(() => actions.acknowledgeStale("fossfriends"));
    expect(list()[2]?.staleAcknowledged).toBe(true);

    await act(() => actions.unsubscribe("vitrazh"));
    expect(ids()).toEqual(["paparats", "kvetka", "fossfriends"]);
  });

  it("propagates rejections and leaves the cache untouched", async () => {
    const view = await setup(useSubscriptions, useChannelActions);
    const before = cached(queryKeys.subscriptions);
    await expect(view.result.current.act.unsubscribe("paparats")).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(cached(queryKeys.subscriptions)).toBe(before);
  });

  it("sync stamps the channel in the channels cache; lookup and report pass through", async () => {
    const view = await setup(useChannels, useChannelActions);
    const { act: actions } = view.result.current;
    const synced = (id: string) =>
      cached<ChannelInfo[]>(queryKeys.channels)?.find((c) => c.id === id)?.synced;

    expect(synced("kvetka")).toBe("2026-09-14");
    await act(() => actions.sync("kvetka"));
    expect(synced("kvetka")).toBe("2026-09-15");

    const outage = await actions.sync("fossfriends");
    expect(outage).toEqual({ kind: "unreachable", days: 16 });
    expect(synced("fossfriends")).toBe("2026-09-15");

    expect(await actions.lookup("@mpvbuilds")).toMatchObject({ kind: "found" });
    expect(await actions.report({ appId: null, channelId: "paparats" }, "Hi")).toEqual({
      kind: "paparats",
    });
  });
});

describe("useIdeaActions", () => {
  it("replaces only the changed idea and puts a proposed one on top", async () => {
    const view = await setup(useIdeas, useIdeaActions);
    const { act: actions } = view.result.current;
    const list = () => cached<Idea[]>(queryKeys.ideas) ?? [];
    const before = list();

    await act(() => actions.vote("clip"));
    expect(list().find((i) => i.id === "clip")).toMatchObject({ votes: 215, voted: true });
    expect(list()[1]).toBe(before[1]);
    await waitFor(() =>
      expect(view.result.current.data?.find((i) => i.id === "clip")?.voted).toBe(true),
    );

    await act(() =>
      actions.propose({
        kind: "new",
        appId: null,
        category: "system",
        title: "Tray battery meter",
        body: "",
      }),
    );
    expect(list()[0]).toMatchObject({ id: "u1", mine: true });
    expect(list()).toHaveLength(before.length + 1);

    await act(() => actions.take("u1", "kvetka"));
    await act(() => actions.comment("u1", "Soon", { kind: "user" }));
    await act(() => actions.release("u1", "shell", "1.9.16"));
    await act(() => actions.dismissReleaseNote("u1"));
    expect(list()[0]).toMatchObject({
      status: "released",
      dev: "kvetka",
      releasedVersion: "1.9.16",
      releaseNoteDismissed: true,
      comments: [{ text: "Soon", mine: true }],
    });
  });

  it("upsertIdea replaces by id or prepends", () => {
    const a = { id: "a", votes: 1 } as Idea;
    const b = { id: "b", votes: 1 } as Idea;
    expect(upsertIdea([a, b], { ...b, votes: 2 }).map((i) => [i.id, i.votes])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect(upsertIdea([a], b).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("useAccountActions", () => {
  it("writes the returned account into the cache", async () => {
    const view = await setup(useAccount, useAccountActions);
    const { act: actions } = view.result.current;
    const account = () => cached<Account>(queryKeys.account);

    await act(() => actions.purchase("yearly"));
    expect(account()?.subscription).toMatchObject({ plan: "yearly", renewsOn: "2027-09-15" });
    await waitFor(() => expect(view.result.current.data?.subscription.plan).toBe("yearly"));

    await act(() => actions.cancelPlan());
    await act(() => actions.claimIdeaBonus());
    expect(account()?.subscription).toEqual({
      plan: "free",
      renewsOn: null,
      giftUntil: "2026-12-15",
    });

    await act(() => actions.updateProfile({ name: "Serj", email: "s@example.com" }));
    await act(() => actions.removeDevice("dev-2"));
    await act(() => actions.setTwoFactor(false));
    await act(() => actions.signOut());
    expect(account()).toMatchObject({
      signedIn: false,
      twoFactor: false,
      profile: { name: "Serj", email: "s@example.com" },
    });
    expect(account()?.devices).toHaveLength(1);

    await act(() => actions.signIn("me@example.org", "pw"));
    expect(account()).toMatchObject({ signedIn: true, profile: { email: "me@example.org" } });
  });
});
