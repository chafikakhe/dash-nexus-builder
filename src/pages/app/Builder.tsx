import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { fetchDashboard, useDashboards } from "@/hooks/useDashboards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table2, Gauge, Activity,
  Trash2, Copy, Settings2, Save, Undo2, Redo2, Eye, ChevronLeft, Sparkles,
  GripVertical,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type WidgetType = "stat" | "line" | "bar" | "pie" | "table" | "gauge";
type Widget = { id: string; type: WidgetType; title: string; w: number; h: number };

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
  { id: "w1", type: "stat", title: "MRR", w: 3, h: 2 },
  { id: "w2", type: "stat", title: "Active users", w: 3, h: 2 },
  { id: "w3", type: "line", title: "Revenue trend", w: 6, h: 4 },
  { id: "w4", type: "bar", title: "Signups by channel", w: 6, h: 4 },
  { id: "w5", type: "pie", title: "Traffic sources", w: 6, h: 4 },
  { id: "w6", type: "table", title: "Latest customers", w: 6, h: 4 },
];

const ROW_H = 56;
const GAP = 12;

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

/* -------- Palette draggable -------- */
function PaletteItem({ type, label, Icon }: { type: WidgetType; label: string; Icon: React.ComponentType<{ className?: string }> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: "palette", type },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors group cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className="h-6 w-6 rounded bg-secondary group-hover:bg-gradient-primary/20 grid place-items-center transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
      {label}
    </button>
  );
}

/* -------- Sortable widget on canvas -------- */
function SortableWidget({
  widget, selected, onSelect, onDuplicate, onRemove, onResize, gridRef,
}: {
  widget: Widget;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResize: (w: number, h: number) => void;
  gridRef: React.RefObject<HTMLDivElement>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { source: "canvas" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${widget.w} / span ${widget.w}`,
    gridRow: `span ${widget.h} / span ${widget.h}`,
    opacity: isDragging ? 0.5 : 1,
  };

  const startResize = (e: React.PointerEvent, axis: "x" | "y" | "xy") => {
    e.stopPropagation();
    e.preventDefault();
    const grid = gridRef.current;
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();
    const colW = (gridRect.width - GAP * 11) / 12;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = widget.w;
    const startH = widget.h;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nw = startW;
      let nh = startH;
      if (axis !== "y") nw = Math.min(12, Math.max(2, startW + Math.round(dx / (colW + GAP))));
      if (axis !== "x") nh = Math.min(8, Math.max(2, startH + Math.round(dy / (ROW_H + GAP))));
      onResize(nw, nh);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn(
        "group relative rounded-lg border bg-card p-3 transition-colors",
        selected
          ? "border-primary shadow-glow ring-2 ring-primary/30"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            {...listeners}
            {...attributes}
            className="h-5 w-5 rounded grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing shrink-0"
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag widget"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <div className="text-xs font-semibold text-muted-foreground truncate">{widget.title}</div>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="h-6 w-6 rounded hover:bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="h-6 w-6 rounded hover:bg-destructive/15 grid place-items-center text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="absolute inset-x-3 top-9 bottom-3 pointer-events-none">
        <div className="h-full w-full pointer-events-auto">
          <WidgetBody type={widget.type} />
        </div>
      </div>

      {/* Resize handles */}
      <div
        onPointerDown={(e) => startResize(e, "x")}
        className="absolute top-2 bottom-2 -right-0.5 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 rounded"
      />
      <div
        onPointerDown={(e) => startResize(e, "y")}
        className="absolute left-2 right-2 -bottom-0.5 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 rounded"
      />
      <div
        onPointerDown={(e) => startResize(e, "xy")}
        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 cursor-nwse-resize opacity-0 group-hover:opacity-100"
      >
        <div className="absolute bottom-0.5 right-0.5 h-2 w-2 border-r-2 border-b-2 border-primary/70 rounded-sm" />
      </div>
    </div>
  );
}

/* -------- Canvas droppable wrapper -------- */
function CanvasDroppable({ children, gridRef }: { children: React.ReactNode; gridRef: React.RefObject<HTMLDivElement> }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={(node) => { setNodeRef(node); (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      className={cn(
        "grid gap-3 transition-colors rounded-lg p-1 -m-1",
        isOver && "bg-primary/5 ring-1 ring-primary/30"
      )}
      style={{
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gridAutoRows: `${ROW_H}px`,
      }}
    >
      {children}
    </div>
  );
}

export default function Builder() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { create, update: updateDashboard } = useDashboards();

  const [dashboardId, setDashboardId] = useState<string | null>(routeId ?? null);
  const [widgets, setWidgets] = useState<Widget[]>(routeId ? [] : initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled dashboard");
  const [saving, setSaving] = useState(false);
  const [loadingDb, setLoadingDb] = useState(Boolean(routeId));
  const [activeDrag, setActiveDrag] = useState<{ kind: "palette"; type: WidgetType } | { kind: "widget"; id: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const selected = widgets.find((w) => w.id === selectedId);

  // Load existing dashboard
  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    setLoadingDb(true);
    fetchDashboard(routeId).then((db) => {
      if (cancelled) return;
      if (db) {
        setName(db.name);
        setDashboardId(db.id);
        const layout = Array.isArray(db.layout) ? (db.layout as Widget[]) : [];
        setWidgets(layout);
      } else {
        toast.error("Dashboard not found");
        navigate("/app/dashboards", { replace: true });
      }
      setLoadingDb(false);
    });
    return () => { cancelled = true; };
  }, [routeId, navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (dashboardId) {
        await update(dashboardId, { name, layout: widgets });
        toast.success("Dashboard saved");
      } else {
        const created = await create({ name, layout: widgets });
        if (created) {
          setDashboardId(created.id);
          toast.success("Dashboard created");
          navigate(`/app/dashboards/${created.id}`, { replace: true });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const update = (id: string, patch: Partial<Widget>) =>
    setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const duplicate = (id: string) => {
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    const nid = `w_${Date.now()}`;
    const idx = widgets.findIndex((x) => x.id === id);
    setWidgets((ws) => [...ws.slice(0, idx + 1), { ...w, id: nid }, ...ws.slice(idx + 1)]);
    setSelectedId(nid);
  };
  const remove = (id: string) => {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { source?: string; type?: WidgetType } | undefined;
    if (data?.source === "palette" && data.type) setActiveDrag({ kind: "palette", type: data.type });
    else setActiveDrag({ kind: "widget", id: String(e.active.id) });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDrag(null);
    if (!over) return;

    const activeData = active.data.current as { source?: string; type?: WidgetType } | undefined;

    // Drop from palette → add new widget at end (or before target)
    if (activeData?.source === "palette" && activeData.type) {
      const id = `w_${Date.now()}`;
      const def = palette.find((p) => p.type === activeData.type)!;
      const newW: Widget = { id, type: activeData.type, title: def.label, w: 4, h: 3 };
      if (over.id === "canvas") {
        setWidgets((ws) => [...ws, newW]);
      } else {
        const idx = widgets.findIndex((w) => w.id === over.id);
        setWidgets((ws) => idx === -1 ? [...ws, newW] : [...ws.slice(0, idx), newW, ...ws.slice(idx)]);
      }
      setSelectedId(id);
      toast.success(`${def.label} added`);
      return;
    }

    // Reorder existing widget
    if (active.id !== over.id && over.id !== "canvas") {
      const oldIdx = widgets.findIndex((w) => w.id === active.id);
      const newIdx = widgets.findIndex((w) => w.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        setWidgets((ws) => arrayMove(ws, oldIdx, newIdx));
      }
    }
  };

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
            <Button size="sm" className="gap-1.5 bg-gradient-primary shadow-glow" onClick={handleSave} disabled={saving || loadingDb}>
              <Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
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
            <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Widgets · drag onto canvas
            </div>
            {palette.map((p) => (
              <PaletteItem key={p.type} type={p.type} label={p.label} Icon={p.icon} />
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
                <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
                  <CanvasDroppable gridRef={gridRef}>
                    {widgets.map((w) => (
                      <SortableWidget
                        key={w.id}
                        widget={w}
                        selected={selectedId === w.id}
                        onSelect={() => setSelectedId(w.id)}
                        onDuplicate={() => duplicate(w.id)}
                        onRemove={() => remove(w.id)}
                        onResize={(nw, nh) => update(w.id, { w: nw, h: nh })}
                        gridRef={gridRef}
                      />
                    ))}
                    {widgets.length === 0 && (
                      <div className="col-span-12 row-span-4 grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                        Drag a widget from the palette to start building
                      </div>
                    )}
                  </CanvasDroppable>
                </SortableContext>
              </div>
            </div>
          </main>

          {/* Right inspector */}
          <aside className="w-72 border-l border-border bg-card/60 backdrop-blur-xl p-4 overflow-y-auto scrollbar-thin">
            {selected ? (
              <div className="space-y-5 animate-fade-in" key={selected.id}>
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
                  <div>Size · <span className="text-foreground">{selected.w} × {selected.h}</span></div>
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

        <DragOverlay>
          {activeDrag?.kind === "palette" && (() => {
            const def = palette.find((p) => p.type === activeDrag.type)!;
            return (
              <div className="rounded-lg border border-primary bg-card shadow-glow px-3 py-2 text-sm flex items-center gap-2">
                <def.icon className="h-3.5 w-3.5 text-primary" />
                {def.label}
              </div>
            );
          })()}
          {activeDrag?.kind === "widget" && (() => {
            const w = widgets.find((x) => x.id === activeDrag.id);
            if (!w) return null;
            return (
              <div className="rounded-lg border border-primary bg-card shadow-glow px-3 py-2 text-xs font-semibold">
                {w.title}
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </>
  );
}
