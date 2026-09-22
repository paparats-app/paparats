import { useLayoutEffect, useRef } from "react";
import { Outlet } from "react-router";
import { SearchScreen } from "@/screens/search";
import { useUiStore } from "@/stores/useUiStore";
import { DialogHost } from "./DialogHost";
import { NavigationSkeleton } from "./NavigationSkeleton";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";
import { ToastHost } from "./ToastHost";
import { TopBar } from "./TopBar";
import { WindowControls } from "./WindowControls";
import styles from "./Layout.module.css";

/**
 * The window (prototype lines 59–151): sidebar + content column (window controls, top bar,
 * offline banner, scrolling content). While a search query is typed the content shows the
 * results instead of the route; the route stays mounted underneath so its state survives.
 */
export function Layout() {
  const query = useUiStore((s) => s.query);
  const loading = useUiStore((s) => s.loading);
  const navCount = useUiStore((s) => s.navCount);
  const contentRef = useRef<HTMLElement>(null);
  const searching = query.trim().length > 0;

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [navCount]);

  return (
    <div className={styles.frame}>
      <div className={styles.drag} data-tauri-drag-region />
      <Sidebar />
      <div className={styles.column}>
        <WindowControls />
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
      </div>
      <ToastHost />
      <DialogHost />
    </div>
  );
}
