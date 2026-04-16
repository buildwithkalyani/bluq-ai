"use client";

// =============================================================================
// WORKSPACE CONTEXT
// =============================================================================
// Holds the current user's workspaceId and org name.
// On mount, fetches GET /orgs/mine from Fastify to find the user's workspace.
// If none found, the app redirects to /onboarding.
//
// Usage:
//   const { workspaceId, orgName, loading } = useWorkspace();
// =============================================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";

interface WorkspaceContextType {
  workspaceId: string | null;
  orgName: string | null;
  loading: boolean;
  setWorkspace: (id: string, name: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  orgName: null,
  loading: true,
  setWorkspace: () => {},
});

function getAuthToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("better-auth.session_token="));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    // Don't fetch until we know if there's a session
    if (session === undefined) return;

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

    fetch(`${backendUrl}/orgs/mine`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: any[]) => {
        const first = data?.[0];
        if (first) {
          setWorkspaceId(first.id);
          setOrgName(first.name);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  const setWorkspace = (id: string, name: string) => {
    setWorkspaceId(id);
    setOrgName(name);
  };

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, orgName, loading, setWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
