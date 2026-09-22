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
  /** "Most popular" / "Save 18%" pill (`--mint-soft` / `--mint2`). */
  badge?: string;
  /** The plan in effect: `--mint` border, "Current plan" pill, disabled button. */
  current?: boolean;
  /** Recommended plan (monthly): `--mint-border` border and a mint button. */
  recommended?: boolean;
  /** "Choose plan" / "Cancel plan"; "Current plan" is shown while `current`. */
  buttonLabel: string;
  onSelect: () => void;
  className?: string;
}

/**
 * Subscription plan card: header + badge, 32px price block over a 1px rule, mint-check features,
 * 40px footer button (prototype lines 700–707).
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
          <h3 className={styles.name}>{name}</h3>
          <div className={styles.sub}>{subtitle}</div>
        </div>
        {badge !== undefined && <span className={styles.badge}>{badge}</span>}
        {current && (
          <span className={cx(styles.badge, styles.badgeCurrent)}>
            {t("subscription.currentPlan")}
          </span>
        )}
      </div>
      <div className={styles.priceBlock}>
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
        disabled={current}
        className={styles.button}
        onClick={onSelect}
      >
        {current ? t("subscription.currentPlan") : buttonLabel}
      </Button>
    </article>
  );
}
