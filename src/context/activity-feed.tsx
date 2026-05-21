"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface ActivityUpdate {
  id: string;
  source: "whatsapp" | "email" | "manual";
  from: string;
  timeAgo: string;
  message: string;
  impact: string;
  severity: "fresh" | "warning" | "neutral";
  taskId?: string;
}

interface ActivityFeedCtx {
  showActivityFeed: boolean;
  setShowActivityFeed: (v: boolean | ((p: boolean) => boolean)) => void;
  activity: ActivityUpdate[];
  addActivity: (update: ActivityUpdate) => void;
  setActivity: (updates: ActivityUpdate[]) => void;
}

const ActivityFeedContext = createContext<ActivityFeedCtx>({
  showActivityFeed: false,
  setShowActivityFeed: () => {},
  activity: [],
  addActivity: () => {},
  setActivity: () => {},
});

export function ActivityFeedProvider({ children }: { children: ReactNode }) {
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [activity, setActivityState] = useState<ActivityUpdate[]>([]);

  const addActivity = useCallback((update: ActivityUpdate) => {
    setActivityState(prev => [update, ...prev.filter(a => a.id !== update.id)].slice(0, 50));
  }, []);

  const setActivity = useCallback((updates: ActivityUpdate[]) => {
    setActivityState(updates);
  }, []);

  return (
    <ActivityFeedContext.Provider value={{ showActivityFeed, setShowActivityFeed, activity, addActivity, setActivity }}>
      {children}
    </ActivityFeedContext.Provider>
  );
}

export function useActivityFeed() {
  return useContext(ActivityFeedContext);
}
