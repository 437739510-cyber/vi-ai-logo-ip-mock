"use client";

import { Clock } from "lucide-react";
import { PROJECT_STATUS_LABELS, type Project } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface RecentActivityListProps {
  projects: Project[];
}

export function RecentActivityList({ projects }: RecentActivityListProps) {
  const recentProjects = projects.slice(0, 5);

  if (recentProjects.length === 0) {
    return (
      <div className="text-sm text-neutral-400 py-8 text-center">暂无最近动态</div>
    );
  }

  return (
    <div className="space-y-3">
      {recentProjects.map((project) => {
        const lastEntry = project.timeline[project.timeline.length - 1];
        return (
          <div key={project.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-neutral-300" />
              <div>
                <p className="text-sm font-medium text-neutral-700">{project.name}</p>
                <p className="text-xs text-neutral-400">{project.industry}</p>
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>
        );
      })}
    </div>
  );
}
