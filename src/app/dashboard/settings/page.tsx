"use client";

import ProjectSettingsPage from "@/app/settings/page";

export default function DashboardSettingsPage() {
  // Dashboard shell expects `/dashboard/settings` to exist; render the
  // same UI as the standalone `/settings` route.
  return <ProjectSettingsPage />;
}

