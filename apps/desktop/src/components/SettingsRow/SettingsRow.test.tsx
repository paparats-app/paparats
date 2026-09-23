import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { SettingsCard } from "./SettingsCard";
import { SettingsRow } from "./SettingsRow";

const PATH = "C:\\Program Files\\Paparats\\Apps";

describe("SettingsRow", () => {
  it("theme: a Light / Dark / System segmented control", async () => {
    const onChange = vi.fn();
    render(
      <SettingsRow
        type="theme"
        title="Theme"
        hint="Light, dark…"
        value="dark"
        onChange={onChange}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(within(group).getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(within(group).getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("light");
  });

  it("language: native names, a check on the selected one, arrows move the choice", async () => {
    const onChange = vi.fn();
    render(
      <SettingsRow
        type="language"
        title="Language"
        value="en"
        options={LANGUAGES}
        onChange={onChange}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Language" });
    const english = within(group).getByRole("radio", { name: "English" });
    expect(english).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "Русский" })).toHaveTextContent("RU");
    await userEvent.click(within(group).getByRole("radio", { name: "Беларуская" }));
    expect(onChange).toHaveBeenLastCalledWith("be");
    english.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("ru");
  });

  it('language with selectedMark="code": the selected option keeps its code, no check', () => {
    const { container } = render(
      <SettingsRow
        type="language"
        title="Language"
        value="en"
        options={LANGUAGES}
        selectedMark="code"
        onChange={() => undefined}
      />,
    );
    const english = screen.getByRole("radio", { name: "English" });
    expect(english).toHaveAttribute("aria-checked", "true");
    expect(english).toHaveTextContent("EN");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("action: disabled ignores clicks", async () => {
    const onAction = vi.fn();
    render(
      <SettingsRow
        type="action"
        title="Signed in as serj.kaje@example.com"
        actionLabel="Sign out"
        onAction={onAction}
        disabled
      />,
    );
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("toggle and select are labelled by the row title", async () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    render(
      <>
        <SettingsRow type="toggle" title="Automatic updates" checked onChange={onToggle} />
        <SettingsRow
          type="select"
          title="Check frequency"
          value="daily"
          options={[
            { value: "hourly", label: "Every hour" },
            { value: "daily", label: "Every day" },
          ]}
          onChange={onSelect}
        />
      </>,
    );
    await userEvent.click(screen.getByRole("switch", { name: "Automatic updates" }));
    expect(onToggle).toHaveBeenCalledWith(false);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Check frequency" }),
      "hourly",
    );
    expect(onSelect).toHaveBeenCalledWith("hourly");
  });

  it("path, action, link and note rows", async () => {
    const onChange = vi.fn();
    const onAction = vi.fn();
    const onClick = vi.fn();
    render(
      <SettingsCard label="Rows">
        <SettingsRow type="path" title="Install location" value={PATH} onChange={onChange} />
        <SettingsRow type="action" title="Search history" actionLabel="Clear" onAction={onAction} />
        <SettingsRow
          type="link"
          title="Profile"
          hint="Name, email"
          actionLabel="Open"
          onClick={onClick}
        />
        <SettingsRow type="note" title="Paparats sends nothing home" hint="No telemetry." />
      </SettingsCard>,
    );
    expect(screen.getByRole("group", { name: "Rows" })).toBeInTheDocument();
    expect(screen.getByText(PATH)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change…" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await userEvent.click(screen.getByRole("button", { name: /Profile/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Paparats sends nothing home")).toBeInTheDocument();
  });
});
