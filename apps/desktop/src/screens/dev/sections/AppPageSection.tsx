import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RatingSummary } from "@/components/RatingSummary";
import { ReviewCard } from "@/components/ReviewCard";
import { PLACEHOLDER_SHOTS, ScreenshotViewer } from "@/components/ScreenshotViewer";
import { pickReviews, rating, ratingHistogram, ratingsCount } from "@/domain/appDetail";
import { initials } from "@/domain/text";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { app, CATALOG, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

const APP_ID = "obsidian";

/** Screenshot viewer with placeholder frames (arrows / thumbnails switch the frame). */
export function ScreenshotSection() {
  const { t } = useTranslation();
  const [shot, setShot] = useState(0);
  return (
    <Specimen caption="ScreenshotViewer · PLACEHOLDER_SHOTS · prev/next + thumbnails (click)" wide>
      <DesignFrame width={WIDTH.content}>
        <ScreenshotViewer
          shots={PLACEHOLDER_SHOTS}
          index={shot}
          onIndexChange={setShot}
          tint={app(APP_ID).tint}
          previousLabel={t("common.previous")}
          nextLabel={t("common.next")}
        />
      </DesignFrame>
    </Specimen>
  );
}

/** Ratings card (tap to rate) next to three reviews from the shared pool. */
export function RatingsSection() {
  const { text, format } = useSample();
  const [myRating, setMyRating] = useState(0);
  const reviews = pickReviews(APP_ID, CATALOG.reviewPool);
  return (
    <Specimen caption="RatingSummary (tap-to-rate) · ReviewCard" wide>
      <DesignFrame width={WIDTH.content}>
        <div className={styles.reviews}>
          <RatingSummary
            average={rating(APP_ID)}
            ratingsCount={ratingsCount(APP_ID)}
            histogram={ratingHistogram(APP_ID)}
            myRating={myRating}
            onRate={setMyRating}
          />
          <div className={styles.stack}>
            {reviews.map((review) => (
              <ReviewCard
                key={`${review.author}-${review.date}`}
                author={review.author}
                initials={initials(review.author)}
                date={format.date(review.date)}
                stars={review.stars}
                text={text(review.text)}
                helpful={review.helpful}
              />
            ))}
          </div>
        </div>
      </DesignFrame>
    </Specimen>
  );
}
