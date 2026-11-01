// First launch — the Kupalle night scene and onboarding over the whole shell
// (FIRST_LAUNCH_SPEC.md; Paparats Prototype.dc.html lines 1518–1625, logic 1652–1690 and
// `renderVals` "// first launch"). Mounted once by the shell; renders nothing until
// `useFirstLaunchStore` starts a run (startup without a first-run record, or Replay first launch).
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import fernUrl from "@/assets/images/paparats-fern-watermark.webp";
import markUrl from "@/assets/images/paparats-mark-light.webp";
import { pathOf } from "@/app/navigation";
import { Icon } from "@/components/Icon";
import { useFeatures } from "@/hooks/useFeatures";
import { useAccountActions } from "@/queries";
import {
  FIRST_LAUNCH_EXIT_MS,
  FIRST_LAUNCH_TIMELINE,
  HERO_GLOW_MS,
  isStep,
  SIGNED_IN_TOAST_MS,
  useFirstLaunchStore,
  type FirstLaunchPhase,
} from "@/stores/useFirstLaunchStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useUiStore } from "@/stores/useUiStore";
import { cx } from "./cx";
import {
  AccountStep,
  AppearanceStep,
  LanguageStep,
  StepIndicator,
  type CurrentAccount,
} from "./FirstLaunchSteps";
import {
  AUTHORED,
  FIREFLIES,
  heroTarget,
  LEFT_FRONDS,
  RIGHT_FRONDS,
  sceneFrame,
  sceneScale,
  type Frond,
} from "./scene";
import styles from "./FirstLaunch.module.css";

/** Timeouts that outlive the scene (exit, hero glow, sign-in toast); cleared on unmount. */
function useTimers(): (run: () => void, ms: number) => void {
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const ids = pending.current;
    return () => {
      for (const id of ids) clearTimeout(id);
      ids.clear();
    };
  }, []);
  return useCallback((run: () => void, ms: number) => {
    const ids = pending.current;
    const id = setTimeout(() => {
      ids.delete(id);
      run();
    }, ms);
    ids.add(id);
  }, []);
}

/**
 * The first-launch overlay. Owns what must survive the scene: the finish (record, Home, hero
 * glow), the overlay's removal 1.5 s later and the "Signed in as …" toast 1.6 s after Sign in.
 */
export function FirstLaunch() {
  const phase = useFirstLaunchStore((s) => s.phase);
  const run = useFirstLaunchStore((s) => s.run);
  const motion = useFirstLaunchStore((s) => s.motion);
  const signInOnly = useFirstLaunchStore((s) => s.mode === "signIn");
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signIn } = useAccountActions();
  const schedule = useTimers();

  /**
   * Later / Sign in: persist, hand over to Home and start the exit. A `signIn` run (Settings ›
   * Account › Sign in) only starts the exit: the user stays where they were.
   */
  const finish = useCallback((): boolean => {
    const store = useFirstLaunchStore.getState();
    const signInOnly = store.mode === "signIn";
    if (!store.finish()) return false;
    const finishedRun = store.run;
    if (signInOnly) {
      schedule(() => useFirstLaunchStore.getState().close(finishedRun), FIRST_LAUNCH_EXIT_MS);
      return true;
    }
    // Like the prototype's `finishIntro` (`screen: 'home'`): Home is under the fading overlay at
    // once — no navigation skeleton.
    const ui = useUiStore.getState();
    if (pathname === pathOf({ to: "home" })) ui.clearQuery();
    else {
      ui.beginNavigation({ skeleton: false });
      void navigate(pathOf({ to: "home" }));
    }
    schedule(() => useFirstLaunchStore.getState().close(finishedRun), FIRST_LAUNCH_EXIT_MS);
    schedule(() => useHomeStore.getState().setHeroGlow(false), HERO_GLOW_MS);
    return true;
  }, [navigate, pathname, schedule]);

  const signInAndFinish = useCallback(
    (email: string, password: string, current: CurrentAccount | null) => {
      const typed = email.trim();
      if (!finish()) return;
      // A typed email signs in (and becomes the profile email); none keeps a signed-in account,
      // and signs a signed-out one in with its profile email (the prototype signs in as the
      // profile, `signInIntro`).
      const signInAs = typed || (current && !current.signedIn ? current.email : "");
      let shown: Promise<string | null>;
      if (signInAs) {
        shown = signIn(signInAs, password).then(
          (account) => account.profile.email,
          () => null,
        );
      } else {
        shown = Promise.resolve(current?.signedIn ? current.email : null);
      }
      schedule(() => {
        void shown.then((value) => {
          if (value) useUiStore.getState().notify(t("firstLaunch.signedInAs", { email: value }));
        });
      }, SIGNED_IN_TOAST_MS);
    },
    [finish, schedule, signIn, t],
  );

  if (phase === null) return null;
  return (
    <Scene
      key={run}
      phase={phase}
      run={run}
      motion={motion}
      signInOnly={signInOnly}
      onLater={finish}
      onSignIn={signInAndFinish}
    />
  );
}

// ---- Viewport ------------------------------------------------------------------------------

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const viewportKey = () => `${window.innerWidth}x${window.innerHeight}`;
const AUTHORED_KEY = `${AUTHORED.width}x${AUTHORED.height}`;

/** The window size (the overlay covers the window). */
function useViewport(): { width: number; height: number } {
  const key = useSyncExternalStore(subscribeResize, viewportKey, () => AUTHORED_KEY);
  const [width = AUTHORED.width, height = AUTHORED.height] = key.split("x").map(Number);
  return { width, height };
}

// ---- Scene ---------------------------------------------------------------------------------

interface SceneProps {
  phase: FirstLaunchPhase;
  run: number;
  motion: boolean;
  /** Settings › Account › Sign in: the Account step alone, without the step indicator. */
  signInOnly: boolean;
  onLater: () => void;
  onSignIn: (email: string, password: string, current: CurrentAccount | null) => void;
}

/** Numbers as CSS custom properties: `{ left: 40 }` → `--left: 40` (units are added in CSS). */
function vars(values: object): CSSProperties {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`--${name}`, value]),
  ) as CSSProperties;
}

function FrondImage({ frond }: { frond: Frond }) {
  return (
    <div className={styles.frond} style={vars(frond)}>
      <img className={styles.frondImage} src={fernUrl} alt="" draggable={false} />
    </div>
  );
}

/** A 1440 × 920 wall pinned to a bottom corner (the right one is the left set, mirrored). */
function Walls() {
  return (
    <>
      <div className={styles.wallLeft}>
        <div className={styles.fernsLeft}>
          {LEFT_FRONDS.map((frond, i) => (
            <FrondImage key={i} frond={frond} />
          ))}
        </div>
      </div>
      <div className={styles.wallRight}>
        <div className={styles.fernsRight}>
          <div className={styles.mirror}>
            {RIGHT_FRONDS.map((frond, i) => (
              <FrondImage key={i} frond={frond} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Flower({ ring }: { ring: boolean }) {
  return (
    <div className={styles.flowerMove}>
      <div className={styles.flowerScale}>
        <div className={styles.glow} />
        <div className={styles.rays} />
        {ring && <div className={styles.ring} data-testid="first-launch-ring" />}
        <div className={styles.star}>
          <svg width="80" height="80" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <path
              className={styles.starOuter}
              d="M50 2C54 34 66 46 98 50C66 54 54 66 50 98C46 66 34 54 2 50C34 46 46 34 50 2Z"
            />
            <path
              className={styles.starInner}
              d="M50 28C52 43 57 48 72 50C57 52 52 57 50 72C48 57 43 52 28 50C43 48 48 43 50 28Z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Stage({ children }: { children: ReactNode }) {
  return <div className={styles.stage}>{children}</div>;
}

function Scene({ phase, run, motion, signInOnly, onLater, onSignIn }: SceneProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const viewport = useViewport();
  const scale = sceneScale(viewport.width, viewport.height);
  const frame = sceneFrame(phase, heroTarget(viewport.height, scale));
  const { skip, next, back } = useFirstLaunchStore.getState();
  // Without accounts (the real catalog, D68) Appearance is the last step: it finishes the intro.
  const { account } = useFeatures();

  // Commit the seed styles before anything changes: at startup the window may still be hidden (it
  // appears after the first paint), and a layer whose first computed style were already `fern`
  // would not rise — CSS transitions need a before-change style.
  useLayoutEffect(() => {
    rootRef.current?.getBoundingClientRect();
  }, []);

  // The timeline (phases 0–4 advance on their own), counted from the scene mounting.
  useEffect(() => {
    if (!motion) return;
    const ids = FIRST_LAUNCH_TIMELINE.map(([target, ms]) =>
      setTimeout(() => useFirstLaunchStore.getState().advance(run, target), ms),
    );
    return () => ids.forEach(clearTimeout);
  }, [run, motion]);

  // Modal over the shell: everything beside the overlay is inert until the exit begins.
  const blocking = !frame.done;
  useEffect(() => {
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!blocking || !root || !parent) return;
    const others = Array.from(parent.children).filter(
      (el) => el !== root && !el.hasAttribute("inert"),
    );
    for (const el of others) el.setAttribute("inert", "");
    return () => {
      for (const el of others) el.removeAttribute("inert");
    };
  }, [blocking]);

  // Focus enters the overlay, then each step as it appears (keyboard users start on its cards).
  useEffect(() => {
    const root = rootRef.current;
    if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (isStep(phase)) stepRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const style = vars({
    s: scale,
    "fern-x": frame.fernX,
    "fern-y": frame.fernY,
    "fern-rotate": frame.fernRotate,
    "fern-opacity": frame.fernOpacity,
    "flower-x": frame.flowerX,
    "flower-y": frame.flowerY,
    "flower-scale": frame.flowerScale,
    "flower-opacity": frame.flowerOpacity,
    "star-opacity": frame.starOpacity,
    "flies-opacity": frame.fliesOpacity,
    "logo-opacity": frame.logoOpacity,
    "logo-y": frame.logoY,
    "panel-y": frame.panelY,
  });

  return (
    <div
      ref={rootRef}
      className={cx(
        styles.overlay,
        frame.skippable && styles.skippable,
        frame.panel && styles.withPanel,
        frame.done && styles.done,
      )}
      style={style}
      role="dialog"
      aria-modal={blocking}
      aria-label={t("firstLaunch.sceneLabel")}
      tabIndex={-1}
      data-phase={phase}
      data-testid="first-launch"
    >
      {/* Presentation only; clicking it skips (the `››` button is the keyboard way). */}
      <div
        className={styles.scene}
        onClick={skip}
        aria-hidden="true"
        data-testid="first-launch-scene"
      >
        <Walls />
        <div className={styles.vignette} />
        <Stage>
          <div className={styles.flies}>
            {FIREFLIES.map((fly, i) => (
              <span key={i} className={styles.fly} style={vars(fly)} />
            ))}
          </div>
          <Flower ring={frame.ring} />
        </Stage>
      </div>

      <button
        type="button"
        className={styles.skip}
        onClick={skip}
        disabled={!frame.skippable}
        aria-hidden={frame.skippable ? undefined : true}
        aria-label={t("firstLaunch.skip")}
        title={t("firstLaunch.skip")}
      >
        <Icon name="chevrons-right" size={16} strokeWidth={2} />
      </button>

      <div className={styles.front}>
        <Stage>
          <div className={styles.logo} aria-hidden={frame.logoOpacity ? undefined : true}>
            <img className={styles.mark} src={markUrl} alt="" draggable={false} />
            <div className={styles.brand}>{t("shell.brand")}</div>
            <div className={styles.brandNative} lang="be">
              {t("shell.brandNative")}
            </div>
          </div>
          <div className={styles.panel}>
            {phase === "lang" && <LanguageStep stepRef={stepRef} onContinue={next} />}
            {phase === "theme" && (
              <AppearanceStep stepRef={stepRef} onContinue={account ? next : onLater} />
            )}
            {phase === "signin" && (
              <AccountStep
                stepRef={stepRef}
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSignIn={(current) => onSignIn(email, password, current)}
                onLater={onLater}
              />
            )}
          </div>
        </Stage>
        {!signInOnly && (
          <StepIndicator phase={phase} onBack={back} hidden={!frame.panel} withAccount={account} />
        )}
      </div>

      {/* The window is frameless and the scene covers the shell's drag strip: an invisible one
          keeps the window movable during the onboarding (docs/decisions.md D50). */}
      <div className={styles.drag} data-tauri-drag-region aria-hidden="true" />
    </div>
  );
}
