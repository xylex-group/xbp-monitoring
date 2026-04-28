"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

type Theme = "light" | "dark";
const STORAGE_KEY = "xbp-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const preferred: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const next = stored ?? preferred;
    setTheme(next);
    applyTheme(next);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  if (!mounted) {
    return (
      <Button isIconOnly size="sm" variant="ghost" aria-label="Toggle color theme" isDisabled>
        <Icon icon="gravity-ui:moon" className="size-4" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon icon={isDark ? "gravity-ui:sun" : "gravity-ui:moon"} className="size-4" />
    </Button>
  );
}
