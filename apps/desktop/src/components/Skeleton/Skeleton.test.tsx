import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive tech and takes its size", () => {
    const { container } = render(<Skeleton width={180} height={18} radius={6} animated={false} />);
    const block = container.firstElementChild as HTMLElement;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block.style.width).toBe("180px");
    expect(block.style.height).toBe("18px");
    expect(block.style.animationDelay).toBe("");
  });

  it("staggers the shimmer phase by index", () => {
    const { container } = render(
      <>
        <Skeleton height={148} index={0} />
        <Skeleton height={148} index={3} />
        <Skeleton height={96} index={2} stagger={0.2} />
      </>,
    );
    const [first, fourth, wide] = Array.from(container.children) as HTMLElement[];
    expect(first?.style.animationDelay).toBe("");
    expect(fourth?.style.animationDelay).toBe("-0.36s");
    expect(wide?.style.animationDelay).toBe("-0.4s");
  });
});
