import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  name: string;
  layout: any;
  updated_at: string;
  org_id: string;
  org_name?: string;
};

export default function AdminDashboards() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("id, name, layout, updated_at, org_id, orgs:org_id(name)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) { toast.error(error.message); setLoading(false); return; }
      setRows(((data ?? []) as any[]).map((r) => ({ ...r, org_name: r.orgs?.name })));
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Dashboards" }]} />
      <main className="flex-1 p-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight mb-1">All dashboards</h1>
        <p className="text-sm text-muted-foreground mb-5">Cross-workspace · most recent 100.</p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Dashboard</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Workspace</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Widgets</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="font-normal">{r.org_name ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {Array.isArray(r.layout) ? r.layout.length : 0}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
