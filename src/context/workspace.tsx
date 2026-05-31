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
  orgLogoUrl: string | null;
  loading: boolean;
  isDesignMode: boolean;   // true → always show mock data
  setWorkspace: (id: string, name: string) => void;
  setOrgLogoUrl: (url: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  orgName: null,
  orgLogoUrl: null,
  loading: true,
  isDesignMode: false,
  setWorkspace: () => {},
  setOrgLogoUrl: () => {},
});

async function getAuthToken(): Promise<string> {
  const { authClient } = await import("@/lib/auth-client");
  const session = await authClient.getSession();
  return session?.data?.session?.token ?? "";
}

const WS_CACHE_KEY = "bluq_workspace";

type WorkspaceCache = { id: string; name: string; userId: string };

function readWorkspaceCache(): WorkspaceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeWorkspaceCache(id: string, name: string, userId: string): void {
  try {
    localStorage.setItem(WS_CACHE_KEY, JSON.stringify({ id, name, userId }));
  } catch {}
}

function clearWorkspaceCache(): void {
  try {
    localStorage.removeItem(WS_CACHE_KEY);
  } catch {}
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const isDesignMode = DESIGN_ACCOUNTS.includes(session?.user?.email ?? "");
  const router = useRouter();
  const pathname = usePathname();

  // Always start blank — cache is only trusted AFTER session confirms userId match.
  // This prevents User B from briefly seeing User A's workspace on the same device.
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session === undefined) return; // auth still resolving

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;
    const cached = readWorkspaceCache();

    if (cached && cached.userId === userId) {
      // Cache belongs to this exact user — safe to use immediately
      setWorkspaceId(cached.id);
      setOrgName(cached.name);
      setLoading(false); // show cached data; backend verify runs below
    } else if (cached && cached.userId !== userId) {
      // Different user's cache — discard it
      clearWorkspaceCache();
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
            if (first.logoUrl) setOrgLogoUrl(first.logoUrl);
            writeWorkspaceCache(first.id, first.name, userId);
            // Redirect to resume onboarding only if user hasn't explicitly skipped/finished
            const done = localStorage.getItem("onboarding_done") === "true";
            const savedStep = parseInt(localStorage.getItem("onboarding_step") ?? "0") || 0;
            if (!done && savedStep > 0 && pathname !== "/onboarding") {
              router.replace("/onboarding");
              return;
            }
          } else {
            clearWorkspaceCache();
            // No org exists for this user — clear any stale onboarding_done flag
            // (could be left by a different user on the same device) and force onboarding.
            localStorage.removeItem("onboarding_done");
            if (pathname !== "/onboarding" && !pathname.startsWith("/invite")) {
              router.replace("/onboarding");
            }
          }
        })
        .catch((err) => {
          console.error("workspace fetch error:", err.message);
          // No valid cache for this user and backend failed → force onboarding
          if (!cached?.userId || cached.userId !== userId) {
            localStorage.removeItem("onboarding_done");
            if (pathname !== "/onboarding" && !pathname.startsWith("/invite")) {
              router.replace("/onboarding");
            }
          }
        })
        .finally(() => setLoading(false));
    });
  }, [session?.user?.id]);

  const setWorkspace = (id: string, name: string) => {
    setWorkspaceId(id);
    setOrgName(name);
    writeWorkspaceCache(id, name, session?.user?.id ?? "");
  };

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, orgName, orgLogoUrl, loading, isDesignMode, setWorkspace, setOrgLogoUrl }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
