import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { BenefitStrip } from "./BenefitStrip";
import { SubscriptionPlan, type SubscriptionPlanProps } from "./SubscriptionPlan";

const base: SubscriptionPlanProps = {
  name: "Paparats Pro",
  subtitle: "Unlock the full experience",
  price: "$4.99",
  period: "/ month",
  features: ["Pro features in all apps", "Early access to new apps"],
  buttonLabel: "Choose plan",
  onSelect: () => {},
};

describe("SubscriptionPlan", () => {
  it("renders the recommended plan with a mint button and its badge", async () => {
    const onSelect = vi.fn();
    render(<SubscriptionPlan {...base} badge="Most popular" recommended onSelect={onSelect} />);
    const card = screen.getByRole("article");
    expect(card).toHaveClass("recommended");
    expect(within(card).getByText("Most popular")).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    const button = screen.getByRole("button", { name: "Choose plan" });
    expect(button).toHaveAttribute("data-variant", "primary");
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("marks the current plan and disables its button", async () => {
    const onSelect = vi.fn();
    render(<SubscriptionPlan {...base} current recommended onSelect={onSelect} />);
    const card = screen.getByRole("article");
    expect(card).toHaveClass("current");
    expect(card).not.toHaveClass("recommended");
    expect(card).toHaveAttribute("aria-current", "true");
    const button = screen.getByRole("button", { name: "Current plan" });
    expect(button).toBeDisabled();
    expect(within(card).getAllByText("Current plan")).toHaveLength(2);
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("BenefitStrip", () => {
  it("lays out one cell per benefit", () => {
    render(
      <BenefitStrip
        items={[
          { icon: "sparkles", title: "Unlock Pro features", subtitle: "Get more from every app" },
          { icon: "layers", title: "One simple plan", subtitle: "All apps, one subscription" },
        ]}
      />,
    );
    const list = screen.getByRole("list");
    expect(list.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });
});
