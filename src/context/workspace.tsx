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
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Accounts that always see mock/design data instead of real backend data
const DESIGN_ACCOUNTS = ["aishna.tijaria@gmail.com"];

interface WorkspaceContextType {
  workspaceId: string | null;
  orgName: string | null;
  loading: boolean;
  isDesignMode: boolean;   // true → always show mock data
  setWorkspace: (id: string, name: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  orgName: null,
  loading: true,
  isDesignMode: false,
  setWorkspace: () => {},
});

async function getAuthToken(): Promise<string> {
  const { authClient } = await import("@/lib/auth-client");
  const session = await authClient.getSession();
  return session?.data?.session?.token ?? "";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = authClient.useSession();
  const isDesignMode = DESIGN_ACCOUNTS.includes(session?.user?.email ?? "");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session === undefined) return;

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

    getAuthToken().then((token) => {
      fetch(`${backendUrl}/orgs/mine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => {
          if (!r.ok) throw new Error(`orgs/mine failed: ${r.status}`);
          return r.json();
        })
        .then((data: any[]) => {
          const first = data?.[0];
          if (first) {
            setWorkspaceId(first.id);
            setOrgName(first.name);
          } else if (pathname !== "/onboarding") {
            router.replace("/onboarding");
          }
        })
        .catch((err) => {
          console.error("workspace fetch error:", err.message);
          if (pathname !== "/onboarding") {
            router.replace("/onboarding");
          }
        })
        .finally(() => setLoading(false));
    });
  }, [session?.user?.id]);

  const setWorkspace = (id: string, name: string) => {
    setWorkspaceId(id);
    setOrgName(name);
  };

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, orgName, loading, isDesignMode, setWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
