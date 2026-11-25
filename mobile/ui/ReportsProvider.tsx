import { createContext, useContext, useLayoutEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../auth/context";
import { createReportSubmissions } from "./reportSubmission";

const ReportsContext = createContext<ReturnType<typeof createReportSubmissions> | null>(null);

export function ReportsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const [submissions] = useState(createReportSubmissions);
  useLayoutEffect(() => {
    submissions.setOwner(ownerId);
  }, [ownerId, submissions]);

  return <ReportsContext.Provider value={submissions}>{children}</ReportsContext.Provider>;
}

export function useReportSubmissions() {
  const submissions = useContext(ReportsContext);
  if (!submissions) throw new Error("ReportsProvider missing");
  return submissions;
}
