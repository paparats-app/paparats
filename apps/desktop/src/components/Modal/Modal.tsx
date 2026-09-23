import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../Button";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import { focusableIn } from "../internal/focusable";
import styles from "./Modal.module.css";

export type ModalWidth = 440 | 460 | 480 | 560;

export interface ModalProps {
  open: boolean;
  /** Escape, a backdrop press or the × button. */
  onClose: () => void;
  title: ReactNode;
  /** 13px `--text2` line under the title (release dialog). */
  subtitle?: ReactNode;
  /** Header media: a `ModalIcon`, an `AppIcon`, … */
  icon?: ReactNode;
  /** Body. Plain text gets the 14px/1.5 `--text2` style. */
  children?: ReactNode;
  /** Buttons, right-aligned. */
  footer?: ReactNode;
  /** Note left of the footer buttons (12.5px `--text3`). */
  footerNote?: ReactNode;
  /** 440 plan · 460 report / trust · 480 release · 560 add channel / suggest idea. */
  width?: ModalWidth;
  /**
   * `confirm`: 24px padding, compact header (plan, report, trust, release).
   * `form`: header 20/24 with the × button, 18px section spacing (add channel, suggest idea).
   */
  layout?: "confirm" | "form";
  /** Shows the × button with this accessible name. */
  closeLabel?: string;
  /** Element focused on open (default: the first focusable control in the body/footer). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  /** Render into this element (e.g. `document.body`) instead of in place. */
  portalTo?: Element | null;
  className?: string;
}

/**
 * Modal dialog: `--scrim` backdrop, radius 12, `--shadow-modal`. `role="dialog"` + `aria-modal`,
 * focus trapped inside, Escape / backdrop close, focus restored to the opener on close.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  footerNote,
  width = 440,
  layout = "confirm",
  closeLabel,
  initialFocusRef,
  closeOnBackdrop = true,
  portalTo,
  className,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const pressStartedOnBackdrop = useRef(false);

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const preferred = initialFocusRef?.current;
    const inBody = bodyRef.current ? focusableIn(bodyRef.current) : [];
    // With nothing to fill in, start on the first footer button (Cancel), never on ×.
    const inFooter = footerRef.current ? focusableIn(footerRef.current) : [];
    (preferred ?? inBody[0] ?? inFooter[0] ?? dialog)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = focusableIn(dialogRef.current);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    pressStartedOnBackdrop.current = event.target === event.currentTarget;
  };
  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    const fromBackdrop = pressStartedOnBackdrop.current && event.target === event.currentTarget;
    pressStartedOnBackdrop.current = false;
    if (fromBackdrop && closeOnBackdrop) onClose();
  };

  const hasFooter = footer !== undefined || footerNote !== undefined;
  const dialog = (
    <div className={styles.backdrop} onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(styles.dialog, styles[layout], styles[`w${width}`], className)}
        data-width={width}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          {icon}
          <div className={styles.titles}>
            <div id={titleId} className={styles.title}>
              {title}
            </div>
            {subtitle !== undefined && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          {closeLabel !== undefined && (
            <IconButton
              icon="x"
              label={closeLabel}
              size="compact"
              iconStrokeWidth={2}
              onClick={onClose}
            />
          )}
        </div>
        {children !== undefined && (
          <div ref={bodyRef} className={styles.body}>
            {children}
          </div>
        )}
        {hasFooter && (
          <div ref={footerRef} className={styles.footer}>
            {footerNote !== undefined && <div className={styles.footerNote}>{footerNote}</div>}
            <div className={styles.actions}>{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
  return portalTo ? createPortal(dialog, portalTo) : dialog;
}

export interface ModalIconProps {
  name: IconName;
  /** `mint` (add channel, idea, release) · `neutral` (report) · `warn` (trust confirmation). */
  tone?: "mint" | "neutral" | "warn";
}

const ICON_TONE = {
  mint: styles.iconMint,
  neutral: styles.iconNeutral,
  warn: styles.iconWarn,
} as const;

/** 36px header tile, radius 9, with an 18px icon at stroke 2 (every prototype dialog). */
export function ModalIcon({ name, tone = "mint" }: ModalIconProps) {
  return (
    <span className={cx(styles.icon, ICON_TONE[tone])} aria-hidden="true">
      <Icon name={name} size={18} strokeWidth={2} />
    </span>
  );
}
