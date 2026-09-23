import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./SubscriptionPlan.module.css";

export interface SubscriptionPlanProps {
  name: string;
  subtitle: string;
  /** Preformatted price ("$4.99") and period ("/ month", "forever"). */
  price: string;
  period: string;
  features: readonly string[];
  /** "Most popular" / "Save 18%" pill (`--mint-soft` / `--mint2`); kept on the current plan too. */
  badge?: string;
  /**
   * The plan in effect: `--mint` border, a "Current plan" pill after the badge, and an inert
   * "Current plan" button (`aria-disabled`, no action) that keeps the pointer and the hover.
   */
  current?: boolean;
  /** Recommended plan (monthly): `--mint-border` border and a mint button. */
  recommended?: boolean;
  /** "Choose plan" / "Cancel plan"; "Current plan" is shown while `current`. */
  buttonLabel: string;
  onSelect: () => void;
  className?: string;
}

/**
 * Subscription plan card: header + pills, 32px price block over a 1px rule, mint-check features,
 * 40px footer button (prototype lines 700–707, `planList`). The pills sit beside the name as in
 * the prototype; when both show (the promo pill and "Current plan") and they do not fit side by
 * side, they wrap onto a second row inside the card instead of running past it.
 */
export function SubscriptionPlan({
  name,
  subtitle,
  price,
  period,
  features,
  badge,
  current = false,
  recommended = false,
  buttonLabel,
  onSelect,
  className,
}: SubscriptionPlanProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const priceId = useId();
  const highlight = !current && recommended;
  return (
    <article
      className={cx(
        styles.plan,
        current && styles.current,
        highlight && styles.recommended,
        className,
      )}
      aria-current={current || undefined}
    >
      <div className={styles.header}>
        <div className={styles.names}>
          <h3 id={nameId} className={styles.name}>
            {name}
          </h3>
          <div className={styles.sub}>{subtitle}</div>
        </div>
        {(badge !== undefined || current) && (
          <div className={styles.pills}>
            {badge !== undefined && <span className={styles.badge}>{badge}</span>}
            {current && (
              <span className={cx(styles.badge, styles.badgeCurrent)}>
                {t("subscription.currentPlan")}
              </span>
            )}
          </div>
        )}
      </div>
      <div id={priceId} className={styles.priceBlock}>
        <span className={styles.price}>{price}</span>
        <span className={styles.period}>{period}</span>
      </div>
      <ul className={styles.features}>
        {features.map((feature, index) => (
          <li key={`${index}:${feature}`} className={styles.feature}>
            <Icon name="check" size={16} strokeWidth={2.2} className={styles.check} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        variant={highlight ? "primary" : "secondary"}
        tone={current ? "muted" : "default"}
        size="lg"
        fullWidth
        // The prototype's current-plan button is an enabled no-op (pointer, hover): inert here.
        aria-disabled={current || undefined}
        // Two cards say "Choose plan": the plan's name and price tell them apart.
        aria-describedby={`${nameId} ${priceId}`}
        className={styles.button}
        onClick={current ? undefined : onSelect}
      >
        {current ? t("subscription.currentPlan") : buttonLabel}
      </Button>
    </article>
  );
}
