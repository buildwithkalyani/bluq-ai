"use client";

import { Suspense } from "react";
import ProjectSettingsPage from "@/app/dashboard/settings/project/page";

export default function DashboardSettingsPage() {
  return (
    <Suspense>
      <ProjectSettingsPage />
    </Suspense>
  );
}

