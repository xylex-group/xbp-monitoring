"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/",         label: "Overview", icon: "gravity-ui:layout-header-side-content" },
  { href: "/monitors", label: "Monitors", icon: "gravity-ui:pulse" },
  { href: "/stories",  label: "Stories",  icon: "gravity-ui:list-check" },
  { href: "/config",   label: "Config",   icon: "gravity-ui:gear" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-content1 border-r border-divider flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-divider">
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
          <Icon icon="gravity-ui:pulse" className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm">XBP Monitoring</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map(({ href, label, icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <Button
                className="w-full justify-start"
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
              >
                <Icon icon={icon} className="size-4 shrink-0" />
                {label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-divider">
        <p className="text-xs text-muted">v0.9.x · XBP Monitoring</p>
      </div>
    </aside>
  );
}
