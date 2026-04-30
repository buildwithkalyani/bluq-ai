"use client";
import { useEffect, useRef } from "react";
import { pollScheduleStatus } from "@/lib/api-client";

export const SCHEDULE_JOB_PREFIX = "bluq_schedule_job_";
export const SCHEDULE_RESULT_PREFIX = "bluq_schedule_result_";

export function useSchedulePoller() {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function stopPolling(projectId: string) {
    const t = timersRef.current.get(projectId);
    if (t) { clearTimeout(t); timersRef.current.delete(projectId); }
  }

  function startPolling(projectId: string, jobId: string) {
    stopPolling(projectId);

    const poll = async () => {
      try {
        const status = await pollScheduleStatus(jobId);

        window.dispatchEvent(
          new CustomEvent("bluq_schedule_progress", { detail: { projectId, status } })
        );

        if (status.status === "completed") {
          localStorage.removeItem(`${SCHEDULE_JOB_PREFIX}${projectId}`);
          localStorage.setItem(`${SCHEDULE_RESULT_PREFIX}${projectId}`, JSON.stringify(status.result));
          stopPolling(projectId);
          window.dispatchEvent(
            new CustomEvent("bluq_schedule_done", { detail: { projectId, result: status.result } })
          );
          return;
        }

        if (status.status === "failed") {
          localStorage.removeItem(`${SCHEDULE_JOB_PREFIX}${projectId}`);
          stopPolling(projectId);
          window.dispatchEvent(
            new CustomEvent("bluq_schedule_done", {
              detail: { projectId, error: status.error ?? status.message },
            })
          );
          return;
        }

        timersRef.current.set(projectId, setTimeout(poll, 3000));
      } catch {
        timersRef.current.set(projectId, setTimeout(poll, 5000));
      }
    };

    timersRef.current.set(projectId, setTimeout(poll, 2000));
  }

  useEffect(() => {
    // Resume any jobs already in localStorage (page refresh / prior navigation)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SCHEDULE_JOB_PREFIX)) {
        const projectId = key.slice(SCHEDULE_JOB_PREFIX.length);
        const jobId = localStorage.getItem(key);
        if (jobId) startPolling(projectId, jobId);
      }
    }

    // Pick up new jobs started after layout mounted
    const handleStarted = (e: Event) => {
      const { projectId, jobId } = (e as CustomEvent<{ projectId: string; jobId: string }>).detail;
      startPolling(projectId, jobId);
    };
    window.addEventListener("bluq_schedule_started", handleStarted);

    return () => {
      window.removeEventListener("bluq_schedule_started", handleStarted);
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
