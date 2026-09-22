import type {
  ComponentPropsWithRef,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { cx } from "../internal/cx";
import { usePopover } from "./usePopover";
import styles from "./Popover.module.css";

/** Props to spread on the trigger element (usually a `Button` / `IconButton`). */
export interface PopoverTriggerProps {
  ref: (el: HTMLElement | null) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog" | "menu";
  "aria-controls": string | undefined;
}

export type PopoverAlign = "start" | "end";
export type PopoverSide = "bottom" | "top";

export interface PopoverSurfaceProps extends ComponentPropsWithRef<"div"> {
  align?: PopoverAlign;
  side?: PopoverSide;
  /** Content width, default 220px (README "220px popover"); padding and border add 14px. */
  width?: number;
}

/** The floating panel: `--card`, 1px `--line2`, radius 10, padding 6, `--shadow-popover`. */
export function PopoverSurface({
  align = "end",
  side = "bottom",
  width,
  className,
  style,
  ...rest
}: PopoverSurfaceProps) {
  return (
    <div
      {...rest}
      className={cx(styles.surface, styles[align], styles[side], className)}
      style={width === undefined ? style : { ...style, width }}
    />
  );
}

export interface PopoverProps {
  renderTrigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: PopoverAlign;
  side?: PopoverSide;
  width?: number;
  /** Accessible name of the panel (`role="dialog"`). */
  label?: string;
  className?: string;
}

/**
 * Anchored panel with arbitrary content. Toggles from its trigger, closes on a press outside,
 * on Escape (focus returns to the trigger) and when focus leaves it.
 */
export function Popover({
  renderTrigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  align,
  side,
  width,
  label,
  className,
}: PopoverProps) {
  const popover = usePopover({ open, defaultOpen, onOpenChange });
  const { isOpen, setOpen, close, anchorRef, setTrigger, surfaceId } = popover;

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      close(true);
    }
  };
  const onBlur = (event: FocusEvent<HTMLSpanElement>) => {
    const next = event.relatedTarget;
    if (isOpen && next instanceof Node && !event.currentTarget.contains(next)) close(false);
  };

  return (
    <span ref={anchorRef} className={styles.anchor} onKeyDown={onKeyDown} onBlur={onBlur}>
      {renderTrigger({
        ref: setTrigger,
        onClick: () => setOpen(!isOpen),
        "aria-expanded": isOpen,
        "aria-haspopup": "dialog",
        "aria-controls": isOpen ? surfaceId : undefined,
      })}
      {isOpen && (
        <PopoverSurface
          id={surfaceId}
          role="dialog"
          aria-label={label}
          align={align}
          side={side}
          width={width}
          className={className}
        >
          {children}
        </PopoverSurface>
      )}
    </span>
  );
}
