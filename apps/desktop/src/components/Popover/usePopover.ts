import { useCallback, useEffect, useId, useRef } from "react";
import { useControllableState } from "../internal/useControllableState";

export interface UsePopoverOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Open state + dismissal for an anchored popover: closes on a press outside the anchor and
 * exposes `close(restoreFocus)` that hands focus back to the trigger.
 */
export function usePopover({ open, defaultOpen = false, onOpenChange }: UsePopoverOptions) {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const surfaceId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onPress = (event: MouseEvent) => {
      const anchor = anchorRef.current;
      if (anchor && event.target instanceof Node && !anchor.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPress, true);
    return () => document.removeEventListener("mousedown", onPress, true);
  }, [isOpen, setOpen]);

  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  const setTrigger = useCallback((el: HTMLElement | null) => {
    triggerRef.current = el;
  }, []);

  return { isOpen, setOpen, close, anchorRef, setTrigger, surfaceId };
}
