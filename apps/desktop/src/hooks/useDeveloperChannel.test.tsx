import { waitFor } from "@testing-library/react";
import { renderWithServices } from "./testing";
import { DEVELOPER_CHANNEL_ID, useDeveloperChannel } from "./useDeveloperChannel";

describe("useDeveloperChannel", () => {
  it("acts as Nilesoft and lists the apps it publishes", async () => {
    const { result } = renderWithServices(() => useDeveloperChannel());
    expect(result.current.id).toBe(DEVELOPER_CHANNEL_ID);
    expect(result.current.id).toBe("nilesoft");
    // Nothing while the channels and the catalog load.
    expect(result.current.channel).toBeUndefined();
    expect(result.current.apps).toEqual([]);

    await waitFor(() => expect(result.current.channel?.name).toBe("Nilesoft"));
    await waitFor(() => expect(result.current.apps.map((a) => a.id)).toEqual(["shell"]));
    expect(result.current.channel).toMatchObject({ mono: "Ni", tint: "#3b6fd1" });
  });
});
