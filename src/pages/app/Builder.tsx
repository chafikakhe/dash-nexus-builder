import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { fetchDashboard, useDashboards } from "@/hooks/useDashboards";
import { useCollections } from "@/hooks/useCollections";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table2, Gauge,
  Trash2, Copy, Settings2, Save, Undo2, Redo2, Eye, ChevronLeft, Sparkles,
  GripVertical, PanelsTopLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GenerateDashboardModal } from "@/features/ai-dashboard/GenerateDashboardModal";
import type { GeneratedDashboardWidget } from "@/features/ai-dashboard/generateDashboard";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type WidgetType = "stat" | "bar_chart" | "line_chart" | "pie_chart" | "table";
type WidgetConfig = {
  value?: string;
  delta?: string;
  valueKey?: string | null;
  aggregate?: "count" | "sum" | "avg" | "max" | "min";
  series?: Array<{ label: string; value: number }>;
  segments?: Array<{ name: string; value: number }>;
  columns?: string[];
  rows?: Array<Record<string, any>>;
  collection_id?: string | null;
  xKey?: string | null;
  yKey?: string | null;
  groupKey?: string | null;
};
type Widget = { id: string; type: WidgetType; title: string; w: number; h: number; config?: WidgetConfig };

const palette: { type: WidgetType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "stat", label: "Stat card", icon: Gauge },
  { type: "line_chart", label: "Line chart", icon: LineIcon },
  { type: "bar_chart", label: "Bar chart", icon: BarChart3 },
  { type: "pie_chart", label: "Pie chart", icon: PieIcon },
  { type: "table", label: "Table", icon: Table2 },
];

const WIDGET_TYPES = ["stat", "bar_chart", "line_chart", "pie_chart", "table"] as const;
const widgetTypeLabels: Record<WidgetType, string> = {
  stat: "stat",
  bar_chart: "bar chart",
  line_chart: "line chart",
  pie_chart: "pie chart",
  table: "table",
};

function normalizeWidgetType(type: unknown): WidgetType | null {
  if (type === "bar") return "bar_chart";
  if (type === "line") return "line_chart";
  if (type === "pie") return "pie_chart";
  return WIDGET_TYPES.includes(type as WidgetType) ? (type as WidgetType) : null;
}

function normalizeWidget(widget: unknown): Widget | null {
  if (!widget || typeof widget !== "object") return null;
  const raw = widget as Widget & { type?: unknown };
  const type = normalizeWidgetType(raw.type);
  if (!type) return null;
  return { ...raw, type };
}

function validateWidgetsForSave(items: Widget[]): string | null {
  const invalid = items.find((widget) => !normalizeWidgetType(widget.type));
  return invalid ? `Invalid widget type "${String(invalid.type)}".` : null;
}

const initial: Widget[] = [];

const defaultWidgetConfig = (type: WidgetType): WidgetConfig | undefined => {
  switch (type) {
    case "stat":
      return { value: "", delta: "", collection_id: null, valueKey: null, aggregate: "count", columns: [], rows: [] };
    case "line_chart":
      return { series: [], collection_id: null, xKey: null, yKey: null, columns: [], rows: [] };
    case "bar_chart":
      return { series: [], collection_id: null, xKey: null, yKey: null, columns: [], rows: [] };
    case "pie_chart":
      return { segments: [], collection_id: null, xKey: null, yKey: null, columns: [], rows: [] };
    case "table":
      return { columns: [], rows: [], collection_id: null };
    default:
      return undefined;
  }
};

const ROW_H = 56;
const GAP = 12;

function WidgetBody({ widget }: { widget: Widget }) {
  const config = widget.config;
  const noData = (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
      No data configured for this widget.
    </div>
  );

  if (widget.type === "stat") {
    const rows = config?.rows ?? [];
    const valueKey = config?.valueKey;
    const aggregate = config?.aggregate ?? "count";
    let displayValue = config?.value ?? "";

    if (config?.collection_id && valueKey) {
      const values = rows.map((row) => Number(row[valueKey])).filter((num) => !Number.isNaN(num));
      if (aggregate === "count") {
        displayValue = String(rows.length);
      } else if (values.length) {
        switch (aggregate) {
          case "sum":
            displayValue = String(values.reduce((total, num) => total + num, 0));
            break;
          case "avg":
            displayValue = String(values.reduce((total, num) => total + num, 0) / values.length);
            break;
          case "max":
            displayValue = String(Math.max(...values));
            break;
          case "min":
            displayValue = String(Math.min(...values));
            break;
          default:
            displayValue = String(values.length);
        }
      }
    }

    return (
      <div className="h-full flex flex-col justify-end">
        <div className="text-3xl font-bold tracking-tight">{displayValue || "—"}</div>
        {config?.delta ? <div className="text-xs text-success mt-1">{config.delta}</div> : null}
      </div>
    );
  }

  if (widget.type === "line_chart" || widget.type === "bar_chart") {
    const rows = config?.rows ?? [];
    const xKey = config?.xKey;
    const yKey = config?.yKey;
    const data = xKey && yKey ? rows.map((row) => ({ label: String(row[xKey] ?? ""), value: Number(row[yKey] ?? 0) })) : [];
    if (!xKey || !yKey || !data.length) return noData;
    return (
      <ResponsiveContainer width="100%" height="100%">
        {widget.type === "line_chart" ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ln" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
            <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ln)" />
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
            <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  }

  if (widget.type === "pie_chart") {
    const rows = config?.rows ?? [];
    const categoryKey = config?.xKey;
    const valueKey = config?.yKey;
    const segments = categoryKey && valueKey ? Object.values(rows.reduce((acc, row) => {
      const category = String(row[categoryKey] ?? "Unknown");
      const value = Number(row[valueKey] ?? 0);
      if (!acc[category]) acc[category] = { name: category, value: 0 };
      acc[category].value += value;
      return acc;
    }, {} as Record<string, { name: string; value: number }>)) : [];
    if (!categoryKey || !valueKey || !segments.length) return noData;
    const colors = ["hsl(var(--primary))", "hsl(var(--primary-glow))", "hsl(243 60% 40%)", "hsl(243 30% 30%)"];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={segments} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="70%" paddingAngle={2} stroke="hsl(var(--background))">
            {segments.map((segment, i) => <Cell key={segment.name} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === "table") {
    const rows = config?.rows ?? [];
    const columns = config?.columns ?? [];
    if (!rows.length || !columns.length) return noData;
    return (
      <div className="h-full overflow-auto scrollbar-thin text-xs">
        <table className="w-full border-collapse">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              {columns.map((column) => (
                <th key={column} className="text-left py-1.5 font-medium">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex} className="border-b border-border/50 hover:bg-secondary/40">
                {columns.map((column) => (
                  <td key={column} className="py-1.5">{String(row[column] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return noData;
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
          <WidgetBody widget={widget} />

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
  const { currentOrgId, user } = useAuth();
  const { collections } = useCollections();
  const { canCreateContent, canManageWorkspace, isAdmin } = useWorkspacePermissions();

  const [dashboardId, setDashboardId] = useState<string | null>(routeId ?? null);
  const [widgets, setWidgets] = useState<Widget[]>(routeId ? [] : initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled dashboard");
  const [saving, setSaving] = useState(false);
  const [loadingDb, setLoadingDb] = useState(Boolean(routeId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [previewWidgets, setPreviewWidgets] = useState<Widget[]>([]);
  const [activeDrag, setActiveDrag] = useState<{ kind: "palette"; type: WidgetType } | { kind: "widget"; id: string } | null>(null);
  const [canEditCurrentDashboard, setCanEditCurrentDashboard] = useState(!routeId && canCreateContent);
  const [widgetsPanelOpen, setWidgetsPanelOpen] = useState(false);
  const [widgetsPanelHover, setWidgetsPanelHover] = useState(false);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const selected = widgets.find((w) => w.id === selectedId);
  const readOnly = !canEditCurrentDashboard;
  const showWidgetsPanel = widgetsPanelOpen || widgetsPanelHover;

  // Load existing dashboard
  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    setLoadingDb(true);
    setDashboardLoadError(null);
    fetchDashboard(routeId).then((db) => {
      if (cancelled) return;
      if (db) {
        setName(db.name);
        setDashboardId(db.id);
        const layout = Array.isArray(db.layout)
          ? db.layout.map(normalizeWidget).filter(Boolean) as Widget[]
          : [];
        setWidgets(layout);
      } else {
        setDashboardLoadError("Dashboard not found or you do not have access.");
      }
      setLoadingDb(false);
    });
    return () => { cancelled = true; };
  }, [routeId]);

  useEffect(() => {
    if (!dashboardId) {
      setCanEditCurrentDashboard(canCreateContent);
      return;
    }
    if (canManageWorkspace) {
      setCanEditCurrentDashboard(true);
      return;
    }
    if (!isAdmin || !user) {
      setCanEditCurrentDashboard(false);
      return;
    }

    let cancelled = false;
    supabase
      .from("dashboard_permissions")
      .select("permission")
      .eq("dashboard_id", dashboardId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[builder] dashboard permission lookup failed", error);
        setCanEditCurrentDashboard(data?.permission === "edit");
      });

    return () => { cancelled = true; };
  }, [canCreateContent, canManageWorkspace, dashboardId, isAdmin, user]);

  const handleSave = async () => {
    console.debug("[builder] Save clicked", { dashboardId, name, widgetCount: widgets.length });
    if (!user) {
      toast.error("You must be signed in to save dashboards");
      return null;
    }
    if (!currentOrgId) {
      toast.error("Select a workspace before saving");
      return null;
    }
    if (!canEditCurrentDashboard) {
      toast.error("You only have read-only access to this dashboard");
      return null;
    }
    const validationError = validateWidgetsForSave(widgets);
    if (validationError) {
      toast.error(validationError);
      return null;
    }
    setSaving(true);
    try {
      if (dashboardId) {
        console.debug("[builder] Updating existing dashboard", { id: dashboardId, widgetCount: widgets.length });
        const updated = await updateDashboard(dashboardId, { name, layout: widgets });
        if (updated) {
          console.debug("[builder] Dashboard updated successfully");
          toast.success("Dashboard saved");
          return updated.id;
        } else {
          console.warn("[builder] updateDashboard returned null/error (check error message in console)");
        }
      } else {
        console.debug("[builder] Creating new dashboard", { name, widgetCount: widgets.length });
        const created = await create({ name, layout: widgets });
        if (created) {
          console.debug("[builder] Dashboard created successfully", { id: created.id });
          setDashboardId(created.id);
          toast.success("Dashboard created");
          navigate(`/app/dashboards/${created.id}`, { replace: true });
          return created.id;
        } else {
          console.warn("[builder] create returned null/error (check error message in console)");
        }
      }
    } catch (e: any) {
      console.error("[builder] Unexpected save error:", e);
      toast.error("Failed to save dashboard - check browser console for details");
    } finally {
      setSaving(false);
    }
    return null;
  };

  const openAiGenerator = async () => {
    if (loadingDb || saving) return;
    if (!canEditCurrentDashboard && dashboardId) {
      toast.error("You only have read-only access to this dashboard");
      return;
    }
    if (!currentOrgId) {
      toast.error("Select a workspace before generating widgets");
      return;
    }
    if (!dashboardId) {
      const savedId = await handleSave();
      if (!savedId) return;
    }
    setAiOpen(true);
  };

  const handleAiSuccess = async (generatedWidgets: GeneratedDashboardWidget[]) => {
    const activeDashboardId = dashboardId ?? routeId;
    const normalizedGenerated = generatedWidgets.map(normalizeWidget).filter(Boolean) as Widget[];
    setWidgets((current) => [...current, ...normalizedGenerated]);
    setSelectedId(normalizedGenerated[0]?.id ?? null);

    if (activeDashboardId) {
      const refreshed = await fetchDashboard(activeDashboardId);
      if (refreshed) {
        const layout = Array.isArray(refreshed.layout)
          ? refreshed.layout.map(normalizeWidget).filter(Boolean) as Widget[]
          : [];
        setWidgets(layout);
      }
    }

    toast.success("AI widgets added to the dashboard");
    setAiOpen(false);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const update = (id: string, patch: Partial<Widget>) => {
    if (readOnly) return;
    setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const duplicate = (id: string) => {
    if (readOnly) return;
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    const nid = `w_${Date.now()}`;
    const idx = widgets.findIndex((x) => x.id === id);
    setWidgets((ws) => [...ws.slice(0, idx + 1), { ...w, id: nid }, ...ws.slice(idx + 1)]);
    setSelectedId(nid);
  };
  const remove = (id: string) => {
    if (readOnly) return;
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
      const newW: Widget = {
        id,
        type: activeData.type,
        title: def.label,
        w: 4,
        h: 3,
        config: defaultWidgetConfig(activeData.type),
      };
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

  const loadSampleForWidget = async (widget: Widget) => {
    const colId = widget.config?.collection_id;
    if (!colId) {
      toast.error("Select a collection first");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("collection_records")
        .select("data")
        .eq("collection_id", colId)
        .limit(15);
      if (error) {
        console.error("Failed to load sample records", error);
        toast.error("Failed to load sample records");
        return;
      }
      const rows = (data ?? []).map((r: any) => r.data ?? {});
      const cols = rows.length ? Object.keys(rows[0]) : [];
      update(widget.id, {
        config: {
          ...(widget.config || {}),
          rows,
          columns: cols,
          collection_id: colId,
        },
      });
      toast.success("Loaded sample records");
    } catch (e) {
      console.error("Unexpected error loading sample records", e);
      toast.error("Failed to load sample records");
    }
  };

  const handlePreview = async () => {
    // Build preview widgets by fetching samples for widgets with a collection
    const built: Widget[] = await Promise.all(widgets.map(async (w) => {
      if (w.config?.collection_id) {
        try {
          const { data } = await supabase.from("collection_records").select("data").eq("collection_id", w.config!.collection_id).limit(10);
          const rows = (data ?? []).map((r: any) => r.data ?? {});
          const cols = rows.length ? Object.keys(rows[0]) : [];
          return { ...w, config: { ...(w.config || {}), rows, columns: cols } };
        } catch (e) {
          return w;
        }
      }
      return w;
    }));
    setPreviewWidgets(built);
    setPreviewOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreview}><Eye className="h-3.5 w-3.5" />Preview</Button>
            {readOnly ? (
              <Badge variant="secondary">Read-only mode</Badge>
            ) : (
              <Button size="sm" className="gap-1.5 bg-gradient-primary shadow-glow" onClick={handleSave} disabled={saving || loadingDb}>
                <Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
        }
      />
      <DndContext
        sensors={sensors}
        onDragStart={readOnly ? undefined : onDragStart}
        onDragEnd={readOnly ? undefined : onDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="relative flex h-[calc(100vh-3.5rem)] min-h-[520px] flex-1 overflow-hidden">
          {/* Left palette trigger */}
          {!readOnly && (
            <div
              className="absolute inset-y-0 left-0 z-30 w-4"
              onMouseEnter={() => setWidgetsPanelHover(true)}
            />
          )}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="absolute left-4 top-4 z-40 h-8 gap-1.5 bg-card/90 backdrop-blur-xl shadow-card"
              onClick={() => setWidgetsPanelOpen((open) => !open)}
            >
              <PanelsTopLeft className="h-3.5 w-3.5" /> Widgets
            </Button>
          )}
          <aside
            className={cn(
              "absolute inset-y-0 left-0 z-30 w-64 border-r border-border bg-card/90 backdrop-blur-xl p-3 space-y-1 overflow-y-auto scrollbar-thin shadow-xl transition-transform duration-300 ease-in-out",
              showWidgetsPanel ? "translate-x-0" : "-translate-x-full"
            )}
            onMouseEnter={() => setWidgetsPanelHover(true)}
            onMouseLeave={() => setWidgetsPanelHover(false)}
          >
            <div className="px-2 pt-1 pb-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-0 bg-transparent px-0 h-7 text-base font-semibold focus-visible:ring-0"
              />
            </div>
            {readOnly ? (
              <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-xs text-muted-foreground">
                You can view this dashboard, but editing is disabled.
              </div>
            ) : (
              <>
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Widgets · drag onto canvas
                </div>
                {palette.map((p) => (
                  <PaletteItem key={p.type} type={p.type} label={p.label} Icon={p.icon} />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 gap-1.5"
                  onClick={openAiGenerator}
                  disabled={saving || loadingDb}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />Generate with AI
                </Button>
              </>
            )}
          </aside>

          {/* Canvas */}
          <main className="min-w-0 flex-1 overflow-auto scrollbar-thin bg-background">
            <div className="min-h-full p-8">
              {loadingDb ? (
                <div className="grid min-h-[420px] place-items-center rounded-xl border border-border/70 bg-card/30 text-sm text-muted-foreground">
                  Loading dashboard...
                </div>
              ) : dashboardLoadError ? (
                <div className="grid min-h-[420px] place-items-center rounded-xl border border-border/70 bg-card/30 p-8 text-center">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Dashboard unavailable</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{dashboardLoadError}</p>
                    <Button variant="outline" size="sm" className="mt-4" asChild>
                      <Link to="/app/dashboards">Back to dashboards</Link>
                    </Button>
                  </div>
                </div>
              ) : (
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
                        onDuplicate={() => !readOnly && duplicate(w.id)}
                        onRemove={() => !readOnly && remove(w.id)}
                        onResize={(nw, nh) => !readOnly && update(w.id, { w: nw, h: nh })}
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
              )}
            </div>
          </main>

          {/* Right inspector */}
          {selected && (
          <aside className="w-72 shrink-0 border-l border-border bg-card/60 backdrop-blur-xl p-4 overflow-y-auto scrollbar-thin animate-fade-in">
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
                    readOnly={readOnly}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Width — {selected.w} cols</Label>
                  <Slider
                    value={[selected.w]} min={2} max={12} step={1}
                    onValueChange={([v]) => update(selected.id, { w: v })}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Height — {selected.h} rows</Label>
                  <Slider
                    value={[selected.h]} min={2} max={8} step={1}
                    onValueChange={([v]) => update(selected.id, { h: v })}
                    disabled={readOnly}
                  />
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground space-y-1">
                  <div>Type · <span className="text-foreground capitalize">{widgetTypeLabels[selected.type]}</span></div>
                  <div>Size · <span className="text-foreground">{selected.w} × {selected.h}</span></div>
                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground">Data source</div>
                    {(selected.type === "table" || selected.type === "line_chart" || selected.type === "bar_chart" || selected.type === "pie_chart" || selected.type === "stat") ? (
                      <div className="flex flex-col gap-2">
                        <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), collection_id: val, xKey: null, yKey: null, columns: [], rows: [] } })}>
                          <SelectTrigger>
                            <SelectValue>{selected.config?.collection_id ? (collections.find(c => c.id === selected.config!.collection_id)?.name ?? 'Selected collection') : 'Select collection'}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {collections.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selected.type !== 'stat' ? (
                          selected.config?.collection_id ? (
                            <div className="space-y-3">
                              {(selected.type === "line_chart" || selected.type === "bar_chart") && (
                                <>
                                  <div className="space-y-2">
                                    <Label className="text-xs">X axis</Label>
                                    <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), xKey: val } })}>
                                      <SelectTrigger>
                                        <SelectValue>{selected.config?.xKey ?? 'Select X axis'}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(selected.config?.columns ?? []).map((column) => (
                                          <SelectItem key={column} value={column}>{column}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Y axis</Label>
                                    <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), yKey: val } })}>
                                      <SelectTrigger>
                                        <SelectValue>{selected.config?.yKey ?? 'Select Y axis'}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(selected.config?.columns ?? []).map((column) => (
                                          <SelectItem key={column} value={column}>{column}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}
                              {selected.type === "pie_chart" && (
                                <>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Category field</Label>
                                    <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), xKey: val } })}>
                                      <SelectTrigger>
                                        <SelectValue>{selected.config?.xKey ?? 'Select category field'}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(selected.config?.columns ?? []).map((column) => (
                                          <SelectItem key={column} value={column}>{column}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Value field</Label>
                                    <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), yKey: val } })}>
                                      <SelectTrigger>
                                        <SelectValue>{selected.config?.yKey ?? 'Select value field'}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(selected.config?.columns ?? []).map((column) => (
                                          <SelectItem key={column} value={column}>{column}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => loadSampleForWidget(selected)}>Load sample</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => loadSampleForWidget(selected)}>Load sample</Button>
                            </div>
                          )
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-foreground">PostgreSQL</div>
                    )}
                  </div>
                </div>
                {selected.type === 'stat' ? (
                  <div className="space-y-3">
                    {selected.config?.collection_id ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs">Metric field</Label>
                          <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), valueKey: val } })}>
                            <SelectTrigger>
                              <SelectValue>{selected.config?.valueKey ?? 'Select metric field'}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(selected.config?.columns ?? []).map((column) => (
                                <SelectItem key={column} value={column}>{column}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Aggregation</Label>
                          <Select onValueChange={(val) => update(selected.id, { config: { ...(selected.config || {}), aggregate: val as WidgetConfig['aggregate'] } })}>
                            <SelectTrigger>
                              <SelectValue>{selected.config?.aggregate ?? 'Select aggregation'}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {['count', 'sum', 'avg', 'max', 'min'].map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Delta</Label>
                          <Input
                            value={selected.config?.delta ?? ""}
                            onChange={(e) => update(selected.id, { config: { ...(selected.config || {}), delta: e.target.value } })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs">Value</Label>
                          <Input
                            value={selected.config?.value ?? ""}
                            onChange={(e) => update(selected.id, { config: { ...(selected.config || {}), value: e.target.value } })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Delta</Label>
                          <Input
                            value={selected.config?.delta ?? ""}
                            onChange={(e) => update(selected.id, { config: { ...(selected.config || {}), delta: e.target.value } })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadSampleForWidget(selected)}>Load sample</Button>
                    </div>
                  </div>
                ) : !readOnly ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => duplicate(selected.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicate
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => remove(selected.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                ) : null}
              </div>
          </aside>
          )}
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
        {previewOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
            <div className="bg-card rounded-lg p-4 max-w-4xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Preview</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
                </div>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {previewWidgets.map((w) => (
                  <div key={w.id} className="p-2 border rounded bg-card/80">
                    <div className="text-xs font-semibold mb-1">{w.title}</div>
                    <div style={{ height: 220 }}>
                      <WidgetBody widget={w} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <GenerateDashboardModal
          open={aiOpen}
          onOpenChange={setAiOpen}
          orgId={currentOrgId}
          dashboardId={dashboardId}
          onSuccess={handleAiSuccess}
        />
      </DndContext>
    </div>
  );
}
