"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Spinner, Table } from "@heroui/react";
import { Icon } from "@iconify/react";
import { listStories, triggerStory } from "@/lib/api";
import type { StoryStatus } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { STATUS_COLOR, relativeTimeLabel } from "@/lib/monitoring-ui";

export default function StoriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [stories, setStories] = useState<StoryStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStories(await listStories());
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleTrigger(name: string) {
    setTriggering(name);
    try {
      await triggerStory(name);
      toast(`"${name}" triggered`, { variant: "success" });
      setTimeout(load, 2000);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Stories</h1>
        <p className="text-sm text-muted mt-0.5">
          Multi-step synthetic user flows
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Stories" className="min-w-[600px]">
              <Table.Header>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Last Run</Table.Column>
                <Table.Column className="text-end">Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {stories.map((story) => (
                  <Table.Row key={story.name} id={story.name}>
                    <Table.Cell className="font-medium">{story.name}</Table.Cell>
                    <Table.Cell>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={STATUS_COLOR[story.status]}
                      >
                        {story.status}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-xs text-muted">
                      {story.last_probed
                        ? `${new Date(story.last_probed).toLocaleString()} (${relativeTimeLabel(story.last_probed)})`
                        : "Never"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          onPress={() =>
                            router.push(`/stories/detail?name=${encodeURIComponent(story.name)}`)
                          }
                        >
                          <Icon icon="gravity-ui:eye" className="size-4" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          isPending={triggering === story.name}
                          onPress={() => handleTrigger(story.name)}
                        >
                          <Icon icon="gravity-ui:play" className="size-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {stories.length === 0 && (
                  <Table.Row id="empty">
                    <Table.Cell colSpan={4}>
                      <p className="py-12 text-center text-sm text-muted">
                        No stories configured. Add them manually in the Config tab.
                      </p>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
