// Keyboard and accessibility helpers for the screens' a11y smoke tests (M6): the whole shell
// with animations off, tabbing into a screen from the top bar, named controls. Test-only; not
// exported by the barrel.
import { act, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { expect } from "vitest";
import type { MockServices } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createTestServices, renderApp } from "@/test/render";

/** Renders the whole app at `route` with "Subtle animations" off (no navigation skeleton). */
export async function openScreen(route: string, services: MockServices = createTestServices()) {
  const user = userEvent.setup();
  const rendered = await renderApp({ route, services });
  await act(async () => {
    await useSettingsStore.getState().update({ animations: false });
  });
  return { ...rendered, user };
}

/** The content column. */
export const content = () => screen.getByRole("main");

/**
 * Focuses the top bar's avatar — the last stop before the screen (the offline banner aside) — so
 * the next Tab lands on the screen's first control.
 */
export function focusBeforeScreen(): void {
  screen.getByRole("button", { name: "Profile" }).focus();
}

type Target = HTMLElement | (() => HTMLElement);

/** Presses Tab once per target and checks that the focus lands on it. */
export async function expectTabOrder(user: UserEvent, targets: readonly Target[]): Promise<void> {
  for (const target of targets) {
    await user.tab();
    expect(typeof target === "function" ? target() : target).toHaveFocus();
  }
}

const NAMED_ROLES = [
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "progressbar",
] as const;

/** Every control (and progress bar) inside `root` has an accessible name. */
export function expectNamedControls(root: HTMLElement = content()): void {
  for (const role of NAMED_ROLES) {
    for (const el of within(root).queryAllByRole(role)) expect(el).toHaveAccessibleName();
  }
}
