"use client";

// =============================================================================
// PERMISSIONS CONTEXT
// =============================================================================
// Fetches the current user's role + permissions from GET /roles/mine.
// Admins and Super Admins always get full "edit" access on everything.
//
// Usage:
//   const { can } = usePermissions();
//   can("schedule", "edit")  → boolean
//   can("reports", "view")   → boolean (true for "view" OR "edit")
// =============================================================================

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useWorkspace } from "@/context/workspace";
import { fetchMyPermissions, RolePermissions, PermLevel } from "@/lib/api-client";

const FULL_ACCESS: RolePermissions = {
  overview: "edit",
  schedule: "edit",
  reports: "edit",
  documents: "edit",
  siteUpdates: "edit",
  team: "edit",
  settings: "edit",
};

interface PermissionsCtx {
  role: string;
  permissions: RolePermissions;
  loading: boolean;
  /** Returns true if the user has at least the requested level on this section */
  can: (section: keyof RolePermissions, level: PermLevel) => boolean;
}

const LEVEL_RANK: Record<PermLevel, number> = { none: 0, view: 1, upload: 2, edit: 3 };

const PermissionsContext = createContext<PermissionsCtx>({
  role: "",
  permissions: FULL_ACCESS,
  loading: true,
  can: () => true,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<RolePermissions>(FULL_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wsLoading) return;
    if (!workspaceId) { setLoading(false); return; }

    fetchMyPermissions(workspaceId)
      .then(data => {
        setRole(data.role);
        setPermissions(data.permissions);
      })
      .catch(() => {
        // On error default to full access so we don't lock out users
        setPermissions(FULL_ACCESS);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, wsLoading]);

  const can = (section: keyof RolePermissions, level: PermLevel): boolean => {
    const userLevel = permissions[section] ?? "none";
    return LEVEL_RANK[userLevel] >= LEVEL_RANK[level];
  };

  return (
    <PermissionsContext.Provider value={{ role, permissions, loading, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
