import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Star, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const dashboards = [
  { id: "1", name: "Revenue overview", desc: "MRR, churn and expansion", widgets: 8, updated: "2 min ago", starred: true, tag: "Finance" },
  { id: "2", name: "Customer health", desc: "NPS, retention, support tickets", widgets: 12, updated: "1 hr ago", starred: true, tag: "CS" },
  { id: "3", name: "Product analytics", desc: "DAU/WAU/MAU + feature use", widgets: 6, updated: "Yesterday", starred: false, tag: "Product" },
  { id: "4", name: "Support queue", desc: "Live ticket volume + SLA", widgets: 4, updated: "2 days ago", starred: false, tag: "CS" },
  { id: "5", name: "Growth funnel", desc: "Signup → activation → paid", widgets: 9, updated: "3 days ago", starred: false, tag: "Growth" },
  { id: "6", name: "Infrastructure", desc: "API latency, error rate, uptime", widgets: 10, updated: "1 week ago", starred: false, tag: "Eng" },
];

export default function Dashboards() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Acme Inc." }, { label: "Dashboards" }]}
        actions={
          <Button size="sm" asChild className="bg-gradient-primary shadow-glow">
            <Link to="/app/dashboards/new"><Plus className="h-3.5 w-3.5 mr-1.5" />New dashboard</Link>
          </Button>
        }
      />
      <main className="flex-1 p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
            <p className="text-sm text-muted-foreground mt-1">All dashboards across your workspace.</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9 w-64 bg-secondary/40" placeholder="Search dashboards…" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" />Generate with AI</Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d) => (
            <Link
              to="/app/dashboards/new"
              key={d.id}
              className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-glow transition-all"
            >
              <div className="aspect-[16/10] dot-bg p-4 border-b border-border bg-gradient-to-br from-secondary/40 to-card relative">
                <div className="grid grid-cols-3 gap-2 h-full">
                  <div className="col-span-2 rounded bg-gradient-primary/20 border border-primary/20" />
                  <div className="rounded bg-secondary/60 border border-border" />
                  <div className="rounded bg-secondary/60 border border-border" />
                  <div className="col-span-2 rounded bg-secondary/60 border border-border" />
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{d.name}</h3>
                      {d.starred && <Star className="h-3 w-3 fill-warning text-warning" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{d.desc}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">{d.tag}</Badge>
                  <span>·</span>
                  <span>{d.widgets} widgets</span>
                  <span>·</span>
                  <span>{d.updated}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
