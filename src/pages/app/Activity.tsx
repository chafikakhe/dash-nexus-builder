import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Activity as ActivityIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Row = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  created_at: string;
};

const verbOf = (action: string) => {
  const [, verb] = action.split(".");
  if (!verb) return action;
  return verb.replace(/_/g, " ");
};

export default function ActivityPage() {
  const { currentOrgId, orgs } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("activity_log")
      .select("id, actor_email, action, target_type, target_label, created_at")
      .eq("org_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [currentOrgId]);

  const orgName = orgs.find((o) => o.id === currentOrgId)?.name ?? "Workspace";

  return (
    <>
      <Topbar breadcrumb={[{ label: orgName }, { label: "Activity" }]} />
      <main className="flex-1 p-6 max-w-3xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit log of everything happening in your workspace.</p>

        <div className="mt-6 rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <ActivityIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-semibold">No activity yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Actions like creating dashboards, inviting members, or changing roles will appear here.
              </p>
            </div>
          ) : rows.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center">
                <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium">{e.actor_email ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{verbOf(e.action)}</span>{" "}
                {e.target_label && <span className="font-medium">{e.target_label}</span>}
                {e.target_type && !e.target_label && (
                  <span className="text-muted-foreground">a {e.target_type}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
