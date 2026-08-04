import { QueryProvider } from "@/api/query-client";
import { DashboardSessionProvider } from "@/dashboard/dashboard-session-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <DashboardSessionProvider>
        {/* No width or padding here any more. The navigation bar spans the
            window and the content under it is centred, so the two cannot both
            be constrained by one container — each screen sets its own. */}
        <div className="min-h-dvh">{children}</div>
      </DashboardSessionProvider>
    </QueryProvider>
  );
}
