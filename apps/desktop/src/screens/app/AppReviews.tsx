import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RatingSummary } from "@/components/RatingSummary";
import { ReviewCard } from "@/components/ReviewCard";
import { pickReviews, rating, ratingHistogram, ratingsCount } from "@/domain/appDetail";
import { initials, pickText } from "@/domain/text";
import { useLocale } from "@/hooks";
import { useFormat } from "@/i18n/format";
import type { App, Review } from "@/services/types";
import { useUiStore } from "@/stores/useUiStore";
import page from "./AppScreen.module.css";
import styles from "./AppReviews.module.css";

/**
 * Ratings card (average, histogram, tap to rate) next to three reviews and "Write a review"
 * (prototype lines 1048–1082). Ratings and reviews are generated from the app id until the
 * catalog carries real ones; rating and writing only thank the user for now.
 */
export function AppReviews({ app, reviewPool }: { app: App; reviewPool: readonly Review[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const notify = useUiStore((s) => s.notify);
  const [myRating, setMyRating] = useState(0);
  const reviews = pickReviews(app.id, reviewPool);
  const thank = () => notify(t("app.thanksRating"));

  return (
    <>
      <h2 className={`${page.heading} ${styles.heading}`}>{t("app.reviews")}</h2>
      <div className={styles.grid}>
        <RatingSummary
          average={rating(app.id)}
          ratingsCount={ratingsCount(app.id)}
          histogram={ratingHistogram(app.id)}
          myRating={myRating}
          onRate={(stars) => {
            setMyRating(stars);
            thank();
          }}
        />
        <div className={styles.reviews}>
          {reviews.map((review, i) => (
            <ReviewCard
              key={`${i}-${review.author}`}
              author={review.author}
              initials={initials(review.author)}
              date={format.date(review.date)}
              stars={review.stars}
              text={pickText(review.text, locale)}
              helpful={review.helpful}
            />
          ))}
          <Button
            className={styles.write}
            leadingIcon={<Icon name="pen-line" size={15} strokeWidth={2} />}
            onClick={thank}
          >
            {t("app.writeReview")}
          </Button>
        </div>
      </div>
    </>
  );
}
