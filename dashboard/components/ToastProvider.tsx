"use client";

import { Toast, toast as _toast } from "@heroui/react";
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

export function useToast() {
  return {
    toast: (title: string, options?: { description?: string; variant?: ToastVariant }) => {
      const opts = options?.description ? { description: options.description } : undefined;
      switch (options?.variant) {
        case "success": return _toast.success(title, opts);
        case "danger":  return _toast.danger(title, opts);
        case "warning": return _toast.warning(title, opts);
        default:        return _toast(title, opts);
      }
    },
  };
}
