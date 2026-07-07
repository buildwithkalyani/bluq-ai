"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { fetchScheduleVersions, createScheduleVersion } from "@/lib/api-client";

/**
 * Resolves a schedule version ID for the current project.
 *
 * Priority:
 *   1. versionId already in URL → use it, no extra fetch
 *   2. Versions exist but none in URL → pick baseline (or latest), update URL
 *   3. No versions at all → auto-create v1, update URL
 *
 * Always syncs the chosen ID into the URL via router.replace so the layout
 * version dropdown and all other schedule pages stay in sync.
 */
export function useScheduleVersion(
  projectId: string,
  workspaceId: string | undefined,
  real: boolean,
): { resolvedVersionId: string | undefined; resolving: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlVersionId = searchParams.get("versionId") ?? undefined;

  const [resolvedVersionId, setResolvedVersionId] = useState<string | undefined>(urlVersionId);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    // URL already has a version — nothing to resolve
    if (urlVersionId) {
      setResolvedVersionId(urlVersionId);
      return;
    }

    if (!real || !workspaceId) return;

    let cancelled = false;
    setResolving(true);

    fetchScheduleVersions(projectId, workspaceId)
      .then(async (versions) => {
        if (cancelled) return;

        let versionId: string;
        if (versions.length > 0) {
          // Pick the baseline, falling back to latest (list is ordered desc by versionNumber)
          const pick = versions.find(v => v.isBaseline) ?? versions[0];
          versionId = pick.id;
        } else {
          // No versions exist yet — auto-create v1
          const newV = await createScheduleVersion(projectId, workspaceId);
          versionId = newV.id;
        }

        if (cancelled) return;

        setResolvedVersionId(versionId);

        // Sync into URL so layout dropdown + other pages see the same version
        const params = new URLSearchParams(searchParams.toString());
        params.set("versionId", versionId);
        router.replace(`${pathname}?${params.toString()}`);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setResolving(false); });

    return () => { cancelled = true; };
  // searchParams intentionally excluded — we only re-resolve when project/workspace changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workspaceId, real, urlVersionId]);

  return { resolvedVersionId: urlVersionId ?? resolvedVersionId, resolving };
}
