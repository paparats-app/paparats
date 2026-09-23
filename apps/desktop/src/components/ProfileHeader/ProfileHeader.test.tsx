import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import "@/i18n";
import { ProfileHeader, type ProfileDraft } from "./ProfileHeader";

function Harness({ onSave }: { onSave: (draft: ProfileDraft) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({ name: "Serj Kaje", email: "s@example.com" });
  return (
    <ProfileHeader
      name="Serj Kaje"
      email="s@example.com"
      initials="SK"
      memberSince="September 2024"
      editing={editing}
      draft={draft}
      onDraftChange={setDraft}
      onEdit={() => setEditing(true)}
      onSave={() => {
        onSave(draft);
        setEditing(false);
      }}
      onCancel={() => setEditing(false)}
      onChangePhoto={() => {}}
      photoLabel="Change photo"
    />
  );
}

describe("ProfileHeader", () => {
  it("shows the identity, then edits and saves the draft", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    expect(screen.getByRole("heading", { name: "Serj Kaje" })).toBeInTheDocument();
    expect(screen.getByText("Member since September 2024")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Serj K.{Enter}");
    expect(onSave).toHaveBeenCalledWith({ name: "Serj K.", email: "s@example.com" });
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("hands out the Edit profile button and the Name input through refs", async () => {
    const editButton = createRef<HTMLButtonElement>();
    const nameInput = createRef<HTMLInputElement>();
    const props = {
      name: "Serj Kaje",
      email: "s@example.com",
      initials: "SK",
      memberSince: "September 2024",
      draft: { name: "Serj Kaje", email: "s@example.com" },
      onDraftChange: () => {},
      onEdit: () => {},
      onSave: () => {},
      onCancel: () => {},
      editButtonRef: editButton,
      nameInputRef: nameInput,
    };
    const { rerender } = render(<ProfileHeader {...props} editing={false} />);
    expect(editButton.current).toBe(screen.getByRole("button", { name: "Edit profile" }));
    expect(nameInput.current).toBeNull();
    rerender(<ProfileHeader {...props} editing />);
    expect(nameInput.current).toBe(screen.getByLabelText("Name"));
    expect(editButton.current).toBeNull();
  });

  it("cancels without saving", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(screen.getByLabelText("Email")).toHaveValue("s@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
  });
});

describe("ProfileHeader saving", () => {
  it("keeps Save busy and does not save twice while saving", async () => {
    const onSave = vi.fn();
    render(
      <ProfileHeader
        name="Serj Kaje"
        email="s@example.com"
        initials="SK"
        memberSince="September 2024"
        editing
        saving
        draft={{ name: "Serj", email: "s@example.com" }}
        onDraftChange={() => {}}
        onEdit={() => {}}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-busy", "true");
    await userEvent.click(save);
    await userEvent.type(screen.getByLabelText("Name"), "{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });
});
