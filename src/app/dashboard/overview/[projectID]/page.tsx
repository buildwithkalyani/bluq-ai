"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProjects, type Project } from "@/lib/mock-data";
import { ProjectDetailView } from "./ProjectDetailView";

export default function ProjectDetailPage({ params }: { params: { projectID: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    getProjects().then((projects) => {
      const found = projects.find((p) => String(p.id) === params.projectID);
      if (found) setProject(found);
    });
  }, [params.projectID]);

  if (!project) return <div className="p-6 text-sm text-[#94A3B8]">Loading...</div>;

  return <ProjectDetailView project={project} onBack={() => router.push("/dashboard/overview")} />;
}
