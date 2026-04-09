"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getProjects, Project } from "@/lib/mock-data";

export function useProjectSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  const projectId = Number(searchParams.get("projectId") || "0");

  const handleProjectChange = (projectName: string) => {
    const p = projects.find((proj) => proj.name === projectName);
    if (p) {
      router.push(`${pathname}?projectId=${p.id}`);
    }
  };

  const currentProjectName = projects.find((p) => p.id === projectId)?.name || "Select Project";

  return {
    projectId,
    projects,
    currentProjectName,
    handleProjectChange,
    loading,
  };
}