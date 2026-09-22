import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORY_PHOTOS, CategoryCard, CategoryChip } from "./CategoryCard";

describe("CategoryCard", () => {
  it("renders the tile with its photo and handles clicks", async () => {
    const onClick = vi.fn();
    render(
      <CategoryCard
        label="Productivity"
        description="Get more done."
        countLabel="142 apps"
        icon="laptop"
        photo={CATEGORY_PHOTOS.productivity}
        onClick={onClick}
      />,
    );
    const tile = screen.getByRole("button", { name: /Productivity/ });
    expect(tile).toHaveTextContent("Get more done.");
    expect(tile).toHaveTextContent("142 apps");
    expect(tile.style.getPropertyValue("--photo")).toContain(CATEGORY_PHOTOS.productivity);
    await userEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has a photograph for every category", () => {
    expect(Object.keys(CATEGORY_PHOTOS)).toHaveLength(9);
    for (const url of Object.values(CATEGORY_PHOTOS)) expect(url).toMatch(/cat-.+\.webp/);
  });
});

describe("CategoryChip", () => {
  it("shows the label and count", async () => {
    const onClick = vi.fn();
    render(
      <CategoryChip label="Development" countLabel="118 apps" icon="code" onClick={onClick} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Development\s*118 apps/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
