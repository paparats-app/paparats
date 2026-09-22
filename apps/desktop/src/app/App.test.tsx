import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders window controls", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
