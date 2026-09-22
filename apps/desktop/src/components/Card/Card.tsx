import { createElement, type HTMLAttributes, type Ref } from "react";
import { cx } from "../internal/cx";
import styles from "./Card.module.css";

export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  as?: "div" | "section" | "aside" | "article" | "li";
  /** `none` · `sm` 12 (app card) · `md` 16/18 (aside cards) · `lg` 18/20 (profile aside) · `xl` 24. */
  padding?: CardPadding;
  /** 10 (card, row) or 12 (large card, panel). */
  radius?: 10 | 12;
  /** Hover border `--line2` (clickable cards). */
  interactive?: boolean;
  /** `mint`: the Pro / released-idea gradient (`--mint-soft` → `--card`). */
  tone?: "plain" | "mint";
  /** Clip children to the radius (rows with rules, expandable panels). */
  clip?: boolean;
}

/** Surface: `--card`, 1px `--line`, radius 10/12. */
export function Card({
  as = "div",
  padding = "md",
  radius = 10,
  interactive = false,
  tone = "plain",
  clip = false,
  className,
  ...rest
}: CardProps) {
  return createElement(as, {
    ...rest,
    className: cx(
      styles.card,
      styles[`p${padding}`],
      radius === 12 && styles.r12,
      interactive && styles.interactive,
      tone === "mint" && styles.mint,
      clip && styles.clip,
      className,
    ),
  });
}
