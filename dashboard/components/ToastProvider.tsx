"use client";

import { Toast, toast as _toast } from "@heroui/react";
import { useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";

type ToastVariant = "default" | "success" | "danger" | "warning";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toast.Provider />
    </>
  );
}

const ERROR_DEBOUNCE_MS = 5000; // Only show one error toast every 5 seconds

export function useToast() {
  const lastErrorRef = useRef(0);

  const toast = useCallback(
    (title: string, options?: { description?: string; variant?: ToastVariant }) => {
      // Debounce danger toasts to avoid spam
      if (options?.variant === "danger") {
        const now = Date.now();
        if (now - lastErrorRef.current < ERROR_DEBOUNCE_MS) {
          return; // Suppress this error toast
        }
        lastErrorRef.current = now;
      }

      const opts = options?.description ? { description: options.description } : undefined;
      switch (options?.variant) {
        case "success": return _toast.success(title, opts);
        case "danger":  return _toast.danger(title, opts);
        case "warning": return _toast.warning(title, opts);
        default:        return _toast(title, opts);
      }
    },
    []
  );

  return useMemo(() => ({ toast }), [toast]);
}
