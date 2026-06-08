"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { getProjects } from "@/lib/mock";
import { PROJECT_STATUS_LABELS, type Project } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";

export function RecentActivityList() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    getProjects().then((list) => {
      // 取最近 5 条
      setProjects(list.slice(0, 5));
    });
  }, []);

  if (projects.length === 0) {
    return (
      <div className="text-sm text-neutral-400 py-8 text-center">暂无最近动态</div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const lastEntry = project.timeline[project.timeline.length - 1];
        return (
          <div key={project.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-4 h-4 text-neutral-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-neutral-700 truncate">{project.id}</p>
                {lastEntry && (
                  <p className="text-xs text-neutral-400">
                    {PROJECT_STATUS_LABELS[lastEntry.status]} ·{" "}
                    {new Date(lastEntry.timestamp).toLocaleString("zh-CN")}
                  </p>
                )}
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>
        );
      })}
    </div>
  );
}
