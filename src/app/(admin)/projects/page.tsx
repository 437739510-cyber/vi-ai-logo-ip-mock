"use client";

import { useEffect, useState } from "react";
import { ProjectFiltersBar } from "@/components/admin/ProjectFilters";
import { ProjectTable } from "@/components/admin/ProjectTable";
import { getProjects } from "@/lib/mock";
import type { Project, ProjectFilters } from "@/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProjectFilters>({
    status: "all",
    search: "",
  });

  useEffect(() => {
    setLoading(true);
    getProjects(filters).then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, [filters]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">项目列表</h2>

      <ProjectFiltersBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <ProjectTable projects={projects} />
        </div>
      )}
    </div>
  );
}
