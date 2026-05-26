import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import {
  describeWorkspaceActivity,
  fetchWorkspaceActivity,
  formatActivityError,
  getWorkspaceActivityIcon,
  type WorkspaceActivityEvent,
} from "@/lib/activity";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";

export default function ActivityPage() {
  const { currentOrgId, orgs } = useAuth();
  const { role } = useWorkspacePermissions();
  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const workspaceId = currentOrg?.id ?? null;
  const [events, setEvents] = useState<WorkspaceActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadActivity = async () => {
      try {
        setLoading(true);
        const data = await fetchWorkspaceActivity(workspaceId, 100);
        if (!cancelled) {
          setEvents(data);
        }
      } catch (error) {
        const message = formatActivityError(error);
        console.error("[activity] Failed to load workspace activity:", error);
        if (!cancelled) {
          toast.error(import.meta.env.DEV ? `Failed to load workspace activity: ${message}` : "Failed to load workspace activity.");
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <>
      <Topbar breadcrumb={[{ label: currentOrg?.name ?? "Workspace" }, { label: "Activity" }]} />
      <main className="flex-1 p-6 max-w-5xl animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit trail for workspace changes, member actions, and settings updates.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {role === "owner" || role === "admin" ? "Full workspace feed" : "Your activity"}
          </Badge>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center justify-center rounded-3xl border border-border bg-card/80 py-16 text-muted-foreground shadow-card">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading activity…
          </div>
        ) : events.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <h2 className="text-base font-semibold">No activity yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Activity will appear here after dashboards, collections, members, or settings change.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-border bg-card/90 shadow-card overflow-hidden">
            {events.map((event, index) => {
              const Icon = getWorkspaceActivityIcon(event);

              return (
                <div
                  key={event.id}
                  className={[
                    "grid gap-4 px-5 py-4 transition-colors hover:bg-secondary/30 sm:grid-cols-[auto_1fr_auto]",
                    index !== events.length - 1 ? "border-b border-border" : "",
                  ].join(" ")}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-6 text-foreground">
                      <span className="font-semibold">{event.user_name}</span>{" "}
                      <span className="text-muted-foreground">{describeWorkspaceActivity(event)}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(event.created_at).toLocaleString()}</span>
                      <span className="text-border">•</span>
                      <span className="uppercase tracking-wide">{event.target_type}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
