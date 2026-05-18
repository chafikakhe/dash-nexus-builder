import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight, TrendingUp, Database, Building2, Plus, PanelsTopLeft, Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useDashboards } from "@/hooks/useDashboards";
import { formatDistanceToNow } from "date-fns";

export default function Overview() {
  const { user, orgs, currentOrgId } = useAuth();
  const { dashboards, loading: loadingDb } = useDashboards();

  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (!currentOrgId) {
      setCollectionCount(0);
      setMemberCount(0);
      return;
    }

    (async () => {
      try {
        const [{ count: cCount }, { count: mCount }] = await Promise.all([
          supabase.from("collections").select("*", { count: "exact", head: true }).eq("org_id", currentOrgId),
          supabase.from("org_members").select("*", { count: "exact", head: true }).eq("org_id", currentOrgId),
        ]);
        setCollectionCount(cCount ?? 0);
        setMemberCount(mCount ?? 0);
      } catch (error) {
        console.error("[overview] stats load failed", error);
        setCollectionCount(0);
        setMemberCount(0);
      }
    })();
  }, [currentOrgId]);

  const stats = [
    { label: "Workspaces", value: orgs.length.toString(), icon: Building2 },
    { label: "Dashboards", value: loadingDb ? "—" : dashboards.length.toString(), icon: PanelsTopLeft },
    { label: "Collections", value: collectionCount === null ? "—" : collectionCount.toString(), icon: Database },
    { label: "Members", value: memberCount === null ? "—" : memberCount.toString(), icon: TrendingUp },
  ];

  const recent = dashboards.slice(0, 4);
  const greetingName = user?.email?.split("@")[0] ?? "there";

  return (
    <>
      <Topbar
        breadcrumb={[{ label: orgs.find((o) => o.id === currentOrgId)?.name ?? "Workspace" }, { label: "Overview" }]}
        actions={
          <Button size="sm" asChild className="bg-gradient-primary shadow-glow">
            <Link to="/app/dashboards/new"><Plus className="h-3.5 w-3.5 mr-1.5" />New dashboard</Link>
          </Button>
        }
      />
      <main className="flex-1 p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {greetingName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening across your workspace.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <div className="h-7 w-7 rounded-md bg-secondary grid place-items-center group-hover:bg-gradient-primary/15 transition-colors">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div className="text-2xl font-bold mt-2 tracking-tight tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">in current workspace</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Recent dashboards</h3>
            <Link to="/app/dashboards" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {loadingDb && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
              </div>
            )}
            {!loadingDb && recent.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No dashboards yet. <Link to="/app/dashboards/new" className="text-primary hover:underline">Create one</Link>
              </div>
            )}
            {recent.map((r) => {
              const widgets = Array.isArray(r.layout) ? r.layout.length : 0;
              return (
                <Link
                  to={`/app/dashboards/${r.id}`}
                  key={r.id}
                  className="flex items-center px-5 py-3 hover:bg-secondary/40 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-md bg-gradient-primary/15 border border-primary/20 grid place-items-center mr-3">
                    <PanelsTopLeft className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {widgets} widgets · updated {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
