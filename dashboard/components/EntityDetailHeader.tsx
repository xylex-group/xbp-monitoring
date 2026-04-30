"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface EntityDetailHeaderProps {
  backLabel: string;
  title: string;
  subtitle?: string;
  loading?: boolean;
  triggering?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onTrigger: () => void;
}

export function EntityDetailHeader({
  backLabel,
  title,
  subtitle,
  loading = false,
  triggering = false,
  onBack,
  onRefresh,
  onTrigger,
}: EntityDetailHeaderProps) {
  return (
    <div className="rounded-2xl border border-default-200 bg-content1 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-default-500">
            <button type="button" className="hover:text-default-700" onClick={onBack}>
              {backLabel}
            </button>
            <span>/</span>
            <span className="font-semibold text-default-700">Detail</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-default-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-xs text-default-500">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onPress={onBack}>
            <Icon icon="gravity-ui:arrow-left" className="size-4" />
            Back
          </Button>
          <Button variant="ghost" onPress={onRefresh} isPending={loading}>
            <Icon icon="gravity-ui:arrow-rotate-right" className="size-4" />
            Refresh
          </Button>
          <Button variant="primary" onPress={onTrigger} isPending={triggering}>
            <Icon icon="gravity-ui:play" className="size-4" />
            Trigger
          </Button>
        </div>
      </div>
    </div>
  );
}
