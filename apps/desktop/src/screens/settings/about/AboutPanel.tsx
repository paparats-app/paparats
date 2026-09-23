import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import heroFern from "@/assets/images/hero-fern.webp";
import logoMark from "@/assets/images/paparats-mark-light.webp";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { usePlatform, useSystemActions } from "@/queries";
import { useUiStore } from "@/stores/useUiStore";
import { ABOUT_LINKS, LEGAL_LINKS, PRINCIPLES } from "./aboutContent";
import styles from "./AboutPanel.module.css";

/**
 * Settings › About (prototype lines 797–822; logic `versionLine`, `checkUpdates`): the dark top
 * block with the fern, logo, version, "Check for updates" (≈1.2 s "Checking…", then a toast) and
 * "What's new" (→ Updates); the statement, the four principles, the external links and the footer.
 */
export function AboutPanel() {
  const { t, i18n } = useTranslation();
  const { go } = useNav();
  const about = usePlatform().data?.about;
  const { checkForAppUpdate, openExternal } = useSystemActions();
  const notify = useUiStore((s) => s.notify);
  const [checking, setChecking] = useState(false);
  /** A newer client version found by the last check (none: up to date). */
  const [available, setAvailable] = useState<string | null>(null);
  const running = useRef(false);

  const check = () => {
    if (running.current) return;
    running.current = true;
    setChecking(true);
    checkForAppUpdate()
      .then((result) => {
        // `i18n.t` reads the language at answer time (it may have changed during the check).
        if (result.kind === "available") {
          setAvailable(result.version);
          notify(i18n.t("about.updateAvailable", { version: result.version }));
        } else {
          setAvailable(null);
          notify(i18n.t("about.youUpToDate"));
        }
      })
      // No copy for a failed check in the handoff: the button just returns.
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
        setChecking(false);
      });
  };

  // External addresses open in the default browser, never inside the app's WebView.
  const external = (url: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openExternal(url).catch(() => undefined);
  };
  const block = (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault();

  return (
    <section className={styles.card} aria-label={t("settings.sections.about")}>
      <div className={styles.hero}>
        <div
          className={styles.photo}
          style={{ "--photo": `url("${heroFern}")` } as CSSProperties}
          aria-hidden="true"
        />
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <img className={styles.logo} src={logoMark} alt="" width={76} height={76} />
            <div>
              <h2 className={styles.name}>{t("shell.brand")}</h2>
              <div className={styles.tagline}>{t("common.tagline")}</div>
            </div>
          </div>
          <div className={styles.version}>
            {about
              ? `${t("common.version")} ${about.version} (${t("settings.build")} ${about.build})`
              : null}
          </div>
          <div className={styles.status}>
            <span className={styles.statusMark} aria-hidden="true">
              <Icon name="check" size={11} strokeWidth={3} />
            </span>
            {available === null
              ? t("about.youUpToDate")
              : t("about.updateAvailable", { version: available })}
          </div>
          <div className={styles.actions}>
            {/* "Checking…" is the progress (as in the prototype); presses meanwhile do nothing. */}
            <Button
              variant="primaryOnImage"
              size="lg"
              className={styles.check}
              aria-busy={checking || undefined}
              onClick={check}
            >
              {checking ? t("about.checking") : t("about.checkUpdates")}
            </Button>
            <Button
              variant="onImage"
              size="lg"
              className={styles.whatsNew}
              trailingIcon={<Icon name="external-link" size={15} strokeWidth={2} />}
              onClick={() => go({ to: "updates" })}
            >
              {t("common.whatsNew")}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <p className={styles.statement}>
          {t("about.aboutBody1")}
          <br />
          {t("about.aboutBody2")}
        </p>
        <ul className={styles.principles}>
          {PRINCIPLES.map(({ id, icon }) => (
            <li key={id} className={styles.principle}>
              <Icon name={icon} size={30} strokeWidth={1.5} className={styles.principleIcon} />
              <div className={styles.principleTitle}>{t(`about.principles.${id}`)}</div>
            </li>
          ))}
        </ul>
        <div className={styles.links}>
          {ABOUT_LINKS.map(({ id, url }) => (
            <a
              key={id}
              href={url}
              className={styles.link}
              onClick={external(url)}
              onAuxClick={block}
            >
              {t(`about.${id}`)}
              <Icon name="external-link" size={14} strokeWidth={2} />
            </a>
          ))}
        </div>
        <div className={styles.footer}>
          <span>{t("about.copyright")}</span>
          <span className={styles.legal}>
            {LEGAL_LINKS.map(({ id, url }) => (
              <a
                key={id}
                href={url}
                className={styles.legalLink}
                onClick={external(url)}
                onAuxClick={block}
              >
                {t(`about.${id}`)}
              </a>
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}
