"use client";

import { cn } from "@/lib/core/utils";
import { QUEUE_VIEWS, type QueueViewKey } from "@/lib/core/project-queue";

const TAB_KEYS: QueueViewKey[] = [
  "my_todos",
  "all",
  "awaiting_payment",
  "review",
  "overdue",
  "awaiting_customer",
  "ready_deliver",
  "anomaly",
  "archived",
];

interface QueueViewTabsProps {
  view: QueueViewKey;
  onChange: (view: QueueViewKey) => void;
}

export function QueueViewTabs({ view, onChange }: QueueViewTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TAB_KEYS.map((key) => {
        const meta = QUEUE_VIEWS.find((v) => v.key === key)!;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={meta.description}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              view === key ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
