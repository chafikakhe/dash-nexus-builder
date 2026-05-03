import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Activity as ActivityIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Row = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  created_at: string;
  org_id: string | null;
  org_name?: string | null;
};

const verbOf = (action: string) => action.split(".").slice(1).join(" ").replace(/_/g, " ") || action;

export default function AdminActivity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, actor_email, action, target_type, target_label, created_at, org_id, orgs:org_id(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { toast.error(error.message); setLoading(false); return; }
      setRows(((data ?? []) as any[]).map((r) => ({ ...r, org_name: r.orgs?.name ?? null })));
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Activity" }]} />
      <main className="flex-1 p-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Activity log</h1>
        <p className="text-sm text-muted-foreground mb-5">Cross-workspace audit trail · most recent 200.</p>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <ActivityIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-semibold">No activity recorded yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Run <code className="text-primary">supabase/activity.sql</code> if this view stays empty after user actions.
              </p>
            </div>
          ) : rows.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center">
                <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium">{e.actor_email ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{verbOf(e.action)}</span>{" "}
                {e.target_label && <span className="font-medium">{e.target_label}</span>}
              </div>
              {e.org_name && <Badge variant="secondary" className="font-normal">{e.org_name}</Badge>}
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
