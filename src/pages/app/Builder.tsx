import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table2, Gauge, Activity,
  Trash2, Copy, Settings2, Save, Undo2, Redo2, Eye, ChevronLeft, Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WidgetType = "stat" | "line" | "bar" | "pie" | "table" | "gauge";
type Widget = { id: string; type: WidgetType; title: string; col: number; row: number; w: number; h: number };

const palette: { type: WidgetType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "stat", label: "Stat card", icon: Gauge },
  { type: "line", label: "Line chart", icon: LineIcon },
  { type: "bar", label: "Bar chart", icon: BarChart3 },
  { type: "pie", label: "Pie chart", icon: PieIcon },
  { type: "table", label: "Table", icon: Table2 },
  { type: "gauge", label: "Activity feed", icon: Activity },
];

const series = Array.from({ length: 12 }).map((_, i) => ({
  d: `${i + 1}`, v: Math.round(40 + Math.sin(i / 2) * 20 + i * 4),
}));
const pieData = [
  { name: "Web", value: 540 }, { name: "iOS", value: 320 },
  { name: "Android", value: 220 }, { name: "API", value: 110 },
];
const pieColors = ["hsl(var(--primary))", "hsl(var(--primary-glow))", "hsl(243 60% 40%)", "hsl(243 30% 30%)"];

const initial: Widget[] = [
  { id: "w1", type: "stat", title: "MRR", col: 0, row: 0, w: 3, h: 2 },
  { id: "w2", type: "stat", title: "Active users", col: 3, row: 0, w: 3, h: 2 },
  { id: "w3", type: "line", title: "Revenue trend", col: 6, row: 0, w: 6, h: 4 },
  { id: "w4", type: "bar", title: "Signups by channel", col: 0, row: 2, w: 6, h: 4 },
  { id: "w5", type: "pie", title: "Traffic sources", col: 6, row: 4, w: 6, h: 4 },
  { id: "w6", type: "table", title: "Latest customers", col: 0, row: 6, w: 6, h: 4 },
];

function WidgetBody({ type }: { type: WidgetType }) {
  if (type === "stat") {
    return (
      <div className="h-full flex flex-col justify-end">
        <div className="text-3xl font-bold tracking-tight">$48,290</div>
        <div className="text-xs text-success mt-1">+12.4% vs last week</div>
      </div>
    );
  }
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id="ln" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="d" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
          <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ln)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="d" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
          <Bar dataKey="v" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="hsl(var(--background))">
            {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (type === "table") {
    return (
      <div className="h-full overflow-auto scrollbar-thin text-xs">
        <table className="w-full">
          <thead className="text-muted-foreground border-b border-border">
            <tr><th className="text-left py-1.5 font-medium">Name</th><th className="text-left font-medium">Plan</th><th className="text-right font-medium">MRR</th></tr>
          </thead>
          <tbody>
            {[
              ["Acme Co.", "Pro", "$890"],
              ["Northwind", "Enterprise", "$4,200"],
              ["Initech", "Pro", "$890"],
              ["Hooli", "Free", "$0"],
              ["Stark Industries", "Enterprise", "$5,800"],
            ].map(([n, p, m]) => (
              <tr key={n} className="border-b border-border/50 hover:bg-secondary/40">
                <td className="py-1.5">{n}</td><td className="text-muted-foreground">{p}</td><td className="text-right font-medium">{m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-xs">
      {[
        ["jane@acme.com", "upgraded plan", "2m"],
        ["dev@stark.io", "deployed v1.4", "8m"],
        ["sara@hooli.com", "invited 3 members", "1h"],
        ["api", "synced 12k records", "2h"],
      ].map(([who, what, when], i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-medium truncate">{who}</span>
          <span className="text-muted-foreground truncate flex-1">{what}</span>
          <span className="text-muted-foreground">{when}</span>
        </div>
      ))}
    </div>
  );
}

export default function Builder() {
  const [widgets, setWidgets] = useState<Widget[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>("w3");
  const [name, setName] = useState("Untitled dashboard");
  const selected = widgets.find((w) => w.id === selectedId);

  const addWidget = (type: WidgetType) => {
    const id = `w_${Date.now()}`;
    setWidgets((ws) => [...ws, { id, type, title: palette.find((p) => p.type === type)!.label, col: 0, row: 99, w: 4, h: 3 }]);
    setSelectedId(id);
    toast.success("Widget added");
  };
  const duplicate = (id: string) => {
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    const nid = `w_${Date.now()}`;
    setWidgets((ws) => [...ws, { ...w, id: nid }]);
    setSelectedId(nid);
  };
  const remove = (id: string) => {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const update = (id: string, patch: Partial<Widget>) =>
    setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Dashboards" }, { label: name }]}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/app/dashboards"><ChevronLeft className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Redo2 className="h-4 w-4" /></Button>
            <div className="h-5 w-px bg-border mx-1" />
            <Button variant="outline" size="sm" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Preview</Button>
            <Button size="sm" className="gap-1.5 bg-gradient-primary shadow-glow" onClick={() => toast.success("Dashboard saved")}>
              <Save className="h-3.5 w-3.5" />Save
            </Button>
          </div>
        }
      />
      <div className="flex-1 flex min-h-0">
        {/* Left palette */}
        <aside className="w-56 border-r border-border bg-card/60 backdrop-blur-xl p-3 space-y-1 overflow-y-auto scrollbar-thin">
          <div className="px-2 pt-1 pb-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-0 bg-transparent px-0 h-7 text-base font-semibold focus-visible:ring-0"
            />
          </div>
          <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Widgets</div>
          {palette.map((p) => (
            <button
              key={p.type}
              onClick={() => addWidget(p.type)}
              className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors group"
            >
              <div className="h-6 w-6 rounded bg-secondary group-hover:bg-gradient-primary/20 grid place-items-center transition-colors">
                <p.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              </div>
              {p.label}
            </button>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-3 gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />Generate with AI
          </Button>
        </aside>

        {/* Canvas */}
        <main className="flex-1 overflow-auto scrollbar-thin bg-background">
          <div className="min-h-full p-8">
            <div
              className="relative grid-bg rounded-xl border border-border/70 bg-card/30 p-4 mx-auto"
              style={{ maxWidth: 1100 }}
              onClick={() => setSelectedId(null)}
            >
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                  gridAutoRows: "56px",
                }}
              >
                {widgets.map((w) => (
                  <div
                    key={w.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(w.id); }}
                    className={cn(
                      "group relative rounded-lg border bg-card p-3 cursor-pointer transition-all",
                      selectedId === w.id
                        ? "border-primary shadow-glow ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    )}
                    style={{
                      gridColumn: `span ${w.w} / span ${w.w}`,
                      gridRow: `span ${w.h} / span ${w.h}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-muted-foreground truncate">{w.title}</div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); duplicate(w.id); }}
                          className="h-6 w-6 rounded hover:bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); remove(w.id); }}
                          className="h-6 w-6 rounded hover:bg-destructive/15 grid place-items-center text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="absolute inset-x-3 top-9 bottom-3">
                      <WidgetBody type={w.type} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Right inspector */}
        <aside className="w-72 border-l border-border bg-card/60 backdrop-blur-xl p-4 overflow-y-auto scrollbar-thin">
          {selected ? (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Widget settings</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Title</Label>
                <Input
                  value={selected.title}
                  onChange={(e) => update(selected.id, { title: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Width — {selected.w} cols</Label>
                <Slider
                  value={[selected.w]} min={2} max={12} step={1}
                  onValueChange={([v]) => update(selected.id, { w: v })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Height — {selected.h} rows</Label>
                <Slider
                  value={[selected.h]} min={2} max={8} step={1}
                  onValueChange={([v]) => update(selected.id, { h: v })}
                />
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground space-y-1">
                <div>Type · <span className="text-foreground capitalize">{selected.type}</span></div>
                <div>Position · col {selected.col}, row {selected.row}</div>
                <div>Data source · <span className="text-foreground">PostgreSQL</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => duplicate(selected.id)}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicate
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-muted-foreground pt-12">
              <Settings2 className="h-5 w-5 mx-auto mb-2 opacity-40" />
              Select a widget to edit
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
