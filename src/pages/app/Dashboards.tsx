import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, MoreHorizontal, Sparkles, Trash2, Loader2, PanelsTopLeft,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useDashboards } from "@/hooks/useDashboards";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";

export default function Dashboards() {
  const { dashboards, loading, create, remove } = useDashboards();
  const { canCreateContent, canEditWorkspaceContent, isReadOnlyMember, isAdmin } = useWorkspacePermissions();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = dashboards.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const created = await create({ name: name.trim(), description: desc.trim() || undefined });
    setCreating(false);
    if (created) {
      toast.success("Dashboard created");
      setOpenNew(false);
      setName(""); setDesc("");
      navigate(`/app/dashboards/${created.id}`);
    }
  };

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Workspace" }, { label: "Dashboards" }]}
        actions={
          canCreateContent ? (
            <Button size="sm" className="bg-gradient-primary shadow-glow" onClick={() => setOpenNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />New dashboard
            </Button>
          ) : (
            <Badge variant="secondary">{isAdmin ? "Assigned access" : "Read-only mode"}</Badge>
          )
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
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-9 w-64 bg-secondary/40"
                placeholder="Search dashboards…"
              />
            </div>
            {canCreateContent && (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />Generate with AI
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboards…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <PanelsTopLeft className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-semibold">No dashboards available</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isReadOnlyMember || isAdmin ? "Ask an owner to share a dashboard with you." : "Create your first dashboard to start visualizing data."}
            </p>
            {canCreateContent && (
              <Button size="sm" className="mt-4 bg-gradient-primary" onClick={() => setOpenNew(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New dashboard
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((d) => {
              const widgetCount = Array.isArray(d.layout) ? d.layout.length : 0;
              const canEditDashboard = canEditWorkspaceContent || (isAdmin && d.permission === "edit");
              return (
                <div
                  key={d.id}
                  className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-glow transition-all"
                >
                  <Link to={`/app/dashboards/${d.id}`} className="block">
                    <div className="aspect-[16/10] dot-bg p-4 border-b border-border bg-gradient-to-br from-secondary/40 to-card relative">
                      <div className="grid grid-cols-3 gap-2 h-full">
                        <div className="col-span-2 rounded bg-gradient-primary/20 border border-primary/20" />
                        <div className="rounded bg-secondary/60 border border-border" />
                        <div className="rounded bg-secondary/60 border border-border" />
                        <div className="col-span-2 rounded bg-secondary/60 border border-border" />
                      </div>
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/app/dashboards/${d.id}`} className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{d.name}</h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {d.description || "No description"}
                        </p>
                      </Link>
                      {canEditDashboard && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/app/dashboards/${d.id}`)}>
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              if (!confirm(`Delete "${d.name}"?`)) return;
                              const ok = await remove(d.id);
                              if (ok) toast.success("Dashboard deleted");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="font-normal">{widgetCount} widgets</Badge>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a new dashboard</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="db-name">Name</Label>
              <Input
                id="db-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Revenue overview"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-desc">Description (optional)</Label>
              <Input
                id="db-desc" value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="MRR, churn and expansion"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()} className="bg-gradient-primary">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
