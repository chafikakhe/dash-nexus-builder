import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabase";
import { Loader2, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  member_count: number;
  dashboard_count: number;
};

export default function AdminOrgs() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("orgs").select("*").order("created_at", { ascending: false });
      if (error) { toast.error(error.message); setLoading(false); return; }
      const rows = await Promise.all(
        (data ?? []).map(async (o: any) => {
          const [{ count: mc }, { count: dc }] = await Promise.all([
            supabase.from("org_members").select("*", { count: "exact", head: true }).eq("org_id", o.id),
            supabase.from("dashboards").select("*", { count: "exact", head: true }).eq("org_id", o.id),
          ]);
          return { ...o, member_count: mc ?? 0, dashboard_count: dc ?? 0 };
        })
      );
      setOrgs(rows as OrgRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Workspaces" }]} />
      <main className="flex-1 p-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Workspaces</h1>
        <p className="text-sm text-muted-foreground mb-5">{orgs.length} workspaces across the platform.</p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Workspace</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Plan</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Members</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Dashboards</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-md bg-gradient-primary/15 border border-primary/20 grid place-items-center">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{o.name}</div>
                          <div className="text-xs text-muted-foreground">{o.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="font-normal capitalize">{o.plan}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.member_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.dashboard_count}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {new Date(o.created_at).toLocaleDateString()}
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
