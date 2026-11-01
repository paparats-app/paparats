import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useFeatures } from "@/hooks/useFeatures";
import { usePlatform } from "@/queries";
import type { Features } from "@/services/types";

interface FeatureGateProps {
  feature: keyof Features;
  children: ReactNode;
}

/**
 * A screen that exists only when the catalog turns its feature on (`platform.json › features`).
 * Waits for the platform file; with the feature off, a deep link or a stale history entry lands
 * on Home instead (D68).
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const platform = usePlatform();
  const features = useFeatures();
  // The real platform file decides; until it arrives the screen waits (the mock world is on).
  if (platform.isPending && !features[feature]) return null;
  return features[feature] ? children : <Navigate to="/home" replace />;
}
