"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import {
  type BackendReadinessState,
  useBackendReadiness,
} from "@/lib/hooks/useBackendReadiness";

const BackendReadinessContext = createContext<BackendReadinessState | null>(null);

export function BackendReadinessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const readiness = useBackendReadiness();
  return (
    <BackendReadinessContext.Provider value={readiness}>
      {children}
    </BackendReadinessContext.Provider>
  );
}

export function useSharedBackendReadiness(): BackendReadinessState {
  const context = useContext(BackendReadinessContext);
  if (!context) {
    throw new Error("useSharedBackendReadiness must be used within BackendReadinessProvider");
  }
  return context;
}
