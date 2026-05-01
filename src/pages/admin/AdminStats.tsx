import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabase";
import { Building2, Users, PanelsTopLeft, Database, Shield } from "lucide-react";

export default function AdminStats() {
  const [counts, setCounts] = useState<Record<string, number | null>>({
    users: null, orgs: null, dashboards: null, collections: null, admins: null,
  });

  useEffect(() => {
    (async () => {
      const [u, o, d, c, a] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("orgs").select("*", { count: "exact", head: true }),
        supabase.from("dashboards").select("*", { count: "exact", head: true }),
        supabase.from("collections").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_admin", true),
      ]);
      setCounts({
        users: u.count ?? 0, orgs: o.count ?? 0, dashboards: d.count ?? 0,
        collections: c.count ?? 0, admins: a.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Users", value: counts.users, icon: Users },
    { label: "Workspaces", value: counts.orgs, icon: Building2 },
    { label: "Dashboards", value: counts.dashboards, icon: PanelsTopLeft },
    { label: "Collections", value: counts.collections, icon: Database },
    { label: "Admins", value: counts.admins, icon: Shield },
  ];

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Stats" }]} />
      <main className="flex-1 p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform stats</h1>
          <p className="text-sm text-muted-foreground mt-1">Cross-workspace counts.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <div className="h-7 w-7 rounded-md bg-secondary grid place-items-center">
                  <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="text-2xl font-bold mt-2 tabular-nums">
                {c.value === null ? "—" : c.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
