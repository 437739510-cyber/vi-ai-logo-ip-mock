import { cn } from "@/lib/utils";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/types";

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        PROJECT_STATUS_COLORS[status],
        className
      )}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
