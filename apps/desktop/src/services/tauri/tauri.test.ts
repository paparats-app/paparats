import { openUrl } from "@tauri-apps/plugin-opener";
import { ServiceError } from "../errors";
import { createMemoryStorage } from "../mock";
import { createTauriServices } from "./index";
import { unwrap } from "./result";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(openUrl).mockClear();
});

const create = () => createTauriServices({ latencyMs: 0, storage: createMemoryStorage() });

describe("unwrap", () => {
  it("returns the data of an ok result", async () => {
    await expect(unwrap(Promise.resolve({ status: "ok", data: 7 }))).resolves.toBe(7);
  });

  it("turns an error result into a ServiceError of the same kind", async () => {
    const pending = unwrap(
      Promise.resolve({ status: "error", error: { kind: "notFound", message: "no app" } }),
    );
    await expect(pending).rejects.toBeInstanceOf(ServiceError);
    await expect(pending).rejects.toMatchObject({ kind: "notFound", message: "no app" });
  });

  it("turns an IPC failure into an internal ServiceError", async () => {
    await expect(unwrap(Promise.reject(new Error("ipc down")))).rejects.toMatchObject({
      kind: "internal",
      message: "ipc down",
    });
  });
});

describe("tauri services", () => {
  it("system.today is the real local date, and delegates stamp it too", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 5, 23, 30));
    const services = create();
    expect(services.system.today()).toBe("2027-01-05");

    const account = await services.account.purchase("monthly");
    expect(account.subscription.renewsOn).toBe("2027-02-05");
  });

  it("opens external links through the opener plugin", async () => {
    const services = create();
    await services.system.openExternal("nilesoft.org/support");
    expect(openUrl).toHaveBeenCalledWith("https://nilesoft.org/support");

    await expect(services.system.openExternal("file:///C:/")).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(openUrl).toHaveBeenCalledTimes(1);
  });

  it("reports an opener failure as a ServiceError", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce("not allowed");
    await expect(create().system.openExternal("https://paparats.app")).rejects.toMatchObject({
      kind: "internal",
      message: "not allowed",
    });
  });

  it("delegates the other services to the mock world", async () => {
    const services = create();
    expect((await services.catalog.getCatalog()).apps).toHaveLength(32);
    expect(await services.channels.lookup("@winaero")).toMatchObject({ kind: "found" });
    expect((await services.settings.getSettings()).parallel).toBe(2);
    expect((await services.downloads.getSnapshot()).items).toEqual([]);
  });
});
