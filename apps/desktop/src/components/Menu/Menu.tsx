import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import { rovingIndex } from "../internal/roving";
import {
  PopoverSurface,
  usePopover,
  type PopoverAlign,
  type PopoverSide,
  type PopoverTriggerProps,
} from "../Popover";
import styles from "./Menu.module.css";

export interface MenuAction {
  type?: "item";
  id: string;
  label: string;
  icon?: IconName;
  /** Destructive action in `--danger` (Uninstall). */
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuDivider {
  type: "divider";
  id: string;
}

export type MenuEntry = MenuAction | MenuDivider;

export interface MenuProps {
  items: ReadonlyArray<MenuEntry>;
  /** Accessible name of the menu. */
  label: string;
  renderTrigger: (props: PopoverTriggerProps) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: PopoverAlign;
  side?: PopoverSide;
  width?: number;
  className?: string;
}

const isAction = (entry: MenuEntry | undefined): entry is MenuAction =>
  entry !== undefined && entry.type !== "divider";

/**
 * Overflow menu (220px popover): items 34px / 13px with a 15px `--text2` icon, dividers, a
 * destructive item (icon included) in `--danger`. Menu-button keyboard model: ↓/↑ on the trigger open at the first/last
 * item, arrows / Home / End move, Enter/Space select, Escape closes and refocuses the trigger.
 */
export function Menu({
  items,
  label,
  renderTrigger,
  open,
  defaultOpen,
  onOpenChange,
  align,
  side,
  width,
  className,
}: MenuProps) {
  const { isOpen, setOpen, close, anchorRef, setTrigger, surfaceId } = usePopover({
    open,
    defaultOpen,
    onOpenChange,
  });
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [focusOnOpen, setFocusOnOpen] = useState<"first" | "last">("first");
  const isEnabled = (i: number) => {
    const entry = items[i];
    return isAction(entry) && !entry.disabled;
  };

  // Move focus into the menu when it opens (only then — re-renders while open keep the focus).
  useEffect(() => {
    if (!isOpen) return;
    const enabled = surfaceRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    const target = focusOnOpen === "last" ? enabled?.item(enabled.length - 1) : enabled?.item(0);
    target?.focus();
  }, [isOpen, focusOnOpen]);

  const openAt = (where: "first" | "last") => {
    setFocusOnOpen(where);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openAt(event.key === "ArrowDown" ? "first" : "last");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const next = rovingIndex(current, event.key, items.length, isEnabled, "vertical");
    if (next === null) return;
    event.preventDefault();
    itemRefs.current[next]?.focus();
  };

  return (
    <span ref={anchorRef} className={styles.anchor}>
      {renderTrigger({
        ref: setTrigger,
        onClick: () => (isOpen ? close(false) : openAt("first")),
        onKeyDown: onTriggerKeyDown,
        "aria-expanded": isOpen,
        "aria-haspopup": "menu",
        "aria-controls": isOpen ? surfaceId : undefined,
      })}
      {isOpen && (
        <PopoverSurface
          ref={surfaceRef}
          id={surfaceId}
          role="menu"
          aria-label={label}
          aria-orientation="vertical"
          align={align}
          side={side}
          width={width}
          className={className}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((entry, index) =>
            isAction(entry) ? (
              <button
                key={entry.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={entry.disabled}
                className={cx(styles.item, entry.destructive && styles.destructive)}
                onClick={() => {
                  entry.onSelect();
                  close(true);
                }}
              >
                {entry.icon && <Icon name={entry.icon} size={15} className={styles.icon} />}
                <span className={styles.label}>{entry.label}</span>
              </button>
            ) : (
              <div key={entry.id} role="separator" className={styles.divider} />
            ),
          )}
        </PopoverSurface>
      )}
    </span>
  );
}
