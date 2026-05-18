import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Activity as ActivityIcon, GitCommit, UserPlus, Database, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type ActivityEvent = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_name: string;
  created_at: string;
  user_name?: string;
};

const iconMap = {
  update: GitCommit,
  create: UserPlus,
  import: Database,
  generate: Sparkles,
  delete: GitCommit,
  system: ActivityIcon,
};

const formatTime = (isoDate: string) => {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

export default function ActivityPage() {
  const { currentOrgId, orgs } = useAuth();
  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) {
      setLoading(false);
      return;
    }

    (async () => {
      // TODO: Query activity table once it exists
      // For now, show a placeholder message
      setLoading(false);
    })();
  }, [currentOrgId]);

  return (
    <>
      <Topbar breadcrumb={[{ label: currentOrg?.name ?? "Workspace" }, { label: "Activity" }]} />
      <main className="flex-1 p-6 max-w-3xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit log of everything happening in your workspace.</p>

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading activity…
          </div>
        ) : events.length === 0 ? (
          <div className="mt-6 flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">No activity yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Activity tracking will appear here once you start creating dashboards and collections.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-border bg-card">
            {events.map((e) => {
              const Icon = iconMap[e.action as keyof typeof iconMap] || ActivityIcon;
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium">{e.user_name || "User"}</span>{" "}
                    <span className="text-muted-foreground">{e.action}</span>{" "}
                    <span className="font-medium">{e.resource_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
