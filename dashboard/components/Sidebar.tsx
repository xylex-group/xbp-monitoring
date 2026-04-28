"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-default-200 bg-white">
      <div className="border-b border-default-200 p-4">
        <Button variant="primary" className="w-full justify-start font-semibold" size="sm">
          <Icon icon="gravity-ui:plus" className="size-4" />
          New
        </Button>
      </div>

      <nav className="flex-1 overflow-auto p-3">
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
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-default-200 px-4 py-3">
        <p className="text-xs text-default-400">XBP Monitoring · v0.9.x</p>
      </div>
    </aside>
  );
}
