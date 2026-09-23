import { useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { FirstLaunch } from "@/screens/first-launch";
import { SearchScreen } from "@/screens/search";
import { useFirstLaunchStore } from "@/stores/useFirstLaunchStore";
import { useUiStore } from "@/stores/useUiStore";
import { DialogHost } from "./DialogHost";
import { NavigationSkeleton } from "./NavigationSkeleton";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";
import { ToastHost } from "./ToastHost";
import { TopBar } from "./TopBar";
import { useDeepLinks } from "./useDeepLinks";
import { useTrayActions } from "./useTrayActions";
import { WindowControls } from "./WindowControls";
import styles from "./Layout.module.css";

/**
 * The window (prototype lines 59–151): sidebar + content column (window controls, top bar,
 * offline banner, scrolling content, toast and dialogs). While a search query is typed the content
 * shows the results instead of the route; the route stays mounted underneath so its state survives.
 * A navigation started from inside the content (a card, "See all", Back…) replaces the control that
 * had the focus: the focus moves to the content column, so the next Tab starts on the new screen.
 * The same happens when the first-launch scene hands over to Home (its controls go with it).
 */
export function Layout() {
  const query = useUiStore((s) => s.query);
  const loading = useUiStore((s) => s.loading);
  const navCount = useUiStore((s) => s.navCount);
  const firstLaunchExiting = useFirstLaunchStore((s) => s.phase === "done");
  const contentRef = useRef<HTMLElement>(null);
  const searching = query.trim().length > 0;
  const { pathname } = useLocation();
  const shownPath = useRef(pathname);
  // paparats:// links and the tray's "Check for updates" navigate like the sidebar does.
  useDeepLinks();
  useTrayActions();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.scrollTop = 0;
    const active = document.activeElement;
    if (navCount > 0 && (active === document.body || content.contains(active))) {
      focusColumn(content);
    }
  }, [navCount]);

  // Later / Sign in: the scene stops covering the shell (a passive effect, so it runs after the
  // scene has lifted `inert`) and the focus, still on the finishing button, moves to Home.
  useEffect(() => {
    if (firstLaunchExiting && contentRef.current) focusColumn(contentRef.current);
  }, [firstLaunchExiting]);

  // The route commits after the navigation (a transition): whatever held the focus on the screen
  // that left — e.g. the opener a closing dialog gave it back to — takes it along.
  useLayoutEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    if (contentRef.current && document.activeElement === document.body) {
      focusColumn(contentRef.current);
    }
  }, [pathname]);

  return (
    <div className={styles.frame}>
      <div className={styles.drag} data-tauri-drag-region />
      <Sidebar />
      <div className={styles.column}>
        <TopBar />
        <OfflineBanner />
        <main ref={contentRef} className={styles.content}>
          {loading && <NavigationSkeleton />}
          {/* Alternating animation names restart the enter animation on every navigation. */}
          <div
            className={navCount % 2 ? styles.enterA : styles.enterB}
            hidden={loading}
            data-testid="screen"
          >
            <div hidden={searching}>
              <Outlet />
            </div>
            {searching && <SearchScreen />}
          </div>
        </main>
        {/* Inside the column, like the prototype's (they live in its `main`): dialogs dim and
            centre on the content column, the sidebar stays uncovered. */}
        <ToastHost />
        <DialogHost />
        {/* Pinned to the top-right corner; last in the DOM so the tab order runs search → screen
            → window chrome. */}
        <WindowControls />
      </div>
      {/* The first-launch scene covers the whole window (renders nothing when it is not playing). */}
      <FirstLaunch />
    </div>
  );
}

/**
 * Focuses the content column. It takes `tabindex="-1"` only while it holds the focus, so a press
 * on plain text in the column still leaves the focus where the browser puts it.
 */
function focusColumn(column: HTMLElement): void {
  column.setAttribute("tabindex", "-1");
  column.addEventListener("blur", () => column.removeAttribute("tabindex"), { once: true });
  column.focus({ preventScroll: true });
}
