"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const navSections = [
  {
    title: "Detect",
    items: [
      { href: "/", label: "Home", icon: "gravity-ui:house" },
      { href: "/monitors", label: "Heartbeats", icon: "gravity-ui:heartbeat" },
      { href: "/stories", label: "Test sessions", icon: "gravity-ui:list-check" },
    ],
  },
  {
    title: "Configuration",
    items: [{ href: "/config", label: "Environment variables", icon: "gravity-ui:gear" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderNavItems = () => (
    <>
      {navSections.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-default-400">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");

              return (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
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
          </div>
        </div>
      ))}
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-default-200 bg-white/90 px-3 backdrop-blur lg:hidden dark:bg-black/75">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => setMobileOpen(true)}>
          <Icon icon="gravity-ui:bars" className="size-4" />
        </Button>
        <p className="text-sm font-semibold">XBP Monitoring</p>
        <ThemeToggle />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[86vw] flex-col border-r border-default-200 bg-white dark:bg-black">
            <div className="flex items-center justify-between border-b border-default-200 p-3">
              <p className="text-sm font-semibold">Navigation</p>
              <Button isIconOnly size="sm" variant="ghost" onPress={() => setMobileOpen(false)}>
                <Icon icon="gravity-ui:xmark" className="size-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-auto p-3">{renderNavItems()}</nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-60 flex-col border-r border-default-200 bg-white dark:bg-black lg:flex">
        <div className="border-b border-default-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="primary" className="w-full justify-start font-semibold" size="sm">
              <Icon icon="gravity-ui:plus" className="size-4" />
              New
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 overflow-auto p-3">{renderNavItems()}</nav>

        <div className="border-t border-default-200 px-4 py-3">
          <p className="text-xs text-default-400">XBP Monitoring · v0.9.x</p>
        </div>
      </aside>
    </>
  );
}
