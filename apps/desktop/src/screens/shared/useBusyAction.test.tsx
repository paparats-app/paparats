import { act, renderHook } from "@testing-library/react";
import { useBusyAction } from "./useBusyAction";

describe("useBusyAction", () => {
  it("is busy while the task runs and ignores a second run meanwhile", async () => {
    const { result } = renderHook(() => useBusyAction());
    let finish: () => void = () => {};
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current[1](task);
      // Same frame, before any re-render: still ignored.
      void result.current[1](task);
    });
    expect(result.current[0]).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await first;
    });
    expect(result.current[0]).toBe(false);

    // Once settled, it runs again.
    let second: Promise<void> = Promise.resolve();
    act(() => {
      second = result.current[1](task);
    });
    expect(task).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish();
      await second;
    });
  });

  it("clears the busy state when the task fails and passes the failure on", async () => {
    const { result } = renderHook(() => useBusyAction());
    let caught: unknown;
    await act(async () => {
      await result.current[1](() => Promise.reject(new Error("down"))).catch((e: unknown) => {
        caught = e;
      });
    });
    expect(caught).toBeInstanceOf(Error);
    expect(result.current[0]).toBe(false);
  });
});
