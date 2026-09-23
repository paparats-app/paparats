// `nativeWindow.onResized` against a fake core that, like the real one, hears about an unlisten
// only after the JS side has already dropped the callback (M9 acceptance: React's development
// StrictMode unsubscribed and resubscribed the window controls while the window was being shown,
// and the core's resize event reached a missing callback — "[TAURI] Couldn't find callback id").
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";

type Args = Record<string, unknown>;

interface FakeCore {
  calls: { cmd: string; args: Args }[];
  /** The core emits `event` to every handler it still has registered. */
  emit(event: string): void;
}

/** A core that keeps a listener until an unlisten reaches it (never, within a test tick). */
function fakeCore(): FakeCore {
  const calls: FakeCore["calls"] = [];
  const handlers = new Map<string, number[]>();
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = (payload ?? {}) as Args;
    calls.push({ cmd, args });
    if (cmd === "plugin:event|listen") {
      const event = String(args.event);
      const handler = Number(args.handler);
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return handler;
    }
    return null;
  });
  return {
    calls,
    emit(event) {
      const internals = (
        window as unknown as {
          __TAURI_INTERNALS__: { runCallback(id: number, data: unknown): void };
        }
      ).__TAURI_INTERNALS__;
      for (const id of handlers.get(event) ?? []) {
        internals.runCallback(id, { event, id: 1, payload: { width: 1440, height: 920 } });
      }
    },
  };
}

async function loadWindowModule() {
  vi.resetModules();
  return import("./window");
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  clearMocks();
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  vi.restoreAllMocks();
});

describe("nativeWindow.onResized", () => {
  it("keeps one native listener while components subscribe, leave and come back", async () => {
    const core = fakeCore();
    const { nativeWindow } = await loadWindowModule();
    const warn = vi.spyOn(console, "warn");
    const first = vi.fn();
    const second = vi.fn();

    // StrictMode: mount, unmount, mount again.
    const leave = nativeWindow.onResized(first);
    leave();
    const stop = nativeWindow.onResized(second);
    await flush();
    core.emit("tauri://resize");

    const listens = core.calls.filter((c) => c.cmd === "plugin:event|listen");
    expect(listens).toHaveLength(1);
    expect(listens[0]?.args.event).toBe("tauri://resize");
    expect(core.calls.some((c) => c.cmd === "plugin:event|unlisten")).toBe(false);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();

    stop();
    core.emit("tauri://resize");
    expect(second).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("gives each subscription its own unsubscribe, also for the same callback", async () => {
    const core = fakeCore();
    const { nativeWindow } = await loadWindowModule();
    const cb = vi.fn();
    const a = nativeWindow.onResized(cb);
    nativeWindow.onResized(cb);
    await flush();
    a();
    core.emit("tauri://resize");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("listens again after the registration failed", async () => {
    const calls: string[] = [];
    let fail = true;
    mockWindows("main");
    mockIPC((cmd) => {
      calls.push(cmd);
      if (cmd === "plugin:event|listen" && fail) throw new Error("not ready");
      return 1;
    });
    const { nativeWindow } = await loadWindowModule();
    nativeWindow.onResized(() => undefined);
    await flush();
    fail = false;
    nativeWindow.onResized(() => undefined);
    await flush();
    expect(calls.filter((c) => c === "plugin:event|listen")).toHaveLength(2);
  });

  it("does nothing in a plain browser", async () => {
    const { nativeWindow } = await loadWindowModule();
    const stop = nativeWindow.onResized(() => undefined);
    expect(stop).toBeTypeOf("function");
    stop();
    expect("__TAURI_INTERNALS__" in window).toBe(false);
  });
});
