import { QueryProvider } from "@/api/query-client";
import { PortalSessionProvider } from "@/portal/portal-session-context";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PortalSessionProvider>
        {/* The bar spans the window and the content under it is centred, so
            each screen sets its own width rather than inheriting one here. */}
        <div className="min-h-dvh">{children}</div>
      </PortalSessionProvider>
    </QueryProvider>
  );
}
