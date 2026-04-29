import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Database, Filter, Download, Sparkles, Type, Hash, ToggleLeft, ListChecks, Calendar, Image as Img } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const collections = [
  { id: "users", name: "Users", count: 12_841, icon: "U" },
  { id: "orders", name: "Orders", count: 4_320, icon: "O" },
  { id: "products", name: "Products", count: 184, icon: "P" },
  { id: "tickets", name: "Tickets", count: 96, icon: "T" },
];

const fieldIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type, number: Hash, boolean: ToggleLeft, select: ListChecks, date: Calendar, image: Img,
};

const fields = [
  { name: "name", type: "text" },
  { name: "email", type: "text" },
  { name: "plan", type: "select" },
  { name: "mrr", type: "number" },
  { name: "active", type: "boolean" },
  { name: "joined", type: "date" },
];

const records = [
  { name: "Jane Cooper", email: "jane@acme.io", plan: "Pro", mrr: 89, active: true, joined: "2026-01-12" },
  { name: "Wade Warren", email: "wade@northwind.dev", plan: "Enterprise", mrr: 4200, active: true, joined: "2025-11-04" },
  { name: "Esther Howard", email: "esther@hooli.com", plan: "Free", mrr: 0, active: false, joined: "2026-03-18" },
  { name: "Cameron Williamson", email: "cam@stark.io", plan: "Enterprise", mrr: 5800, active: true, joined: "2025-08-22" },
  { name: "Brooklyn Simmons", email: "b.simmons@initech.co", plan: "Pro", mrr: 89, active: true, joined: "2026-02-09" },
  { name: "Leslie Alexander", email: "leslie@globex.io", plan: "Pro", mrr: 89, active: false, joined: "2025-12-30" },
  { name: "Jenny Wilson", email: "jenny@umbrella.org", plan: "Free", mrr: 0, active: true, joined: "2026-04-01" },
  { name: "Robert Fox", email: "rfox@dashforge.io", plan: "Enterprise", mrr: 6400, active: true, joined: "2025-06-15" },
];

const planColor = (p: string) =>
  p === "Enterprise" ? "bg-primary/15 text-primary border-primary/30" :
  p === "Pro" ? "bg-success/15 text-success border-success/30" :
  "bg-secondary text-muted-foreground border-border";

export default function Collections() {
  const [activeId, setActiveId] = useState("users");
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Acme Inc." }, { label: "Collections" }]}
        actions={
          <Button size="sm" className="bg-gradient-primary shadow-glow"><Plus className="h-3.5 w-3.5 mr-1.5" />New collection</Button>
        }
      />
      <div className="flex-1 flex min-h-0">
        {/* Collections list */}
        <aside className="w-60 border-r border-border bg-card/60 backdrop-blur-xl p-3 overflow-y-auto scrollbar-thin">
          <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Collections</div>
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                activeId === c.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <div className="h-6 w-6 rounded bg-gradient-primary/15 border border-primary/20 grid place-items-center text-[10px] font-bold text-primary">
                {c.icon}
              </div>
              <span className="flex-1 text-left">{c.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{c.count.toLocaleString()}</span>
            </button>
          ))}
          <Button variant="ghost" size="sm" className="w-full mt-2 justify-start text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5 mr-2" />New collection</Button>
        </aside>

        {/* Records */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold capitalize">{activeId}</h2>
            <Badge variant="secondary" className="font-normal">12,841 records</Badge>
            <div className="ml-auto flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 w-56 bg-secondary/40 text-xs" placeholder="Search records…" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" />Filter</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" />AI</Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
                <tr>
                  {fields.map((f) => {
                    const Icon = fieldIcons[f.type];
                    return (
                      <th key={f.name} className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3" />
                          {f.name}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-2.5 w-10">
                    <button className="text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border", planColor(r.plan))}>{r.plan}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">${r.mrr.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs", r.active ? "text-success" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", r.active ? "bg-success animate-pulse-glow" : "bg-muted-foreground/60")} />
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{r.joined}</td>
                    <td />
                  </tr>
                ))}
                <tr>
                  <td colSpan={7} className="px-4 py-2">
                    <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                      <Plus className="h-3 w-3" /> New record
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </>
  );
}
